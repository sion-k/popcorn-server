import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { registerSocketEvents } from './events';

export function setupSocketServer(server: HTTPServer) {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`A player connected: ${socket.id}`);
    registerSocketEvents(io, socket); // Delegate event handling
  });
}
