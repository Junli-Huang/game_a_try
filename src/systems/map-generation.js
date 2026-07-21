const hashSeed = (value) => {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export function createSeededRandom(seed, savedState) {
  let state = Number.isInteger(savedState) ? savedState >>> 0 : hashSeed(seed) || 0x6d2b79f5;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  random.getState = () => state;
  random.setState = (nextState) => {
    if (Number.isInteger(nextState)) state = nextState >>> 0;
  };
  return random;
}

export function createExpeditionSeed(map) {
  if (map.random?.useFixedSeed) return String(map.random.seed || 'fog-default');
  return `${Date.now().toString(36)}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const keyOf = ({ x, y }) => `${x},${y}`;

export function generateRandomPlacements(map, monsterIds, seed, fixedPlacements = []) {
  const random = createSeededRandom(seed);
  const blocked = new Set((map.obstacles || []).map(keyOf));
  const occupied = new Set([
    keyOf(map.playerSpawn),
    ...(map.extractionPoints || [map.extractPoint]).map(keyOf),
    ...fixedPlacements.map(keyOf)
  ]);
  const generated = [];

  for (const rule of map.randomSpawnRules || []) {
    if (!rule.enabled || !monsterIds.has(rule.monsterConfigId)) continue;
    const min = Math.max(0, Math.floor(rule.minCount || 0));
    const max = Math.max(min, Math.floor(rule.maxCount ?? min));
    const count = min + Math.floor(random() * (max - min + 1));
    const area = rule.allowedArea || { x: 0, y: 0, width: map.width, height: map.height };
    let placed = 0;
    for (let attempt = 0; attempt < (rule.placementAttempts || 100) && placed < count; attempt += 1) {
      const point = {
        x: area.x + Math.floor(random() * Math.max(1, area.width)),
        y: area.y + Math.floor(random() * Math.max(1, area.height))
      };
      if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) continue;
      if (blocked.has(keyOf(point)) || occupied.has(keyOf(point))) continue;
      if ((rule.excludedAreas || []).some((rect) => point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height)) continue;
      const extracts = map.extractionPoints || [map.extractPoint];
      if (distance(point, map.playerSpawn) < (rule.minDistanceFromPlayerSpawn || 0)) continue;
      if (extracts.some((extract) => distance(point, extract) < (rule.minDistanceFromExtraction || 0))) continue;
      const existingPlacements = [...fixedPlacements, ...generated];
      if (existingPlacements.some((item) => distance(point, item) < (rule.minDistanceBetweenAnyMonster || 0))) continue;
      if (existingPlacements.some((item) => item.monsterId === rule.monsterConfigId && distance(point, item) < (rule.minDistanceBetweenSameType || 0))) continue;
      generated.push({ monsterId: rule.monsterConfigId, x: point.x, y: point.y, count: 1, randomRuleId: rule.id });
      occupied.add(keyOf(point));
      placed += 1;
    }
  }
  return generated;
}

export function trimMapToBounds(map) {
  const inside = ({ x, y }) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  map.obstacles = (map.obstacles || []).filter(inside);
  map.monsterSpawns = (map.monsterSpawns || []).filter(inside);
  map.extractionPoints = (map.extractionPoints || [map.extractPoint]).filter(inside);
  if (!map.extractionPoints.length) map.extractionPoints = [{ x: Math.max(0, map.width - 2), y: 1, requiredTurns: 3 }];
  map.extractPoint = map.extractionPoints[0];
  map.playerSpawn.x = Math.min(map.width - 1, Math.max(0, map.playerSpawn.x));
  map.playerSpawn.y = Math.min(map.height - 1, Math.max(0, map.playerSpawn.y));
  return map;
}
