import { Server, Socket } from 'socket.io';
import { joinRoom } from './rooms';

export function registerSocketEvents(io: Server, socket: Socket) {
  socket.on('joinRoom', (roomId: string) => joinRoom(io, socket, roomId));
}
