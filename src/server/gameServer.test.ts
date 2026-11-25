import test from 'node:test';
import assert from 'node:assert/strict';
import { ArenaGameServer } from './gameServer';

test('ArenaGameServer seeds 3 distinct maps and creates custom rooms', () => {
  const srv = new ArenaGameServer();
  const initial = srv.listRooms();
  assert.equal(initial.length, 3);
  const maps = new Set(initial.map((r) => r.mapId));
  assert.equal(maps.size, 3);

  const custom = srv.createRoom({
    name: 'West Coast Skirmish',
    mapId: 'borealis-citadel',
    mode: 'skirmish',
    maxPlayers: 10,
    fillBots: true,
  });
  assert.equal(custom.name, 'West Coast Skirmish');
  assert.equal(custom.mapId, 'borealis-citadel');
  assert.equal(custom.scoreLimit, 20);
  assert.equal(srv.listRooms().length, 4);
  srv.dispose();
});

test('ArenaGameServer matchmaker honors preferred map when open', () => {
  const srv = new ArenaGameServer();
  const matched = srv.findBestMatchRoom('helios-outpost');
  assert.equal(matched.mapId, 'helios-outpost');
  srv.dispose();
});
