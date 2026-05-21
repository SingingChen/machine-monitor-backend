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

    // 🚫 暫時禁用 Pull 模式監聽，因為我們使用 Push subscription
    // 如果你想啟用 Pull 模式，請確保 GCP 沒有設定 Push subscription
    console.log(`⚙️  Worker Service 已載入但監聽已禁用（使用 Push 模式）`);

    // ⬇️ 如果要啟用 Pull 模式，請取消以下註解並確保 GCP 沒有 Push subscription
    /*
    if (process.env.NODE_ENV === 'production') {
      const subscription = this.pubSub.subscription(this.subscriptionName);
      subscription.on('error', (err) => {
        console.error(`❌ 訂閱連線失敗: ${err.message}`);
      });
      subscription.on('message', (msg) => this.handleMessage(msg));
      console.log(`📡 已掛載監聽器於: ${this.subscriptionName}`);
    } else {
      console.log(`💻 本地模式：跳過 Pub/Sub 監聽 (改由 Controller 直接觸發)`);
    }
    */
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
      this.machineGateway.broadcastUpdate(result);
      // 告訴 Pub/Sub 我們處理完了，訊息可以從隊列移除了
      message.ack();
    } catch (e) {
      console.error('❌ 處理訊息失敗:', e);
    }
  }
}
