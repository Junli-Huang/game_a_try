import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { createInitialSave } from '../src/config/config-service.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';
import { getDynamicCorruption, migrateWorldSave } from '../src/systems/world-generation.js';

const canvas = () => ({
  width: 0, height: 0,
  getContext: () => ({}),
  addEventListener() {},
  removeEventListener() {}
});

function createRuntime({ playerHealth = 100, enemyHealth = 20, enemyAttack = 6 } = {}) {
  const config = cloneDefaultConfig();
  config.battle.battleTransition = false;
  config.battle.battleResultDelay = 0;
  const save = createInitialSave(config);
  const runtime = new GridExplorationRuntime(canvas(), config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = {
    x: 50, y: 50, health: playerHealth, hunger: 100, madness: 0,
    madnessResistance: 10, loot: { monsterMeat: [] }, dead: false
  };
  const enemyConfig = {
    ...config.monsters[0],
    health: enemyHealth,
    attack: enemyAttack,
    defense: 0,
    speed: 0,
    spawnConfig: { enabled: false }
  };
  const enemy = {
    id: 'pollution-target', config: enemyConfig,
    x: 50, y: 51, homeX: 50, homeY: 51,
    health: enemyHealth, state: 'Idle', cooldownTurns: 0
  };
  runtime.monsters = [enemy];
  runtime.corpses = [];
  runtime.visitedTiles = new Set(['50,50']);
  runtime.seenSpawnerIds = new Set();
  runtime.running = true;
  runtime.random = Object.assign(() => 0, { getState: () => 0 });
  runtime.eventService = null;
  runtime.render = () => {};
  runtime.updateVision = () => {};
  runtime.consumeHunger = () => {};
  runtime.stop = () => { runtime.running = false; };
  runtime.callbacks.onSave = () => {};
  return { runtime, enemy };
}

test('combat loss lands on each actor world position and conserves total damage', () => {
  const { runtime, enemy } = createRuntime({ enemyHealth: 30, enemyAttack: 6 });
  runtime.config.player.baseAttack = 8;
  runtime.config.equipment = [];
  runtime.startBattle(enemy, 'player');
  const playerBefore = runtime.player.health;
  const enemyBefore = enemy.health;
  runtime.battleAction('attack');
  const playerLoss = playerBefore - runtime.player.health;
  const enemyLoss = enemyBefore - enemy.health;
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 50), playerLoss);
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 51), enemyLoss);
  assert.equal(runtime.sceneMadness, playerLoss + enemyLoss);
  assert.equal(Object.values(runtime.save.world.dynamicCorruption).reduce((sum, value) => sum + value, 0), playerLoss + enemyLoss);
});

test('overkill creates only actual enemy health loss', () => {
  const { runtime, enemy } = createRuntime({ enemyHealth: 3, enemyAttack: 0 });
  runtime.config.player.baseAttack = 20;
  runtime.config.equipment = [];
  runtime.startBattle(enemy, 'player');
  runtime.battleAction('attack');
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 51), 3);
  assert.equal(runtime.sceneMadness, 3);
});

test('multiple damage facts accumulate on the same tile', () => {
  const { runtime } = createRuntime();
  runtime.absorbCombatDamage(5, { x: 50, y: 50 });
  runtime.absorbCombatDamage(8, { x: 50, y: 50 });
  runtime.absorbCombatDamage(2, { x: 50, y: 50 });
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 50), 15);
  assert.equal(runtime.sceneMadness, 15);
});

test('pollution survives save reconstruction and a missing V2.0 field migrates empty', () => {
  const { runtime } = createRuntime();
  runtime.absorbCombatDamage(11, { x: 50, y: 50 });
  const restored = migrateWorldSave(structuredClone(runtime.save.world), runtime.world);
  assert.equal(getDynamicCorruption(restored, 50, 50), 11);

  const legacy = structuredClone(runtime.save.world);
  delete legacy.dynamicCorruption;
  assert.deepEqual(migrateWorldSave(legacy, runtime.world).dynamicCorruption, {});
});

test('damage remains after escape and battle result callbacks do not add it twice', () => {
  const { runtime, enemy } = createRuntime();
  runtime.startBattle(enemy, 'player');
  runtime.absorbCombatDamage(7, runtime.battle.worldPositions.enemy);
  runtime.escapeBattle();
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 51), 7);

  const beforeEnding = structuredClone(runtime.save.world.dynamicCorruption);
  runtime.callbacks.onBattleResult = (_result, finish) => { finish(); finish(); };
  runtime.battle = { monster: enemy };
  runtime.winBattle();
  assert.deepEqual(runtime.save.world.dynamicCorruption, beforeEnding);
});

test('player death records only remaining health at the snapshotted player tile', () => {
  const { runtime, enemy } = createRuntime({ playerHealth: 12, enemyAttack: 20 });
  enemy.config.speed = runtime.config.player.speed + 1;
  runtime.callbacks.onComplete = () => {};
  runtime.startBattle(enemy, 'enemy');
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 50), 12);
  assert.equal(runtime.sceneMadness, 12);
});

test('battle position snapshot is used even if actor coordinates later change', () => {
  const { runtime, enemy } = createRuntime();
  runtime.startBattle(enemy, 'player');
  runtime.player.x = 60;
  runtime.player.y = 60;
  enemy.x = 61;
  enemy.y = 60;
  runtime.absorbCombatDamage(4, runtime.battle.worldPositions.player);
  runtime.absorbCombatDamage(9, runtime.battle.worldPositions.enemy);
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 50), 4);
  assert.equal(getDynamicCorruption(runtime.save.world, 50, 51), 9);
  assert.equal(getDynamicCorruption(runtime.save.world, 60, 60), 0);
});
