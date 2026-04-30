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
}
