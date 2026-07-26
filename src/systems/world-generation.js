import { createSeededRandom } from './map-generation.js';

export const WORLD_SAVE_VERSION = 1;

export const TERRAIN = Object.freeze({
  grass: { id: 'grass', walkable: true, pollution: 18 },
  dirt: { id: 'dirt', walkable: true, pollution: 24 },
  forest: { id: 'forest', walkable: true, pollution: 35 },
  shallow_water: { id: 'shallow_water', walkable: true, pollution: 28, moveCost: 2 },
  water: { id: 'water', walkable: false, pollution: 20 },
  rock: { id: 'rock', walkable: false, pollution: 42 },
  mud: { id: 'mud', walkable: true, pollution: 68, moveCost: 2 },
  corrupted: { id: 'corrupted', walkable: true, pollution: 145 }
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const keyOf = (x, y) => `${x},${y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function hash(seed, x, y, layer) {
  let value = 2166136261;
  const input = `${seed}:${layer}:${x}:${y}`;
  for (const char of input) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  value ^= value >>> 15;
  return (value >>> 0) / 4294967295;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(seed, x, y, scale, layer) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smoothstep(gx - x0);
  const ty = smoothstep(gy - y0);
  const a = hash(seed, x0, y0, layer);
  const b = hash(seed, x0 + 1, y0, layer);
  const c = hash(seed, x0, y0 + 1, layer);
  const d = hash(seed, x0 + 1, y0 + 1, layer);
  const top = a + (b - a) * tx;
  const bottom = c + (d - c) * tx;
  return top + (bottom - top) * ty;
}

function octaveNoise(seed, x, y, layer) {
  return valueNoise(seed, x, y, 30, `${layer}:large`) * .58
    + valueNoise(seed, x, y, 13, `${layer}:medium`) * .29
    + valueNoise(seed, x, y, 6, `${layer}:small`) * .13;
}

function chooseTerrain({ elevation, moisture, corruption }) {
  if (corruption > .78) return 'corrupted';
  if (elevation < .38) return 'water';
  if (elevation < .44) return 'shallow_water';
  if (elevation > .86) return 'rock';
  if (corruption > .57 && moisture > .52) return 'mud';
  if (moisture > .48) return 'forest';
  if (moisture < .36) return 'dirt';
  return 'grass';
}

function findRelicPosition(width, height, seed) {
  const random = createSeededRandom(`${seed}:relic`);
  return {
    x: clamp(Math.floor(width / 2) + Math.floor(random() * 7) - 3, 4, width - 5),
    y: clamp(Math.floor(height / 2) + Math.floor(random() * 7) - 3, 4, height - 5)
  };
}

function forceSafeStart(tiles, width, relic, radius) {
  for (const tile of tiles) {
    if (distance(tile, relic) > radius + 2) continue;
    tile.terrainId = distance(tile, relic) <= 2 ? 'grass' : tile.terrainId === 'water' || tile.terrainId === 'rock' ? 'dirt' : tile.terrainId;
    tile.walkable = TERRAIN[tile.terrainId].walkable;
    tile.pollution = Math.min(tile.pollution, 50);
  }
  const spawn = { x: Math.max(0, relic.x - 2), y: relic.y };
  const spawnTile = tiles[spawn.y * width + spawn.x];
  spawnTile.terrainId = 'grass';
  spawnTile.walkable = true;
  spawnTile.pollution = 12;
  return spawn;
}

function generateResources(tiles, width, height, seed, relic) {
  const random = createSeededRandom(`${seed}:resources`);
  const entities = [];
  for (const tile of tiles) {
    if (!tile.walkable || distance(tile, relic) <= 2) continue;
    const chance = random();
    const treeChance = tile.terrainId === 'forest' ? .24 : tile.terrainId === 'grass' ? .055 : 0;
    const rockChance = ['dirt', 'rock'].includes(tile.terrainId) ? .08 : .018;
    if (chance < treeChance) {
      entities.push({ id: `tree-${tile.x}-${tile.y}`, type: 'tree', x: tile.x, y: tile.y, health: 2, maxHealth: 2, drop: { wood: 2 }, respawnTurns: 80 });
    } else if (chance > 1 - rockChance) {
      entities.push({ id: `rock-${tile.x}-${tile.y}`, type: 'rock_node', x: tile.x, y: tile.y, health: 3, maxHealth: 3, drop: { stone: 2 }, respawnTurns: 0 });
    }
  }
  return entities;
}

export function generateWorld(config = {}) {
  const width = clamp(Math.floor(config.width || 100), 20, 200);
  const height = clamp(Math.floor(config.height || 100), 20, 200);
  const seed = String(config.seed || 'silent-relic-world');
  const relicPosition = findRelicPosition(width, height, seed);
  const maxDistance = Math.max(1, width + height);
  const tiles = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const elevation = octaveNoise(seed, x, y, 'elevation');
      const moisture = octaveNoise(seed, x, y, 'moisture');
      const radial = distance({ x, y }, relicPosition) / maxDistance;
      const corruption = clamp(radial * 1.65 + octaveNoise(seed, x, y, 'corruption') * .5 - .24, 0, 1);
      const terrainId = chooseTerrain({ elevation, moisture, corruption });
      tiles.push({
        x, y, terrainId,
        walkable: TERRAIN[terrainId].walkable,
        pollution: Math.round(Math.max(TERRAIN[terrainId].pollution, corruption * 170))
      });
    }
  }

  const relic = {
    id: 'silent-relic-0',
    type: 'silent_relic',
    x: relicPosition.x,
    y: relicPosition.y,
    radius: config.relicRadius ?? 5,
    madnessProtection: config.madnessProtection ?? 100,
    hungerProtection: config.hungerProtection !== false,
    purificationPower: config.purificationPower ?? 100
  };
  const playerSpawn = forceSafeStart(tiles, width, relic, relic.radius);
  const resources = generateResources(tiles, width, height, seed, relic);

  return {
    version: WORLD_SAVE_VERSION,
    id: config.id || 'world_01',
    seed,
    width,
    height,
    playerSpawn,
    relics: [relic],
    tiles,
    resources
  };
}

export function createWorldSave(world) {
  return {
    version: WORLD_SAVE_VERSION,
    worldId: world.id,
    seed: world.seed,
    playerPosition: { ...world.playerSpawn },
    inventory: { wood: 0, stone: 0 },
    resourceStates: {},
    discoveredRelicIds: [],
    turn: 0
  };
}

export function migrateWorldSave(value, world) {
  const initial = createWorldSave(world);
  if (!value || typeof value !== 'object' || value.worldId !== world.id || value.seed !== world.seed) return initial;
  return {
    ...initial,
    ...value,
    version: WORLD_SAVE_VERSION,
    playerPosition: { ...initial.playerPosition, ...(value.playerPosition || {}) },
    inventory: { ...initial.inventory, ...(value.inventory || {}) },
    resourceStates: value.resourceStates && typeof value.resourceStates === 'object' ? { ...value.resourceStates } : {},
    discoveredRelicIds: Array.isArray(value.discoveredRelicIds) ? [...new Set(value.discoveredRelicIds)] : []
  };
}

export function applyWorldState(world, worldSave) {
  const states = worldSave?.resourceStates || {};
  return world.resources.map((resource) => ({ ...resource, ...(states[resource.id] || {}) }));
}

export function isInsideRelicRange(position, relic) {
  return distance(position, relic) <= relic.radius;
}

export function terrainAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
  return world.tiles[y * world.width + x];
}

export function createWorldMapConfig(world, legacyMap = {}) {
  const relic = world.relics[0];
  const centerX = relic.x - 10;
  const centerY = relic.y - 10;
  const translate = (point) => ({
    ...point,
    x: clamp(centerX + point.x, 0, world.width - 1),
    y: clamp(centerY + point.y, 0, world.height - 1)
  });
  return {
    ...legacyMap,
    id: world.id,
    name: '静默原野',
    width: world.width,
    height: world.height,
    playerSpawn: { ...world.playerSpawn },
    extractPoint: null,
    extractionPoints: [],
    obstacles: world.tiles.filter((tile) => !tile.walkable).map(({ x, y }) => ({ x, y })),
    monsterSpawns: (legacyMap.monsterSpawns || []).map(translate),
    randomSpawnRules: [],
    random: { useFixedSeed: true, seed: world.seed }
  };
}
