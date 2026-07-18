import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';

function createRuntime() {
  const canvas = { width: 0, height: 0, getContext: () => ({}), addEventListener() {}, removeEventListener() {} };
  const config = cloneDefaultConfig();
  const save = { safeFood: 4, monsterMeat: 0, madness: 0, expeditions: 0, farm: { planted: false, cyclesLeft: 0 } };
  const runtime = new GridExplorationRuntime(canvas, config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = { x: 5, y: 5, health: 100, hunger: 80, madness: 0, loot: { monsterMeat: 0 } };
  runtime.monsters = [];
  runtime.corpses = [];
  runtime.running = true;
  return runtime;
}

test('explored tiles preserve the last observed enemy snapshot', () => {
  const runtime = createRuntime();
  const config = runtime.config.monsters[1];
  const enemy = { id: 'wanderer-test', config, x: 6, y: 5, homeX: 6, homeY: 5, health: config.health, state: 'Wander', cooldownTurns: 0 };
  runtime.monsters.push(enemy);
  runtime.updateVision();
  assert.equal(runtime.tileAt(6, 5).rememberedContent.enemy.id, enemy.id);

  runtime.player.x = 15; runtime.player.y = 15;
  enemy.x = 7; enemy.y = 5;
  runtime.updateVision();
  const oldTile = runtime.tileAt(6, 5);
  assert.equal(oldTile.visibility, 'explored');
  assert.equal(oldTile.rememberedContent.enemy.id, enemy.id);
});

test('battle victory removes enemy and creates a corpse on its tile', () => {
  const runtime = createRuntime();
  runtime.render = () => {};
  const config = { ...runtime.config.monsters[0], health: 1 };
  const enemy = { id: 'passive-test', config, x: 6, y: 5, homeX: 6, homeY: 5, health: 1, state: 'Idle', cooldownTurns: 0 };
  runtime.monsters.push(enemy);
  runtime.startBattle(enemy, 'player');
  runtime.battleAction('attack');
  assert.equal(runtime.mode, 'OUTDOOR_EXPLORATION');
  assert.equal(runtime.monsters.length, 0);
  assert.equal(runtime.corpses.length, 1);
  assert.deepEqual({ x: runtime.player.x, y: runtime.player.y }, { x: 6, y: 5 });
});
