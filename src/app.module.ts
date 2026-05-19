import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import {PubSubService} from "./pubsub.service";
import { MachineService } from './machine.service';
import {MachineWorkerService} from "./machine-worker.service";
import {MachineGateway} from "./machine.gateway";
import { RedfishController } from './redfish/redfish.controller';

@Module({
  imports: [],
  controllers: [AppController, RedfishController],
  providers: [
    AppService,
    PrismaService,
    MachineService,
    PubSubService,
    MachineWorkerService,
    MachineGateway
  ],
})
export class AppModule {}
