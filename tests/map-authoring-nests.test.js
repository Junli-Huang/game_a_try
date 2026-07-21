import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { ConfigService } from '../src/config/config-service.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';
import { MapEventService } from '../src/systems/map-event-service.js';
import { createSeededRandom, generateRandomPlacements, trimMapToBounds } from '../src/systems/map-generation.js';

const canvas = () => ({ width: 0, height: 0, getContext: () => ({}), addEventListener() {}, removeEventListener() {} });

test('seeded random produces a stable sequence', () => {
  const first = createSeededRandom('same-seed');
  const second = createSeededRandom('same-seed');
  assert.deepEqual(Array.from({ length: 8 }, first), Array.from({ length: 8 }, second));
});

test('seeded random resumes at the exact saved state', () => {
  const original = createSeededRandom('resume-seed');
  Array.from({ length: 7 }, original);
  const savedState = original.getState();
  const expected = Array.from({ length: 8 }, original);
  const restored = createSeededRandom('resume-seed', savedState);
  assert.deepEqual(Array.from({ length: 8 }, restored), expected);
});

test('random placements are stable and avoid reserved cells', () => {
  const config = cloneDefaultConfig();
  const map = config.maps[0];
  const ids = new Set(config.monsters.map((item) => item.id));
  const first = generateRandomPlacements(map, ids, 'stable', map.monsterSpawns);
  const second = generateRandomPlacements(map, ids, 'stable', map.monsterSpawns);
  assert.deepEqual(first, second);
  const blocked = new Set(map.obstacles.map((item) => `${item.x},${item.y}`));
  assert.ok(first.every((item) => !blocked.has(`${item.x},${item.y}`)));
  assert.ok(first.every((item) => item.x !== map.playerSpawn.x || item.y !== map.playerSpawn.y));
});

test('random placement stops when a map has no free space', () => {
  const config = cloneDefaultConfig();
  const map = config.maps[0];
  map.obstacles = Array.from({ length: map.width * map.height }, (_, index) => ({ x: index % map.width, y: Math.floor(index / map.width) }));
  map.randomSpawnRules[0].placementAttempts = 5;
  assert.deepEqual(generateRandomPlacements(map, new Set(config.monsters.map((item) => item.id)), 'blocked'), []);
});

test('map validation accepts 40 and 50 square maps and rejects 51', () => {
  const service = new ConfigService();
  for (const size of [40, 50]) {
    const config = cloneDefaultConfig();
    config.maps[0].width = size; config.maps[0].height = size;
    assert.equal(service.validateConfig(config).valid, true);
  }
  const invalid = cloneDefaultConfig(); invalid.maps[0].width = 51;
  assert.equal(service.validateConfig(invalid).valid, false);
});

test('shrinking a map removes out-of-bounds authoring objects', () => {
  const map = cloneDefaultConfig().maps[0];
  map.obstacles.push({ x: 19, y: 19 });
  map.monsterSpawns.push({ monsterId: 'passive', x: 18, y: 18, count: 1 });
  map.width = 10; map.height = 10;
  trimMapToBounds(map);
  assert.ok(map.obstacles.every((item) => item.x < 10 && item.y < 10));
  assert.ok(map.monsterSpawns.every((item) => item.x < 10 && item.y < 10));
});

function nestRuntime() {
  const config = cloneDefaultConfig();
  const runtime = new GridExplorationRuntime(canvas(), config, { madness: 0, farm: {}, activeExpedition: null });
  runtime.tiles = runtime.createTiles();
  runtime.player = { x: 1, y: 1, health: 100, hunger: 100, madness: 0, loot: { monsterMeat: 0 } };
  runtime.corpses = [];
  runtime.visitedTiles = new Set(['1,1']);
  runtime.seenSpawnerIds = new Set();
  runtime.random = createSeededRandom('nest-test');
  const nestConfig = config.monsters.find((item) => item.id === 'basic_nest');
  nestConfig.spawnConfig.initialDelayTurns = 1;
  nestConfig.spawnConfig.intervalTurns = 1;
  const nest = { id: 'nest-test', config: nestConfig, x: 10, y: 10, homeX: 10, homeY: 10, health: 30, state: 'Idle', spawnTurnsLeft: 1, spawnedTotal: 0 };
  runtime.monsters = [nest];
  return { runtime, nest, spawn: nestConfig.spawnConfig };
}

test('nest spawns children, respects alive cap, and resumes after a child dies', () => {
  const { runtime, nest, spawn } = nestRuntime();
  spawn.maxAliveChildren = 1;
  runtime.updateSpawners();
  assert.equal(runtime.monsters.filter((item) => item.spawnedByMonsterId === nest.id).length, 1);
  runtime.updateSpawners();
  assert.equal(runtime.monsters.length, 2);
  runtime.monsters = runtime.monsters.filter((item) => !item.spawnedByMonsterId);
  runtime.updateSpawners();
  assert.equal(runtime.monsters.filter((item) => item.spawnedByMonsterId === nest.id).length, 1);
});

test('dead nest stops spawning while existing children survive', () => {
  const { runtime, nest } = nestRuntime();
  runtime.updateSpawners();
  const child = runtime.monsters.find((item) => item.spawnedByMonsterId === nest.id);
  nest.health = 0;
  runtime.updateSpawners();
  assert.ok(runtime.monsters.includes(child));
  assert.equal(nest.spawnedTotal, 1);
});

test('nest first entering vision emits one discovery notice', () => {
  const { runtime, nest } = nestRuntime();
  const notices = [];
  runtime.config.ui.showEnemyAlert = false;
  runtime.callbacks.onNotice = (notice) => notices.push(notice);
  runtime.player.x = nest.x - runtime.mapConfig.fogOfWar.visionRadius;
  runtime.player.y = nest.y;
  runtime.updateVision();
  runtime.updateVision();
  assert.equal(notices.filter((notice) => notice.type === 'nest-sighted').length, 1);
  assert.match(notices[0].message, /巢穴|蠕动/);
});

test('nest enforces its lifetime output cap', () => {
  const { runtime, nest, spawn } = nestRuntime();
  spawn.maxAliveChildren = 10;
  spawn.maxTotalChildren = 2;
  runtime.updateSpawners();
  runtime.updateSpawners();
  runtime.updateSpawners();
  assert.equal(nest.spawnedTotal, 2);
  assert.equal(runtime.monsters.filter((monster) => monster.spawnedByMonsterId === nest.id).length, 2);
});

test('nest skips a spawn cycle when there is no legal tile', () => {
  const { runtime, nest, spawn } = nestRuntime();
  runtime.tiles.forEach((tile) => { tile.walkable = false; });
  runtime.updateSpawners();
  assert.equal(runtime.monsters.length, 1);
  assert.equal(nest.spawnedTotal, 0);
  assert.equal(nest.spawnTurnsLeft, spawn.intervalTurns);
});

test('expedition snapshot restores RNG progress and nest countdown exactly', () => {
  const { runtime, nest } = nestRuntime();
  runtime.running = true;
  runtime.seed = 'snapshot-seed';
  runtime.turn = 4;
  runtime.random = createSeededRandom(`${runtime.seed}:runtime`);
  runtime.eventService = new MapEventService(runtime.config, runtime.random);
  Array.from({ length: 5 }, runtime.random);
  nest.spawnTurnsLeft = 4;
  nest.spawnedTotal = 2;
  runtime.eventService.triggered.add('torn_note');
  runtime.eventService.count = 2;
  runtime.eventService.lastStep = 3;
  runtime.persistExpedition();
  const expectedRandom = Array.from({ length: 6 }, runtime.random);

  const restored = new GridExplorationRuntime(canvas(), runtime.config, runtime.save);
  restored.tiles = restored.createTiles();
  restored.player = { x: 1, y: 1, health: 100, hunger: 100, madness: 0, loot: { monsterMeat: 0 } };
  restored.monsters = restored.spawnMonsters();
  restored.corpses = [];
  restored.visitedTiles = new Set(['1,1']);
  restored.seenSpawnerIds = new Set();
  restored.seed = runtime.seed;
  restored.random = createSeededRandom(`${restored.seed}:runtime`);
  restored.eventService = new MapEventService(restored.config, restored.random);
  restored.restoreExpedition();

  const restoredNest = restored.monsters.find((monster) => monster.id === nest.id);
  assert.equal(restoredNest.spawnTurnsLeft, 4);
  assert.equal(restoredNest.spawnedTotal, 2);
  assert.deepEqual([...restored.eventService.triggered], ['torn_note']);
  assert.equal(restored.eventService.count, 2);
  assert.equal(restored.eventService.lastStep, 3);
  assert.deepEqual(Array.from({ length: 6 }, restored.random), expectedRandom);
});

test('legacy expedition snapshot fills missing loot and nest progress fields', () => {
  const config = cloneDefaultConfig();
  const nestConfig = config.monsters.find((monster) => monster.id === 'basic_nest');
  const save = {
    madness: 0,
    farm: {},
    activeExpedition: {
      mapId: config.maps[0].id,
      seed: 'legacy',
      turn: 3,
      player: { x: 2, y: 2, health: 90, hunger: 70, madness: 4 },
      monsters: [{ id: 'legacy-nest', configId: nestConfig.id, x: 8, y: 8, homeX: 8, homeY: 8, health: nestConfig.health, state: 'Idle' }]
    }
  };
  const runtime = new GridExplorationRuntime(canvas(), config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = { x: 1, y: 1, health: 100, hunger: 100, madness: 0, loot: { monsterMeat: 0 } };
  runtime.monsters = [];
  runtime.corpses = [];
  runtime.visitedTiles = new Set(['1,1']);
  runtime.seenSpawnerIds = new Set();
  runtime.seed = 'legacy';
  runtime.random = createSeededRandom('legacy:runtime');
  runtime.restoreExpedition();

  assert.deepEqual(runtime.player.loot, { monsterMeat: 0 });
  assert.equal(runtime.monsters[0].spawnTurnsLeft, nestConfig.spawnConfig.initialDelayTurns);
  assert.equal(runtime.monsters[0].spawnedTotal, 0);
  assert.deepEqual([...runtime.visitedTiles], ['1,1']);
});
