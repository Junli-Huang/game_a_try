import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canEnemySeePlayer,
  directionFromDelta,
  getVisionCells,
  hasLineOfSight,
  stableDirection
} from '../src/systems/grid-vision.js';

function createMap(width = 9, height = 9, blocked = []) {
  const obstacles = new Set(blocked.map(({ x, y }) => `${x},${y}`));
  return {
    width,
    height,
    tileAt(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return { x, y, walkable: !obstacles.has(`${x},${y}`) };
    }
  };
}

const vision = { enabled: true, range: 4, angle: 90 };
const origin = { x: 4, y: 4 };

test('directional vision sees forward and its inclusive edge, but not behind or beyond range', () => {
  const map = createMap();
  const cells = getVisionCells(origin, 'north', vision, map);
  const keys = new Set(cells.map(({ x, y }) => `${x},${y}`));
  assert.ok(keys.has('4,1'));
  assert.ok(keys.has('2,2'), '45 degree boundary is included');
  assert.ok(!keys.has('4,5'));
  const shorter = getVisionCells(origin, 'north', { ...vision, range: 3 }, map);
  assert.ok(!shorter.some(({ x, y }) => x === 4 && y === 0));
});

test('all four facings map to the expected forward cell and stay inside map edges', () => {
  const map = createMap(3, 3);
  const expected = {
    north: '1,0',
    east: '2,1',
    south: '1,2',
    west: '0,1'
  };
  for (const [facing, key] of Object.entries(expected)) {
    const cells = getVisionCells({ x: 1, y: 1 }, facing, { ...vision, range: 2 }, map);
    assert.ok(cells.some(({ x, y }) => `${x},${y}` === key), facing);
    assert.ok(cells.every(({ x, y }) => x >= 0 && y >= 0 && x < 3 && y < 3));
  }
});

test('blocking terrain is visible while cells behind it are hidden', () => {
  const map = createMap(9, 9, [{ x: 4, y: 2 }]);
  const cells = getVisionCells(origin, 'north', vision, map);
  assert.ok(cells.some(({ x, y }) => x === 4 && y === 2));
  assert.ok(!cells.some(({ x, y }) => x === 4 && y === 1));
  assert.equal(hasLineOfSight(origin, { x: 4, y: 1 }, (x, y) => !map.tileAt(x, y)?.walkable), false);
});

test('enemy detection ignores dead enemies, nests, and players behind the facing', () => {
  const map = createMap();
  const enemy = { ...origin, health: 10, facing: 'north', config: { vision } };
  assert.equal(canEnemySeePlayer(enemy, { x: 4, y: 2 }, map), true);
  assert.equal(canEnemySeePlayer(enemy, { x: 4, y: 5 }, map), false);
  assert.equal(canEnemySeePlayer({ ...enemy, health: 0 }, { x: 4, y: 2 }, map), false);
  assert.equal(canEnemySeePlayer({ ...enemy, config: { vision, spawnConfig: { enabled: true } } }, { x: 4, y: 2 }, map), false);
});

test('direction and legacy stable fallback are deterministic', () => {
  assert.equal(directionFromDelta(0, -1), 'north');
  assert.equal(directionFromDelta(2, 1), 'east');
  assert.equal(stableDirection('legacy-enemy-4,7'), stableDirection('legacy-enemy-4,7'));
});
