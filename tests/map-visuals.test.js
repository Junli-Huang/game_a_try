import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directionAngle,
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

test('adjacent obstacles suppress their shared grid line', () => {
  assert.equal(shouldDrawGridEdge({ walkable: false }, { walkable: false }), false);
  assert.equal(shouldDrawGridEdge({ walkable: false }, { walkable: true }), true);
  assert.equal(shouldDrawGridEdge({ walkable: true }, { walkable: true }), true);
});
