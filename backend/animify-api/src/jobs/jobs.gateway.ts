import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/jobs',
  cors: { origin: true, credentials: true },
})
export class JobsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(JobsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify(token);
      const userId = payload.sub as string;
      client.data.userId = userId;
      await client.join(`user:${userId}`);
      this.logger.debug(`WS connected user=${userId}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { jobId?: string }) {
    if (body?.jobId) {
      client.join(`job:${body.jobId}`);
    }
    return { ok: true };
  }

  emitJobUpdate(userId: string, payload: Record<string, unknown>) {
    this.server?.to(`user:${userId}`).emit('job.update', payload);
    if (payload.jobId) {
      this.server?.to(`job:${payload.jobId}`).emit('job.update', payload);
    }
  }
}
