import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Realtime battle updates. Server is authoritative — the client only
 * subscribes to rooms, it never sends game state.
 *
 * Rooms: battle:{id}, user:{userId}
 * Events out: battle:joined | battle:starting | battle:round | battle:finished | battle:cancelled
 *
 * The client falls back to REST polling if the socket can't connect.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true } })
export class BattlesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BattlesGateway.name);

  handleConnection(client: Socket) {
    const battleId = client.handshake.query?.battleId;
    if (typeof battleId === 'string' && battleId) {
      void client.join(`battle:${battleId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug?.(`socket ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe')
  subscribe(client: Socket, payload: { battleId?: string }) {
    if (payload?.battleId) {
      void client.join(`battle:${payload.battleId}`);
      return { ok: true };
    }
    return { ok: false };
  }

  emitBattle(battleId: string, event: string, data: unknown) {
    this.server?.to(`battle:${battleId}`).emit(event, data);
  }
}
