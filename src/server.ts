import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  tryPop,
  availableAreaExists,
  generateTable,
  RoomState,
  type Pointer,
  joinGame,
} from './game.js';

const app = express();
const server = createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: '*', // Change this to your frontend URL in production
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map<string, RoomState>();
const playerToRoomMap = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`A player connected: ${socket.id}`);

  socket.on('createRoom', () => {
    const roomId = socket.id;
    const playerId = socket.id;

    const newRoom = {
      roomId,
      players: new Map(),
      table: {
        n: 10,
        m: 17,
        table: [[]],
      },
      score: 0,
      duration: 0,
    };
    joinGame(newRoom, playerId);

    rooms.set(roomId, newRoom);
    playerToRoomMap.set(playerId, roomId);
    socket.join(roomId);
    socket.emit('roomCreated', newRoom);
  });

  socket.on('joinRoom', ({ roomId }: { roomId: string }) => {
    const playerId = socket.id;
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    joinGame(room, playerId);

    playerToRoomMap.set(playerId, roomId);
    socket.join(roomId);
    socket.emit('roomJoined', room);
  });

  socket.on('startGame', () => {
    const roomId = playerToRoomMap.get(socket.id);
    if (roomId === undefined) {
      throw new Error("Player's Room not found");
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }

    rooms.set(roomId, {
      ...room,
      table: generateTable(room.table),
      score: 0,
      duration: 120,
    });

    io.to(roomId).emit('gameStarted', room);

    setTimeout(() => {
      io.to(roomId).emit('gameOvered');
    }, room.duration * 1000);
  });

  socket.on('pointerCoords', ({ x, y }: Pointer) => {
    const playerId = socket.id;
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      throw new Error('RoomId not found');
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player not found');
    }
    room.players.set(playerId, { ...player, pointer: { x, y } });
    io.to(roomId!).emit('pointerUpdated', player);
  });

  socket.on('downPointer', ({ r, c }: { r: number; c: number }) => {
    const playerId = socket.id;
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      throw new Error('RoomId not found');
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player not found');
    }

    player.selectedArea = { r1: r, c1: c, r2: r, c2: c };
    io.to(roomId).emit('playerUpdated', player);
  });

  socket.on('movePointer', ({ r, c }: { r: number; c: number }) => {
    const playerId = socket.id;
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      throw new Error('RoomId not found');
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    const player = room.players.get(socket.id);
    if (player === undefined) {
      throw new Error('Player not found');
    }
    const selectedArea = player.selectedArea;
    if (selectedArea === null) {
      throw new Error('Selected area not found while moving pointer');
    }

    selectedArea.r2 = r;
    selectedArea.c2 = c;
    io.to(roomId).emit('playerUpdated', player);
  });

  socket.on('upPointer', () => {
    const playerId = socket.id;
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      throw new Error('RoomId not found');
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player not found');
    }

    player.selectedArea = null;
    io.to(roomId).emit('playerUpdated', player);
  });

  socket.on('tryPop', () => {
    const playerId = socket.id;
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      throw new Error('RoomId not found');
    }
    const room = rooms.get(roomId);
    if (room === undefined) {
      throw new Error('Room not found');
    }
    const player = room.players.get(playerId);
    if (player === undefined) {
      throw new Error('Player not found');
    }
    const selectedArea = player.selectedArea;
    if (selectedArea === null) {
      throw new Error('Selected area not found');
    }

    const popScore = tryPop(room.table, selectedArea);
    if (popScore != 0) {
      room.score += popScore;
      io.to(roomId).emit('scoreUpdated', {
        score: room.score,
      });
    }

    io.to(roomId).emit('tableUpdated', {
      table: room.table,
    });

    if (!availableAreaExists(room.table)) {
      room.table = generateTable(room.table);
      io.to(roomId).emit('tableUpdated', {
        table: room.table,
      });
    }
  });

  socket.on('disconnect', () => {
    const playerId = socket.id;
    console.log(`A player disconnected: ${playerId}`);
    const roomId = playerToRoomMap.get(playerId);
    if (roomId === undefined) {
      return;
    }

    const room = rooms.get(roomId);
    if (room === undefined) {
      return;
    }

    room.players.delete(socket.id);
    io.to(roomId!).emit('leaveRoom', playerId);
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on http://localhost:${PORT}`);
});
