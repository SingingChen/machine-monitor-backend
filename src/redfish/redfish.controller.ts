import {
  Controller,
  Get,
  Param,
  NotFoundException,
  Patch,
  Body,
} from '@nestjs/common';
import { MachineService } from '../machine.service'; // 💡 引入剛剛你看的 MachineService

@Controller('redfish/v1') // 🎯 這是 DMTF 國際標準規定的根路徑
export class RedfishController {
  // 注入你原本用來讀取資料庫的 Service
  constructor(private readonly machineService: MachineService) {}

  // 🎯 模擬獲取特定冷卻主機（Chassis）的散熱/溫度數據
  // 當打 GET http://localhost:3000/redfish/v1/Chassis/COOLING-01/Thermal 時會觸發
  @Get('Chassis/:id/Thermal')
  async getCoolingUnitThermal(@Param('id') id: string) {
    // 💡 呼叫你 machine.service.ts 裡的 getLatestStatus
    const latestData = await this.machineService.getLatestStatus(id);

    // 如果 Cloud SQL 裡完全沒有這台機器的紀錄，回傳 404 錯誤
    if (!latestData) {
      throw new NotFoundException(`Cooling Unit ${id} not found in Cloud SQL`);
    }

    // 🎯 這裡回傳符合 DMTF Redfish 規格書的標準 JSON 格式
    return {
      '@odata.context': '/redfish/v1/$metadata#Thermal.Thermal',
      '@odata.id': `/redfish/v1/Chassis/${id}/Thermal`,
      '@odata.type': '#Thermal.v1_7_0.Thermal',
      Id: 'Thermal',
      Name: 'Kaori Cooling Unit Thermal Metrics', // 高力冷卻設備數據
      Temperatures: [
        {
          '@odata.id': `/redfish/v1/Chassis/${id}/Thermal#/Temperatures/0`,
          MemberId: '0',
          Name: 'Internal Water Loop Temperature',
          SensorNumber: 1,
          ReadingCelsius: latestData.temperature || 25.0, // 👈 綁定你從 Cloud SQL 撈出來的真實溫度
          UpperThresholdCritical: 85.0, // 臨界高溫警告線（工業標準通常會設定閾值）
          UpperThresholdFatal: 95.0, // 致死高溫停機線
          Status: {
            State: 'Enabled',
            // 動態判斷設備健康狀態：超過 85 度就顯示 Critical (危急)
            Health: (latestData.temperature || 0) > 85.0 ? 'Critical' : 'OK',
          },
        },
      ],
    };
  }

  // 🎯 新增：模擬配置硬體參數 (例如修改水泵轉速或設定值)
  // 當打 PATCH http://localhost:3000/redfish/v1/Chassis/MAC-002/Thermal 時觸發
  @Patch('Chassis/:id/Thermal')
  async configureCoolingUnit(
    @Param('id') id: string,
    @Body() configBody: { pumpSpeed?: number; upperThreshold?: number },
  ) {
    console.log(
      `⚙️ [Redfish 配置遠端下達] 收到來自邊緣端的硬體參數修改請求：`,
      configBody,
    );
    // 1. 🎯 先從資料庫撈出 MAC-002 目前最新一筆的「真實水溫」
    const currentStatus = await this.machineService.getLatestStatus(id);

    // 如果以前完全沒這台機器的紀錄，預設給它 25.0 度；有紀錄就用當前的真實溫度
    const currentTemp = currentStatus ? currentStatus.temperature : 25.0;

    // 1. 呼叫原本就有的 machineService 去建立一筆「帶有新配置參數」的狀態
    // 存入你的 Cloud SQL 中
    // 這樣在工廠端的 Python 軟體或是前端網頁，就能撈到最新被修改的 pumpSpeed
    const updatedLog = await this.machineService.createStatus({
      id: id,
      temp: currentTemp, // 保持目前的溫度
      status: `configured: pumpSpeed=${configBody.pumpSpeed || 100}`, // 👈 把設定值存在 status 欄位裡
    });

    // 這裡我們模擬配置成功
    // 在真實場景，這裡會去寫入資料庫，或者像剛才說的透過 Python 去影響硬體
    return {
      '@odata.type': '#Thermal.v1_7_0.Thermal',
      Message:
        'Successfully configured Kaori Cooling Unit parameters and saved to Cloud SQL.',
      ChassisId: id,
      DatabaseLogId: updatedLog.id, // 👈 證明真的有進資料庫！
      AppliedConfiguration: {
        TargetPumpSpeedPercentage: configBody.pumpSpeed || 100,
        NewThresholdCelsius: configBody.upperThreshold || 85.0,
      },
      Status: 'Completed',
      ConfiguredAt: updatedLog.createdAt,
    };
  }
}
