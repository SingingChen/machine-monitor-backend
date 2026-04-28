import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class MachineService {
  constructor(private prisma: PrismaService) {}

  async createStatus(data: { id: string; temp: number; status: string }) {
    return this.prisma.machineStatus.create({
      data: {
        machineId: data.id,
        temperature: data.temp,
        status: data.status,
        rawData: data, // 將整份 JSON 存入 rawData 欄位
      },
    });
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
}
