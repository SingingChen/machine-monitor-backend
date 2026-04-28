import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { MachineService } from './machine.service';
import { MachineGateway } from './machine.gateway';

@Injectable()
export class MachineWorkerService implements OnModuleInit {
  private pubSub: PubSub;
  private subscriptionName = 'machine-status-sub';
  private topicName = 'machine-status';

  constructor(
    private readonly machineService: MachineService,
    private readonly machineGateway: MachineGateway, // 注入大喇叭
  ) {}

  async onModuleInit() {
    this.pubSub = new PubSub({
      projectId: process.env.GCP_PROJECT_ID,
    });

    // GCP版本
    // 1. 取得操作桿 (同步動作，不用 await)
    const subscription = this.pubSub.subscription(this.subscriptionName);

    // 2. 設定錯誤處理 (萬一門牌號碼不對，會跑這裡)
    subscription.on('error', (err) => {
      console.error(`❌ 訂閱連線失敗: ${err.message}`);
    });

    // 3. 開始聽訊息
    subscription.on('message', (msg) => this.handleMessage(msg));

    console.log(`📡 已掛載監聽器於: ${this.subscriptionName}`);
  }

  private async handleMessage(message: any) {
    const data = JSON.parse(message.data.toString());
    console.log('--- 收到 Pub/Sub 訊息 ---');
    console.log('內容:', data);

    try {
      // 呼叫原本的 MachineService 存入資料庫
      const result = await this.machineService.createStatus(data);
      console.log('✅ 訊息處理成功並存入資料庫');

      // 關鍵：存檔成功後，立刻廣播給前端！
      this.machineGateway.broadcastMachineStatus(result);
      // 告訴 Pub/Sub 我們處理完了，訊息可以從隊列移除了
      message.ack();
    } catch (e) {
      console.error('❌ 處理訊息失敗:', e);
    }
  }
}
