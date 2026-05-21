import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { MachineService } from './machine.service';
import { PubSubService } from './pubsub.service';
import { ApiKeyGuard } from './auth/api-key/api-key.guard';

@Controller('machine')
export class AppController {
  // constructor(private readonly machineService: MachineService) {}
  constructor(
    private readonly pubsubService: PubSubService,
    private readonly machineService: MachineService,
  ) {}
  @UseGuards(ApiKeyGuard)
  @Post('status')
  async receiveStatus(@Body() statusData: any) {
    console.log('📥 接收到 API 數據:', statusData);

    // 🎯 根據環境選擇資料處理模式
    if (process.env.NODE_ENV === 'production') {
      // ☁️ 正式環境：發送到 Pub/Sub，由 Cloud Run 實例處理
      console.log('☁️ 正式環境：發送到 Pub/Sub');
      await this.pubsubService.publishMessage(statusData);
      return { message: '數據已發送到 Pub/Sub 隊列' };
    } else {
      // 💻 本地開發：直接寫入資料庫 + WebSocket 廣播（不使用 Pub/Sub）
      console.log('💻 本地開發：直接寫入本地資料庫');
      const result = await this.machineService.createStatus(statusData);
      return {
        message: '數據已寫入本地資料庫並廣播到前端',
        data: result
      };
    }

    // 呼叫 Service 存入資料庫
    // const result = await this.machineService.createStatus(statusData);
    // return {
    //   message: '狀態已接收並存儲',
    //   data: result,
    //   db_id: result.id // 回傳資料庫生成的 ID
    // };
  }
  // 2. 新增的 GET 路由：負責回傳統計數據
  @Get('stats')
  async getStats() {
    console.log('正在讀取系統統計數據...');
    return await this.machineService.getStats();
  }

  @Post('pubsub-push')
  async handlePubSubPush(@Body() body: any) {
    try {
      // 記錄消息 ID（用於除錯和去重）
      const messageId = body.message.messageId || 'unknown';
      console.log('📬 收到 GCP Push 推播 (Message ID:', messageId + ')');

      // GCP 推播的資料會經過 Base64 編碼，放在 message.data 裡
      const encodedData = body.message.data;
      const decodedData = JSON.parse(
        Buffer.from(encodedData, 'base64').toString(),
      );

      console.log('📥 解碼資料:', decodedData);

      // 執行寫入資料庫
      await this.machineService.createStatus(decodedData);

      console.log('✅ 訊息處理成功 (Message ID:', messageId + ')');

      // 🎯 關鍵：立即返回 200 狀態碼，告訴 Pub/Sub 消息已處理
      return { success: true, messageId };
    } catch (error) {
      // ⚠️ 即使發生錯誤，也返回 200（避免 Pub/Sub 重試導致重複）
      // 如果想讓 Pub/Sub 重試，改為拋出錯誤或返回 4xx/5xx
      console.error('❌ 處理 Pub/Sub 訊息失敗:', error.message);
      console.error('錯誤堆疊:', error.stack);

      // 選項 A：返回成功（不重試，記錄錯誤）
      return { success: false, error: error.message };

      // 選項 B：拋出錯誤（讓 Pub/Sub 重試）- 如果要啟用，註解上面一行，取消註解下面這行
      // throw error;
    }
  }
}
