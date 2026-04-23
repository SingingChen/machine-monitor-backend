import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';
import { MachineService } from './machine.service';

@Injectable()

export class MachineWorkerService implements OnModuleInit {
  private pubSub: PubSub;
  private subscriptionName = 'machine-status-subs';
  private topicName = 'machine-status-topic';

  constructor(private readonly machineService: MachineService) {
  }

  async onModuleInit() {
    this.pubSub = new PubSub({
      projectId: 'local-project',
    });

    // 確保訂閱存在（模擬器環境下建議手動確認一次）
    try {
      const [subscription] = await this.pubSub
        .topic(this.topicName)
        .createSubscription(this.subscriptionName);
      console.log(`訂閱服務 ${this.subscriptionName} 已啟動`);

      // 開始監聽訂閱
      subscription.on('message', (message) => this.handleMessage(message));
    } catch (e) {
      console.log(`正在連結現有的訂閱服務...`);
      const subscription = this.pubSub.subscription(this.subscriptionName);
      subscription.on('message', (message) => this.handleMessage(message));
    }
  }


  private async handleMessage(message:any) {
    const data = JSON.parse(message.data.toString());
    console.log('--- 收到 Pub/Sub 訊息 ---');
    console.log('內容:', data);

    try{
      // 呼叫原本的 MachineService 存入資料庫
      await this.machineService.createStatus(data)
      console.log('✅ 訊息處理成功並存入資料庫');

      // 告訴 Pub/Sub 我們處理完了，訊息可以從隊列移除了
      message.ack();
    }catch(e){
      console.error('❌ 處理訊息失敗:', e);
    }


  }

}