import { Controller, Post, Body, Get } from '@nestjs/common';
import { MachineService } from './machine.service';
import {PubSubService} from "./pubsub.service";

@Controller('machine')
export class AppController {
  // constructor(private readonly machineService: MachineService) {}
  constructor(private readonly pubsubService: PubSubService) {}

  @Post('status')
  async receiveStatus(@Body() statusData: any) {
    console.log('接收到 API 數據，準備送入隊列:', statusData);

    // 將資料丟進 Pub/Sub
    await  this.pubsubService.publishMessage(statusData);
    return { message: '數據已進入隊列處理中' };



    // 呼叫 Service 存入資料庫
    // const result = await this.machineService.createStatus(statusData);
    // return {
    //   message: '狀態已接收並存儲',
    //   data: result,
    //   db_id: result.id // 回傳資料庫生成的 ID
    // };
  }


}
