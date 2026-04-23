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
}