import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { createInitialSave, loadSave, SAVE_STORAGE_KEY } from '../src/config/config-service.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';
import {
  applyEnvironmentalPollution,
  getMeatPurificationPreview,
  normalizeMonsterMeat,
  purifyMonsterMeat,
  restoreResistance
} from '../src/systems/madness-resources.js';

const canvas = () => ({ width: 0, height: 0, getContext: () => ({}), addEventListener() {}, removeEventListener() {} });

function runtimeForPollution() {
  const config = cloneDefaultConfig();
  const save = createInitialSave(config);
  const runtime = new GridExplorationRuntime(canvas(), config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = { x: 1, y: 1, health: 100, hunger: 100, madness: 0, madnessResistance: 10, loot: { monsterMeat: [] } };
  runtime.monsters = [];
  runtime.corpses = [];
  runtime.visitedTiles = new Set(['1,1']);
  runtime.running = true;
  runtime.persistExpedition = () => {};
  runtime.render = () => {};
  return runtime;
}

test('new save initializes resistance, relic, and object-based monster meat', () => {
  const config = cloneDefaultConfig();
  config.shelter.initialMonsterMeat = 2;
  const save = createInitialSave(config);
  assert.equal(save.madnessResistance, 10);
  assert.equal(save.maxMadnessResistance, 10);
  assert.deepEqual(save.relic, { currentPurification: 100, maxPurification: 100 });
  assert.equal(save.monsterMeat.length, 2);
  assert.ok(save.monsterMeat.every((meat) => meat.currentMadness === 12 && meat.maxMadness === 12));
});

test('legacy shelter and outdoor meat counts migrate without loss', () => {
  const config = cloneDefaultConfig();
  const legacy = {
    health: 73,
    madness: 9,
    monsterMeat: 3,
    activeExpedition: {
      mapId: config.maps[0].id,
      player: { health: 73, madness: 9, loot: { monsterMeat: 2 } }
    }
  };
  globalThis.localStorage = {
    getItem: (key) => key === SAVE_STORAGE_KEY ? JSON.stringify(legacy) : null,
    setItem() {}, removeItem() {}
  };
  const migrated = loadSave(config);
  assert.equal(migrated.monsterMeat.length, 3);
  assert.equal(migrated.activeExpedition.player.loot.monsterMeat.length, 2);
  assert.equal(migrated.madnessResistance, 10);
  assert.equal(migrated.health, 73);
  delete globalThis.localStorage;
});

test('environment pollution consumes resistance first and sends only overflow to madness', () => {
  const player = { madnessResistance: 0.04, madness: 7 };
  const result = applyEnvironmentalPollution(player, 0.1, 100);
  assert.deepEqual(result, { blocked: 0.04, overflow: 0.06 });
  assert.equal(player.madnessResistance, 0);
  assert.equal(player.madness, 7.06);
});

test('environment timer waits for the interval, catches up multiple intervals, and ignores paused modes', () => {
  const runtime = runtimeForPollution();
  assert.equal(runtime.advanceEnvironmentTime(4999), 0);
  assert.equal(runtime.player.madnessResistance, 10);
  assert.equal(runtime.advanceEnvironmentTime(1), 1);
  assert.equal(runtime.player.madnessResistance, 9.9);
  assert.equal(runtime.advanceEnvironmentTime(10000), 2);
  assert.equal(runtime.player.madnessResistance, 9.7);
  runtime.inputPaused = true;
  assert.equal(runtime.advanceEnvironmentTime(5000), 0);
  assert.equal(runtime.player.madnessResistance, 9.7);
  runtime.inputPaused = false;
  runtime.mode = 'BATTLE';
  assert.equal(runtime.advanceEnvironmentTime(5000), 0);
});

test('environment timer progress survives an expedition snapshot', () => {
  const runtime = runtimeForPollution();
  runtime.persistExpedition = GridExplorationRuntime.prototype.persistExpedition.bind(runtime);
  runtime.seed = 'pollution-snapshot';
  runtime.random = { getState: () => 1 };
  runtime.environmentElapsedMs = 4500;
  runtime.resistanceDepletedNotified = true;
  runtime.lastEnvironmentTickAt = 1000;
  runtime.eventService = null;
  runtime.callbacks.onSave = () => {};
  runtime.persistExpedition();

  const restored = runtimeForPollution();
  restored.save = runtime.save;
  restored.restoreExpedition();
  assert.equal(restored.environmentElapsedMs, 4500);
  assert.equal(restored.resistanceDepletedNotified, true);
  assert.equal(restored.advanceEnvironmentTime(500), 1);
  assert.equal(restored.player.madnessResistance, 9.9);
});

test('relic transfers purification one-to-one to resistance and supports partial meat purification', () => {
  const save = {
    madnessResistance: 4,
    maxMadnessResistance: 10,
    relic: { currentPurification: 8, maxPurification: 100 },
    monsterMeat: normalizeMonsterMeat(1, 12)
  };
  assert.deepEqual(restoreResistance(save, 1), { restored: 6, cost: 6 });
  assert.equal(save.madnessResistance, 10);
  assert.equal(save.relic.currentPurification, 2);
  const result = purifyMonsterMeat(save, save.monsterMeat[0].id, 1);
  assert.equal(result.purified, 2);
  assert.equal(result.cost, 2);
  assert.equal(result.meat.currentMadness, 10);
  assert.equal(save.relic.currentPurification, 0);
  assert.equal(purifyMonsterMeat(save, save.monsterMeat[0].id, 1).purified, 0);
});

test('fully purified meat is skipped and cannot consume purification twice', () => {
  const save = {
    relic: { currentPurification: 20, maxPurification: 100 },
    monsterMeat: [
      { id: 'already-clean', currentMadness: 0, maxMadness: 12 },
      { id: 'dirty', currentMadness: 12, maxMadness: 12 }
    ]
  };
  const result = purifyMonsterMeat(save, 'dirty', 1);
  assert.equal(result.meat.id, 'dirty');
  assert.equal(result.purified, 12);
  assert.equal(save.relic.currentPurification, 8);
  assert.equal(purifyMonsterMeat(save, 'already-clean', 1).purified, 0);
  assert.equal(save.relic.currentPurification, 8);
});

test('relic cost multipliers support partial transfer, exact targeting, and zero-cost rules', () => {
  const save = {
    madnessResistance: 2,
    maxMadnessResistance: 10,
    relic: { currentPurification: 3, maxPurification: 100 },
    monsterMeat: [
      { id: 'first', currentMadness: 8, maxMadness: 12 },
      { id: 'selected', currentMadness: 5, maxMadness: 12 }
    ]
  };
  assert.deepEqual(restoreResistance(save, 2), { restored: 1.5, cost: 3 });
  assert.equal(save.madnessResistance, 3.5);
  save.relic.currentPurification = 3;
  const result = purifyMonsterMeat(save, 'selected', 2);
  assert.deepEqual({ purified: result.purified, cost: result.cost }, { purified: 1.5, cost: 3 });
  assert.equal(save.monsterMeat[0].currentMadness, 8);
  assert.equal(save.monsterMeat[1].currentMadness, 3.5);
  save.relic.currentPurification = 0;
  assert.deepEqual(getMeatPurificationPreview(save.monsterMeat[1], 0, 0), { purified: 3.5, cost: 0, complete: true });
  assert.equal(purifyMonsterMeat(save, 'selected', 0).meat.currentMadness, 0);
});

test('environment depletion warning persists once and hidden time does not advance pollution', () => {
  const runtime = runtimeForPollution();
  runtime.player.madnessResistance = 0.1;
  runtime.advanceEnvironmentTime(5000);
  assert.equal(runtime.resistanceDepletedNotified, true);
  assert.match(runtime.message, /疯狂抗性已经耗尽/);
  runtime.advanceEnvironmentTime(5000);
  assert.doesNotMatch(runtime.message, /疯狂抗性已经耗尽/);

  runtime.environmentElapsedMs = 4500;
  runtime.lastEnvironmentTickAt = 1000;
  runtime.setPageHidden(true, 1200);
  assert.equal(runtime.environmentElapsedMs, 4700);
  runtime.setPageHidden(false, 10000);
  assert.equal(runtime.environmentElapsedMs, 4700);
  clearInterval(runtime.environmentTimer);
});

test('extraction preserves meat pollution while failed expeditions discard carried meat', () => {
  const success = runtimeForPollution();
  success.player.loot.monsterMeat = [{ id: 'partial', currentMadness: 3, maxMadness: 12 }];
  success.stop = () => {};
  success.succeedExpedition();
  assert.equal(success.save.monsterMeat.length, 1);
  assert.equal(success.save.monsterMeat[0].currentMadness, 3);

  const failure = runtimeForPollution();
  failure.player.loot.monsterMeat = [{ id: 'lost', currentMadness: 4, maxMadness: 12 }];
  failure.stop = () => {};
  failure.failExpedition('combat');
  assert.equal(failure.save.monsterMeat.length, 0);
  assert.equal(failure.save.lastResult.lostMeat, 1);
});

test('eating uses the least corrupted meat and does not consume resistance', () => {
  const runtime = runtimeForPollution();
  runtime.player.loot.monsterMeat = [
    { id: 'full', currentMadness: 12, maxMadness: 12 },
    { id: 'clean', currentMadness: 0, maxMadness: 12 }
  ];
  const eaten = runtime.eatMonsterMeat();
  assert.equal(eaten.id, 'clean');
  assert.equal(runtime.player.madness, 0);
  assert.equal(runtime.player.madnessResistance, 10);
  assert.equal(runtime.player.loot.monsterMeat.length, 1);
});

test('combat health loss is absorbed by the scene at one-to-one value', () => {
  const runtime = runtimeForPollution();
  const enemyConfig = { ...runtime.config.monsters[0], health: 5, defense: 0 };
  const enemy = { id: 'damage-sink', config: enemyConfig, x: 2, y: 1, homeX: 2, homeY: 1, health: 5, state: 'Idle', cooldownTurns: 0 };
  runtime.monsters = [enemy];
  runtime.callbacks.onBattleResult = null;
  runtime.startBattle(enemy, 'player');
  runtime.battleAction('attack');
  assert.equal(runtime.sceneMadness, 5);
});
