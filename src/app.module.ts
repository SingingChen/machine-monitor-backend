import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { MachineService } from './machine.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, PrismaService, MachineService],
})
export class AppModule {}
