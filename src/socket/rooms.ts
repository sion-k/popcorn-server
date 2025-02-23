import { Server, Socket } from 'socket.io';

// Store room data in memory
const rooms: Map<string, Map<string, any>> = new Map();

export function joinRoom(io: Server, socket: Socket, roomId: string) {
  socket.join(roomId);

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  console.log(`Player ${socket.id} joined room ${roomId}`);
}
