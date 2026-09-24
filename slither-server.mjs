import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_PLAYERS = 20;
const ARENA_RADIUS = 58;
const PELLET_COUNT = 96;
const MAX_LENGTH = 60;
const players = new Map();
const pendingSockets = new Set();

function randomPoint(radius = ARENA_RADIUS - 6) {
  const angle = Math.random() * Math.PI * 2;
  const distance = Math.sqrt(Math.random()) * radius;
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
}

const pellets = Array.from({ length: PELLET_COUNT }, randomPoint);

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color,
    x: player.x,
    z: player.z,
    angle: player.angle,
    length: player.length,
    score: player.score,
    alive: player.alive,
  };
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(message, except = null) {
  const payload = JSON.stringify(message);
  for (const player of players.values()) {
    if (player.socket !== except && player.socket.readyState === WebSocket.OPEN) player.socket.send(payload);
  }
}

const httpServer = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, players: players.size, capacity: MAX_PLAYERS }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const webSocketServer = new WebSocketServer({
  server: httpServer,
  path: '/slither',
  maxPayload: 2048,
  perMessageDeflate: false,
});

webSocketServer.on('connection', (socket) => {
  socket.on('error', () => socket.terminate());
  if (players.size + pendingSockets.size >= MAX_PLAYERS) {
    send(socket, { type: 'full', capacity: MAX_PLAYERS });
    socket.close(1013, 'Arena is full');
    return;
  }

  pendingSockets.add(socket);
  let player = null;
  const joinTimeout = setTimeout(() => {
    if (player) return;
    pendingSockets.delete(socket);
    send(socket, { type: 'error', code: 'nickname_required' });
    socket.close(1008, 'Nickname required');
  }, 5000);
  joinTimeout.unref();

  socket.on('message', (raw) => {
    const now = Date.now();
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.close(1003, 'Invalid message');
      return;
    }
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      socket.close(1003, 'Invalid message');
      return;
    }

    if (!player) {
      if (message.type !== 'join') {
        send(socket, { type: 'error', code: 'nickname_required' });
        socket.close(1008, 'Nickname required');
        return;
      }
      const name = typeof message.name === 'string' ? message.name.normalize('NFKC') : '';
      if (!/^[\p{L}\p{N}]{2,5}$/u.test(name)) {
        send(socket, { type: 'error', code: 'nickname_invalid' });
        socket.close(1008, 'Invalid nickname');
        return;
      }
      const nameKey = name.toLowerCase();
      if ([...players.values()].some((existing) => existing.nameKey === nameKey)) {
        send(socket, { type: 'error', code: 'nickname_taken' });
        socket.close(1008, 'Nickname already taken');
        return;
      }
      pendingSockets.delete(socket);
      clearTimeout(joinTimeout);
      if (players.size >= MAX_PLAYERS) {
        send(socket, { type: 'full', capacity: MAX_PLAYERS });
        socket.close(1013, 'Arena is full');
        return;
      }

      const spawn = randomPoint(ARENA_RADIUS * 0.5);
      player = {
        id: randomUUID(),
        name,
        nameKey,
        color: Math.floor(Math.random() * 3),
        x: spawn.x,
        z: spawn.z,
        angle: Math.random() * Math.PI * 2,
        length: 14,
        score: 0,
        alive: true,
        lastUpdate: Date.now(),
        lastDrop: 0,
        lastRespawn: 0,
        socket,
      };
      players.set(player.id, player);
      send(socket, {
        type: 'welcome',
        you: publicPlayer(player),
        players: [...players.values()].filter((other) => other !== player).map(publicPlayer),
        pellets,
      });
      broadcast({ type: 'join', player: publicPlayer(player) }, socket);
      return;
    }

    if (message.type === 'respawn') {
      if (now - player.lastRespawn < 1000) return;
      player.lastRespawn = now;
      const point = randomPoint(ARENA_RADIUS * 0.5);
      player.x = point.x;
      player.z = point.z;
      player.angle = Math.random() * Math.PI * 2;
      player.length = 14;
      player.score = 0;
      player.alive = true;
      player.lastUpdate = now;
      broadcast({ type: 'state', player: publicPlayer(player), pellets: [], reset: true });
      return;
    }

    if (message.type === 'drop') {
      if (now - player.lastDrop < 1000) return;
      player.lastDrop = now;
      if (!player.alive || ![message.x, message.z].every(Number.isFinite)) return;
      if (Math.abs(message.x) > ARENA_RADIUS || Math.abs(message.z) > ARENA_RADIUS) return;
      player.length = Math.max(8, player.length - 1);
      const point = { x: message.x, z: message.z };
      const index = pellets.reduce((closest, pellet, current) => (
        Math.hypot(point.x - pellet.x, point.z - pellet.z) < Math.hypot(point.x - pellets[closest].x, point.z - pellets[closest].z) ? current : closest
      ), 0);
      pellets[index] = point;
      broadcast({ type: 'state', player: publicPlayer(player), pellets: [{ index, ...pellets[index] }] });
      return;
    }

    if (message.type !== 'state') return;
    if (now - player.lastUpdate < 30) return;
    if (![message.x, message.z, message.angle].every(Number.isFinite)) return;
    if (Math.abs(message.x) > ARENA_RADIUS + 5 || Math.abs(message.z) > ARENA_RADIUS + 5) return;
    const elapsed = player.lastUpdate ? (now - player.lastUpdate) / 1000 : 1;
    if (player.lastUpdate && Math.hypot(message.x - player.x, message.z - player.z) > elapsed * 10 + 1) return;
    player.lastUpdate = now;

    player.x = message.x;
    player.z = message.z;
    player.angle = Math.atan2(Math.sin(message.angle), Math.cos(message.angle));
    player.alive = message.alive === true;

    const changedPellets = [];
    if (player.alive) {
      for (let index = 0; index < pellets.length; index += 1) {
        const pellet = pellets[index];
        if (Math.hypot(player.x - pellet.x, player.z - pellet.z) >= 0.9) continue;
        player.score += 1;
        player.length = Math.min(MAX_LENGTH, player.length + 1);
        pellets[index] = randomPoint();
        changedPellets.push({ index, ...pellets[index] });
      }
    }

    broadcast({ type: 'state', player: publicPlayer(player), pellets: changedPellets });
  });

  socket.on('close', () => {
    clearTimeout(joinTimeout);
    pendingSockets.delete(socket);
    if (!player || !players.delete(player.id)) return;
    broadcast({ type: 'leave', id: player.id });
  });

  socket.on('pong', () => { socket.isAlive = true; });
  socket.isAlive = true;
});

const heartbeat = setInterval(() => {
  for (const socket of webSocketServer.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000);
heartbeat.unref();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Slither server listening on port ${PORT} (max ${MAX_PLAYERS} players)`);
});
