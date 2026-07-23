import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directionAngle,
  exposedFogEdges,
  fogEdgeClouds,
  seededFogJitter,
  shouldDrawGridEdge,
  visionPalette,
  visionTone
} from '../src/systems/map-visuals.js';

test('vision state maps to stable visual tones and palettes', () => {
  assert.equal(visionTone('Idle'), 'normal');
  assert.equal(visionTone('Alert'), 'alert');
  assert.equal(visionTone('Chase'), 'danger');
  assert.equal(visionTone('AttackIntent'), 'danger');
  assert.equal(visionTone('Cooldown'), 'cooldown');
  assert.match(visionPalette('danger').core, /^rgba/);
});

test('direction angles rotate the body pointer in cardinal directions', () => {
  assert.equal(directionAngle('east'), 0);
  assert.equal(directionAngle('south'), Math.PI / 2);
  assert.equal(directionAngle('north'), -Math.PI / 2);
  assert.equal(Math.abs(directionAngle('west')), Math.PI);
});

test('fog jitter is deterministic and remains normalized', () => {
  const value = seededFogJitter(7, 12, 2);
  assert.equal(value, seededFogJitter(7, 12, 2));
  assert.ok(value >= -1 && value <= 1);
  assert.notEqual(value, seededFogJitter(7, 12, 3));
});

test('fog edge clouds form a stable irregular boundary', () => {
  const clouds = fogEdgeClouds(7, 12, 2);
  assert.deepEqual(clouds, fogEdgeClouds(7, 12, 2));
  assert.equal(clouds.length, 4);
  assert.ok(clouds.every(({ along, depth, radius, opacity }) => (
    along >= 0 && along <= 1
    && depth >= -.14 && depth <= .08
    && radius >= .22 && radius <= .35
    && opacity >= .48 && opacity <= .72
  )));
  assert.notDeepEqual(clouds, fogEdgeClouds(7, 12, 3));
});

test('fog edges are emitted only beside unexplored tiles', () => {
  const cells = new Map([
    ['1,1', { x: 1, y: 1, visibility: 'visible' }],
    ['1,0', { x: 1, y: 0, visibility: 'unexplored' }],
    ['2,1', { x: 2, y: 1, visibility: 'explored' }],
    ['1,2', { x: 1, y: 2, visibility: 'visible' }],
    ['0,1', { x: 0, y: 1, visibility: 'unexplored' }]
  ]);
  const edges = exposedFogEdges(cells.get('1,1'), (x, y) => cells.get(`${x},${y}`));
  assert.deepEqual(edges.map(({ side }) => side), ['north', 'west']);
});

test('adjacent obstacles suppress their shared grid line', () => {
  assert.equal(shouldDrawGridEdge({ walkable: false }, { walkable: false }), false);
  assert.equal(shouldDrawGridEdge({ walkable: false }, { walkable: true }), true);
  assert.equal(shouldDrawGridEdge({ walkable: true }, { walkable: true }), true);
});
