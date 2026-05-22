import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { MachineGateway } from './machine.gateway';

@Injectable()
export class MachineService {
  constructor(
    private prisma: PrismaService,
    // 3. 注入 Gateway (使用 forwardRef 避免循環引用)
    @Inject(forwardRef(() => MachineGateway))
    private machineGateway: MachineGateway, // 注入大喇叭
  ) {}

  async createStatus(data: { id: string; temp: number; status: string }) {
    console.log('📥 收到新資料，準備存入 Prisma...', data.id);
    // A. 先存入資料庫
    const newLog = await this.prisma.machineStatus.create({
      data: {
        machineId: data.id,
        temperature: data.temp,
        status: data.status,
        rawData: data, // 將整份 JSON 存入 rawData 欄位
      },
    });
    // B. 取得最新的統計數據
    console.log('✅ Prisma 存入成功，計算統計中...');
    const latestStats = await this.getStats();

    // C. 透過 WebSocket 廣播「包裹式更新」
    console.log('📡 準備發送 WebSocket 廣播...');
    this.machineGateway.broadcastUpdate({ newLog, latestStats });

    return newLog;
  }

  async getStats() {
    const total = await this.prisma.machineStatus.count();
    const ag = await this.prisma.machineStatus.aggregate({
      _avg: { temperature: true },
    });
    const alerts = await this.prisma.machineStatus.count({
      where: {
        temperature: { gt: 50 },
      },
    });

    return {
      totalCount: total,
      avgTemp: ag._avg.temperature?.toFixed(1) || 0,
      alertCount: alerts,
    };
  }

  // 🎯 根據機器 ID 取得最新一筆狀態資料
  async getLatestStatus(machineId: string) {
    const latestStatus = await this.prisma.machineStatus.findFirst({
      where: {
        machineId: machineId,
      },
      orderBy: {
        createdAt: 'desc', // 最新的在前面
      },
    });

    return latestStatus; // 找不到時回傳 null
  }

  // 🎯 檢查最近是否有重複的資料（用於 Pub/Sub 去重）
  async checkRecentDuplicate(
    machineId: string,
    temperature: number,
    withinSeconds: number = 30,
  ) {
    const cutoffTime = new Date(Date.now() - withinSeconds * 1000);

    const duplicate = await this.prisma.machineStatus.findFirst({
      where: {
        machineId: machineId,
        temperature: temperature,
        createdAt: {
          gte: cutoffTime, // 大於等於截止時間（最近 N 秒內）
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return duplicate; // 找到重複資料時回傳該記錄，否則回傳 null
  }
}
