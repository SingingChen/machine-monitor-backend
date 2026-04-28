import { Injectable, OnModuleInit } from '@nestjs/common';
import { PubSub } from '@google-cloud/pubsub';

@Injectable()
export class PubSubService implements OnModuleInit {
  private pubSub: PubSub;
  private topicName = 'machine-status';

  async onModuleInit() {
    // 初始化 Pub/Sub 客户端
    this.pubSub = new PubSub({
      projectId: process.env.GCP_PROJECT_ID,
    });

    // 加上一點 Log 幫助確認
    console.log(
      `PubSub 發送端已初始化，Project ID: ${process.env.GCP_PROJECT_ID}`,
    );

    // 確保 Topic 存在（模擬器環境下建議手動確認一次）
    try {
      await this.pubSub.createTopic(this.topicName);
      console.log(`Topic ${this.topicName} 建立成功`);
    } catch (e) {
      if (e.code === 6) {
        // 6 就是 ALREADY_EXISTS
        console.log(`ℹ️ Topic ${this.topicName} 已經存在，直接使用。`);
      } else {
        throw e;
      }
    }
  }

  async publishMessage(data: any) {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    try {
      const messageId = await this.pubSub
        .topic(this.topicName)
        .publishMessage({ data: dataBuffer });
      console.log(`訊息已發布，ID: ${messageId}`);
      return messageId;
    } catch (error) {
      console.error(`Error publishing message: ${error}`);
    }
  }
}
