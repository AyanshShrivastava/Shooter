import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { ArenaGameServer } from './src/server/gameServer';
import { GameMode, MapId } from './src/shared/types';

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  const gameServer = new ArenaGameServer();
  gameServer.attachWebSocketServer(wss);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, onlineCount: gameServer.getOnlineCount() });
  });

  app.get('/api/servers', (_req, res) => {
    res.json({
      onlineCount: gameServer.getOnlineCount(),
      rooms: gameServer.listRooms(),
    });
  });

  app.post('/api/servers', (req, res) => {
    const { name, mapId, mode, maxPlayers, fillBots } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Server name must be at least 2 characters.' });
      return;
    }
    const room = gameServer.createRoom({
      name: name.trim(),
      mapId: mapId as MapId,
      mode: mode as GameMode,
      maxPlayers: Number(maxPlayers) || 8,
      fillBots: fillBots !== false,
    });
    res.status(201).json({ room });
  });

  app.post('/api/matchmake', (req, res) => {
    const { preferredMapId } = req.body ?? {};
    const room = gameServer.findBestMatchRoom(preferredMapId as MapId | undefined);
    res.json({ room });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`Vanguard Arena server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Vanguard Arena server:', err);
  process.exit(1);
});
