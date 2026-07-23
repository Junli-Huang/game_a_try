export const DIRECTIONS = ['north', 'east', 'south', 'west'];

export const DIRECTION_VECTORS = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 }
};

const keyOf = (x, y) => `${x},${y}`;

export function directionFromDelta(dx, dy, fallback = 'south') {
  if (!dx && !dy) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

export function directionToward(origin, target, fallback = 'south') {
  if (!target) return fallback;
  return directionFromDelta(target.x - origin.x, target.y - origin.y, fallback);
}

export function rotateDirection(facing, turn) {
  const index = Math.max(0, DIRECTIONS.indexOf(facing));
  if (turn === 'left') return DIRECTIONS[(index + 3) % 4];
  if (turn === 'right') return DIRECTIONS[(index + 1) % 4];
  return DIRECTIONS[index];
}

export function stableDirection(seed = '') {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return DIRECTIONS[(hash >>> 0) % DIRECTIONS.length];
}

export function traceGridLine(origin, target) {
  const cells = [];
  let x = origin.x;
  let y = origin.y;
  const dx = Math.abs(target.x - origin.x);
  const dy = Math.abs(target.y - origin.y);
  const sx = origin.x < target.x ? 1 : -1;
  const sy = origin.y < target.y ? 1 : -1;
  let error = dx - dy;

  while (x !== target.x || y !== target.y) {
    const twice = error * 2;
    if (twice > -dy) { error -= dy; x += sx; }
    if (twice < dx) { error += dx; y += sy; }
    cells.push({ x, y });
  }
  return cells;
}

export function hasLineOfSight(origin, target, isBlocking) {
  const line = traceGridLine(origin, target);
  for (let index = 0; index < line.length - 1; index += 1) {
    if (isBlocking(line[index].x, line[index].y)) return false;
  }
  return true;
}

export function getVisionCells(origin, facing, config, map) {
  if (!config?.enabled || config.range <= 0) return [];
  const forward = DIRECTION_VECTORS[facing] || DIRECTION_VECTORS.south;
  const halfAngle = Math.max(0, Math.min(360, config.angle)) / 2;
  const minX = Math.max(0, origin.x - config.range);
  const maxX = Math.min(map.width - 1, origin.x + config.range);
  const minY = Math.max(0, origin.y - config.range);
  const maxY = Math.min(map.height - 1, origin.y + config.range);
  const cells = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (x === origin.x && y === origin.y) continue;
      const dx = x - origin.x;
      const dy = y - origin.y;
      const distance = Math.hypot(dx, dy);
      if (distance > config.range) continue;
      const cosine = Math.max(-1, Math.min(1, (dx * forward.x + dy * forward.y) / distance));
      const angle = Math.acos(cosine) * 180 / Math.PI;
      if (angle > halfAngle + 1e-9) continue;
      if (!hasLineOfSight(origin, { x, y }, (blockX, blockY) => !map.tileAt(blockX, blockY)?.walkable)) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

export function canEnemySeePlayer(enemy, playerPosition, map) {
  if (!enemy || enemy.health <= 0 || enemy.config?.spawnConfig?.enabled) return false;
  return getVisionCells(enemy, enemy.facing, enemy.config?.vision, map)
    .some((cell) => cell.x === playerPosition.x && cell.y === playerPosition.y);
}

export function visionCellSet(origin, facing, config, map) {
  return new Set(getVisionCells(origin, facing, config, map).map((cell) => keyOf(cell.x, cell.y)));
}
