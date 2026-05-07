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
    console.log('接收到 API 數據，準備送入隊列:', statusData);

    // 路線 A：將資料丟進 Pub/Sub (確保雲端資料庫也會更新)
    await this.pubsubService.publishMessage(statusData);

    // 路線 B：本地直接處理 (確保本地 Socket 廣播，讓 localhost:5173 立即跳動)
    // 我們呼叫原本 handlePubSubPush 在做的事，但跳過編碼解碼過程
    // 判斷環境：只有在「非生產環境」時，才手動觸發本地寫入與廣播
    // 註：在 Cloud Run 上，NODE_ENV 預設通常是 'production'

    if (process.env.NODE_ENV !== 'production') {
      console.log('💻 本地模式：手動觸發寫入與廣播');
      await this.machineService.createStatus(statusData);
    } else {
      console.log('☁️ 雲端模式：已送入隊列，等待 Pub/Sub 推播回來寫入');
    }

    return { message: '數據已同步至雲端並更新本地畫面' };

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
    // GCP 推播的資料會經過 Base64 編碼，放在 message.data 裡
    const encodedData = body.message.data;
    const decodedData = JSON.parse(
      Buffer.from(encodedData, 'base64').toString(),
    );

    console.log('📬 收到 GCP Push 推播:', decodedData);

    // 直接執行寫入資料庫
    return await this.machineService.createStatus(decodedData);
  }
}
