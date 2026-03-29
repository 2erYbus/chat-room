require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8 // 100MB for signaling
});

app.use(express.static(path.join(__dirname, 'public')));

// Room structure: { host: socketId, guest: socketId | null }
// A room always has exactly 1 host. The guest slot can be replaced.
const rooms = new Map();

function removeSocketFromRoom(socket) {
  if (!socket.roomId) return;
  const roomId = socket.roomId;
  const room = rooms.get(roomId);
  if (!room) {
    socket.roomId = null;
    return;
  }

  if (room.host === socket.id) {
    // Host is leaving — destroy the entire room
    // Kick the guest if present
    if (room.guest) {
      const guestSocket = io.sockets.sockets.get(room.guest);
      if (guestSocket) {
        guestSocket.emit('peer-left');
        guestSocket.leave(roomId);
        guestSocket.roomId = null;
      }
    }
    rooms.delete(roomId);
    console.log(`[Room] Destroyed: ${roomId} (host left)`);
  } else if (room.guest === socket.id) {
    // Guest is leaving — free the guest slot
    room.guest = null;
    // Notify host
    const hostSocket = io.sockets.sockets.get(room.host);
    if (hostSocket) {
      hostSocket.emit('peer-left');
    }
    console.log(`[Room] Guest left: ${roomId}`);
  }

  socket.leave(roomId);
  socket.roomId = null;
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Create a new room (PC generates this)
  socket.on('create-room', (callback) => {
    // Clean up any previous room this socket was in
    removeSocketFromRoom(socket);

    const roomId = uuidv4().slice(0, 8);
    rooms.set(roomId, { host: socket.id, guest: null });
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`[Room] Created: ${roomId} by ${socket.id}`);
    callback({ roomId });
  });

  // Join an existing room (Mobile scans QR and joins)
  socket.on('join-room', (roomId, callback) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback({ error: 'Room not found' });
      return;
    }

    // Clean up any previous room this socket was in
    if (socket.roomId && socket.roomId !== roomId) {
      removeSocketFromRoom(socket);
    }

    // Check if host is still alive
    const hostSocket = io.sockets.sockets.get(room.host);
    if (!hostSocket || !hostSocket.connected) {
      // Host is dead — destroy room
      rooms.delete(roomId);
      console.log(`[Room] Destroyed: ${roomId} (host dead)`);
      callback({ error: 'Room not found' });
      return;
    }

    // If there's an existing guest, evict them (they're stale)
    if (room.guest && room.guest !== socket.id) {
      const oldGuest = io.sockets.sockets.get(room.guest);
      if (oldGuest) {
        console.log(`[Room] Evicting stale guest: ${room.guest} from ${roomId}`);
        oldGuest.emit('peer-left');
        oldGuest.leave(roomId);
        oldGuest.roomId = null;
      }
      room.guest = null;
    }

    // Add this socket as the guest
    room.guest = socket.id;
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`[Room] Joined: ${roomId} by ${socket.id}`);
    callback({ success: true });

    // Notify the host that someone joined
    socket.to(roomId).emit('peer-joined', socket.id);
  });

  // Explicit leave (called by client on goHome / disconnectPeer)
  socket.on('leave-room', () => {
    removeSocketFromRoom(socket);
  });

  // WebRTC signaling: relay offers, answers, and ICE candidates
  socket.on('signal', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('signal', {
        from: socket.id,
        signal: data.signal
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    removeSocketFromRoom(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`  P2P Messenger - Signaling Server`);
  console.log(`========================================`);
  console.log(`  Local:   http://localhost:${PORT}`);

  // Show LAN IP for QR code access
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  Network: http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`========================================\n`);
});
