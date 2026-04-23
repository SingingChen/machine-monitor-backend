import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import {PubSubService} from "./pubsub.service";
import { MachineService } from './machine.service';
import {MachineWorkerService} from "./machine-worker.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    MachineService,
    PubSubService,
    MachineWorkerService
  ],
})
export class AppModule {}
