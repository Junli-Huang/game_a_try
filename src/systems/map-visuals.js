import { DIRECTION_VECTORS } from './grid-vision.js';

export const keyOf = (x, y) => `${x},${y}`;

export function visionTone(state) {
  if (state === 'Chase' || state === 'AttackIntent') return 'danger';
  if (state === 'Alert') return 'alert';
  if (state === 'Cooldown') return 'cooldown';
  return 'normal';
}

export function visionPalette(tone) {
  return {
    danger: { core: 'rgba(196,67,75,.24)', edge: 'rgba(224,82,88,.06)', line: 'rgba(244,121,112,.48)' },
    alert: { core: 'rgba(198,132,58,.21)', edge: 'rgba(225,164,83,.05)', line: 'rgba(239,188,105,.43)' },
    cooldown: { core: 'rgba(160,144,83,.10)', edge: 'rgba(190,177,105,.025)', line: 'rgba(204,192,128,.24)' },
    normal: { core: 'rgba(184,154,74,.15)', edge: 'rgba(218,190,103,.035)', line: 'rgba(231,205,125,.34)' }
  }[tone] || {
    core: 'rgba(184,154,74,.15)', edge: 'rgba(218,190,103,.035)', line: 'rgba(231,205,125,.34)'
  };
}

export function directionAngle(facing = 'south') {
  const vector = DIRECTION_VECTORS[facing] || DIRECTION_VECTORS.south;
  return Math.atan2(vector.y, vector.x);
}

export function seededFogJitter(x, y, edgeIndex = 0) {
  let value = Math.imul(x + 37, 73856093) ^ Math.imul(y + 91, 19349663) ^ Math.imul(edgeIndex + 11, 83492791);
  value ^= value >>> 13;
  value = Math.imul(value, 1274126177);
  return ((value >>> 0) / 4294967295) * 2 - 1;
}

export function exposedFogEdges(tile, tileAt) {
  if (tile.visibility === 'unexplored') return [];
  const directions = [
    { dx: 0, dy: -1, side: 'north' },
    { dx: 1, dy: 0, side: 'east' },
    { dx: 0, dy: 1, side: 'south' },
    { dx: -1, dy: 0, side: 'west' }
  ];
  return directions.filter(({ dx, dy }) => tileAt(tile.x + dx, tile.y + dy)?.visibility === 'unexplored');
}

export function shouldDrawGridEdge(tile, neighbor) {
  return !(tile && neighbor && !tile.walkable && !neighbor.walkable);
}
