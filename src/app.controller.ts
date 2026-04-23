import { Controller, Post, Body, Get } from '@nestjs/common';
import { MachineService } from './machine.service';

@Controller('machine')
export class AppController {
  constructor(private readonly machineService: MachineService) {}

  @Post('status')
  async receiveStatus(@Body() statusData: any) {
    console.log('接收到機器數據:', statusData);
    // 呼叫 Service 存入資料庫
    const result = await this.machineService.createStatus(statusData);
    return {
      message: '狀態已接收並存儲',
      data: result,
      db_id: result.id // 回傳資料庫生成的 ID
    };
  }


}
