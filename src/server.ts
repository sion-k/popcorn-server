import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const server = createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: '*', // Change this to your frontend URL in production
    methods: ['GET', 'POST'],
  },
});

interface RoomState {
  players: string[];
  table: number[][] | null;
  score: number;
  duration: number;
  pointers: Map<string, { x: number; y: number }>;
  selectedArea: Map<string, { r1: number; c1: number; r2: number; c2: number }>;
}

function emitAreaUpdate(
  io: Server,
  roomId: string,
  playerId: string,
  newArea?: { r1: number; c1: number; r2: number; c2: number },
) {
  io.to(roomId).emit('areaUpdated', {
    playerId,
    newArea: newArea,
  });
}

function availableAreaExists(table: number[][]) {
  const n = table.length;
  const m = table[0].length;

  for (let r1 = 0; r1 < n; r1++) {
    for (let r2 = r1; r2 < n; r2++) {
      for (let c1 = 0; c1 < m; c1++) {
        for (let c2 = c1; c2 < m; c2++) {
          let sum = 0;
          for (let r = r1; r <= r2; r++) {
            for (let c = c1; c <= c2; c++) {
              sum += table[r][c];
            }
          }
          if (sum === 10) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

const rooms = new Map<string, RoomState>();
const player_room = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`A player connected: ${socket.id}`);

  socket.on('createRoom', () => {
    const roomId = socket.id;
    rooms.set(roomId, {
      players: [socket.id],
      table: null,
      score: 0,
      duration: 0,
      pointers: new Map(),
      selectedArea: new Map(),
    });
    socket.emit('roomCreated', { roomId });
  });

  socket.on('joinRoom', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    room!.players.push(socket.id);
    player_room.set(socket.id, roomId);
    socket.join(roomId);
    socket.emit('roomJoined', room);
  });

  socket.on('startGame', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    const N = 10;
    const M = 17;
    room!.table = Array.from({ length: N }, () =>
      Array.from({ length: M }, () => Math.floor(Math.random() * 9) + 1),
    );
    const duration = 2 * 60;
    room!.duration = duration;
    room!.score = 0;

    io.to(roomId).emit('gameStarted', room);

    setTimeout(() => {
      io.to(roomId).emit('gameOvered');
    }, duration * 1000);
  });

  socket.on('pointerCoords', ({ x, y }: { x: number; y: number }) => {
    const roomId = player_room.get(socket.id);
    const room = rooms.get(roomId!);
    room!.pointers.set(socket.id, { x, y });
    io.to(roomId!).emit('pointerUpdated', { playerId: socket.id, x, y });
  });

  socket.on('downPointer', ({ r, c }: { r: number; c: number }) => {
    const roomId = player_room.get(socket.id);
    const room = rooms.get(roomId!);
    room!.selectedArea.set(socket.id, { r1: r, c1: c, r2: r, c2: c });
    emitAreaUpdate(io, roomId!, socket.id, room!.selectedArea.get(socket.id));
  });

  socket.on('movePointer', ({ r, c }: { r: number; c: number }) => {
    const roomId = player_room.get(socket.id);
    const room = rooms.get(roomId!);
    const selectedArea = room!.selectedArea.get(socket.id);
    selectedArea!.r2 = r;
    selectedArea!.c2 = c;
    emitAreaUpdate(io, roomId!, socket.id, selectedArea);
  });

  socket.on('upPointer', () => {
    const roomId = player_room.get(socket.id);
    const room = rooms.get(roomId!);
    room!.selectedArea.delete(socket.id);
    io.to(roomId!).emit('areaUnselected', { playerId: socket.id });
  });

  socket.on('tryPop', () => {
    const roomId = player_room.get(socket.id);
    const room = rooms.get(roomId!);
    const selectedArea = room!.selectedArea.get(socket.id);
    if (selectedArea === undefined) {
      throw new Error('Selected area not found');
    }

    const { r1, c1, r2, c2 } = selectedArea;
    let sum = 0;
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
        sum += room!.table![r][c];
      }
    }

    if (sum === 10) {
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
          room!.table![r][c] = 0;
        }
      }
      room!.score += Math.abs(r1 - r2 + 1) * Math.abs(c1 - c2 + 1);
      io.to(roomId!).emit('popSucceeded', {
        score: room!.score,
        table: room!.table,
      });

      if (!availableAreaExists(room!.table!)) {
        const N = 10;
        const M = 17;
        room!.table = Array.from({ length: N }, () =>
          Array.from({ length: M }, () => Math.floor(Math.random() * 9) + 1),
        );
        io.to(roomId!).emit('tableRefreshed', {
          table: room!.table,
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`A player disconnected: ${socket.id}`);
    const roomId = player_room.get(socket.id);
    if (roomId === undefined) {
      return;
    }

    const room = rooms.get(roomId);
    if (room === undefined) {
      return;
    }

    if (room.players.includes(socket.id)) {
      player_room.delete(socket.id);
      room.players = room.players.filter((playerId) => playerId !== socket.id);
      room.pointers.delete(socket.id);
      room.selectedArea.delete(socket.id);
      io.to(roomId!).emit('leaveRoom', socket.id);
    }
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on http://localhost:${PORT}`);
});
