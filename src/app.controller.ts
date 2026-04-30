import { Controller, Post, Body, Get } from '@nestjs/common';
import { MachineService } from './machine.service';
import { PubSubService } from './pubsub.service';

@Controller('machine')
export class AppController {
  // constructor(private readonly machineService: MachineService) {}
  constructor(
    private readonly pubsubService: PubSubService,
    private readonly machineService: MachineService,
  ) {}

  @Post('status')
  async receiveStatus(@Body() statusData: any) {
    console.log('接收到 API 數據，準備送入隊列:', statusData);

    // 將資料丟進 Pub/Sub
    await this.pubsubService.publishMessage(statusData);
    return { message: '數據已進入隊列處理中' };

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
