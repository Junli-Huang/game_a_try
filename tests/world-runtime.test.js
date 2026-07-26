import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { createInitialSave } from '../src/config/config-service.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';

const canvas = () => ({
  width: 0,
  height: 0,
  getContext: () => ({}),
  addEventListener() {},
  removeEventListener() {}
});

function createWorldRuntime() {
  const config = cloneDefaultConfig();
  const save = createInitialSave(config);
  const runtime = new GridExplorationRuntime(canvas(), config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = {
    ...save.world.playerPosition,
    health: 100,
    hunger: 80,
    madness: 0,
    madnessResistance: 10,
    loot: { monsterMeat: [] }
  };
  runtime.monsters = [];
  runtime.corpses = [];
  runtime.visitedTiles = new Set();
  runtime.running = true;
  runtime.render = () => {};
  runtime.persistExpedition = () => {};
  return runtime;
}

test('silent relic prevents hunger use inside its radius', () => {
  const runtime = createWorldRuntime();
  runtime.consumeHunger('move');
  assert.equal(runtime.player.hunger, 80);
  runtime.player.x = 0;
  runtime.player.y = 0;
  runtime.consumeHunger('move');
  assert.equal(runtime.player.hunger, 79);
});

test('world resource harvesting adds persistent wood or stone when depleted', () => {
  const runtime = createWorldRuntime();
  const resource = runtime.worldResources[0];
  runtime.player.x = resource.x;
  runtime.player.y = resource.y;
  runtime.advanceMapTurn = () => { runtime.turn += 1; };
  while (resource.health > 0) runtime.harvestWorldResource(resource);
  const itemId = resource.type === 'tree' ? 'wood' : 'stone';
  assert.equal(runtime.save.world.inventory[itemId], resource.drop[itemId]);
  assert.equal(runtime.save.world.resourceStates[resource.id].health, 0);
  assert.equal(runtime.worldResourceAt(resource.x, resource.y), undefined);
});

test('relic pollution protection blocks qualifying local pollution only', () => {
  const runtime = createWorldRuntime();
  runtime.inputPaused = false;
  runtime.pageHidden = false;
  runtime.mode = 'OUTDOOR_EXPLORATION';
  runtime.environmentElapsedMs = 5000;
  const settlements = runtime.advanceEnvironmentTime(0, false);
  assert.equal(settlements, 1);
  assert.equal(runtime.player.madnessResistance, 10);
  runtime.player.x = 0;
  runtime.player.y = 0;
  runtime.environmentElapsedMs = 5000;
  runtime.advanceEnvironmentTime(0, false);
  assert.ok(runtime.player.madnessResistance < 10);
});
