import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWorldState,
  createWorldSave,
  generateWorld,
  isInsideRelicRange,
  migrateWorldSave,
  terrainAt
} from '../src/systems/world-generation.js';

test('same seed creates the same terrain, relic, and resources', () => {
  const first = generateWorld({ width: 100, height: 100, seed: 'repeatable' });
  const second = generateWorld({ width: 100, height: 100, seed: 'repeatable' });
  assert.deepEqual(second.playerSpawn, first.playerSpawn);
  assert.deepEqual(second.relics, first.relics);
  assert.deepEqual(second.tiles, first.tiles);
  assert.deepEqual(second.resources, first.resources);
});

test('generated world contains coherent terrain and a safe relic start', () => {
  const world = generateWorld({ width: 100, height: 100, seed: 'terrain-check' });
  const terrainIds = new Set(world.tiles.map((tile) => tile.terrainId));
  assert.ok(terrainIds.has('grass'));
  assert.ok(terrainIds.has('forest'));
  assert.ok(terrainIds.has('water'));
  assert.ok(terrainIds.has('rock'));
  assert.ok(terrainIds.has('corrupted'));
  assert.equal(terrainAt(world, world.playerSpawn.x, world.playerSpawn.y).walkable, true);
  assert.ok(terrainAt(world, world.playerSpawn.x, world.playerSpawn.y).pollution <= 50);
  assert.equal(isInsideRelicRange(world.playerSpawn, world.relics[0]), true);
  assert.ok(world.resources.some((resource) => resource.type === 'tree'));
  assert.ok(world.resources.some((resource) => resource.type === 'rock_node'));
});

test('world save stores only mutable state and migrates legacy values safely', () => {
  const world = generateWorld({ width: 60, height: 60, seed: 'save-check' });
  const initial = createWorldSave(world);
  assert.equal('tiles' in initial, false);
  const migrated = migrateWorldSave({
    worldId: world.id,
    seed: world.seed,
    inventory: { wood: 9 },
    resourceStates: { [world.resources[0].id]: { health: 0, depletedAtTurn: 12 } },
    discoveredRelicIds: ['silent-relic-0', 'silent-relic-0']
  }, world);
  assert.deepEqual(migrated.inventory, { wood: 9, stone: 0 });
  assert.deepEqual(migrated.discoveredRelicIds, ['silent-relic-0']);
  assert.equal(applyWorldState(world, migrated)[0].health, 0);
});

test('world save resets when seed or world id changes', () => {
  const world = generateWorld({ seed: 'new-seed' });
  const migrated = migrateWorldSave({ worldId: world.id, seed: 'old-seed', inventory: { wood: 99 } }, world);
  assert.deepEqual(migrated.inventory, { wood: 0, stone: 0 });
  assert.deepEqual(migrated.playerPosition, world.playerSpawn);
});
