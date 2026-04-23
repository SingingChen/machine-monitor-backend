import {WebSocketGateway, WebSocketServer} from '@nestjs/websockets';
import {Server} from 'socket.io';

@WebSocketGateway({cors: {origin: '*'}}) // 允許來自任何來源的跨域請求
export class MachineGateway {
  @WebSocketServer()
  server: Server;

  // 當有新的機器狀態更新時，呼叫此方法來廣播訊息給所有連接的客戶端
  broadcastMachineStatus(data: any) {
    this.server.emit('machineUpdate', data); // 發送事件給所有連接的客戶端
    console.log('📢 已透過 WebSocket 廣播機器數據', data);
  }
}