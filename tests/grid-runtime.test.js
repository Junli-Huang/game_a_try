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

test('enemy warns through Alert and AttackIntent before starting battle', () => {
  const notices = [];
  const runtime = createRuntime();
  runtime.callbacks.onNotice = (notice) => notices.push(notice.type);
  runtime.render = () => {};
  const config = { ...runtime.config.monsters[1], actionChance: 1, alertDuration: 1, detectRadius: 3 };
  const enemy = { id: 'warn-test', config, x: 7, y: 5, homeX: 7, homeY: 5, health: config.health, state: 'Wander', cooldownTurns: 0, alertTurns: 0, intent: null };
  runtime.monsters.push(enemy);

  runtime.updateMonster(enemy);
  assert.equal(enemy.state, 'Alert');
  runtime.updateMonster(enemy);
  assert.equal(enemy.state, 'Chase');
  runtime.updateMonster(enemy);
  assert.equal(enemy.state, 'AttackIntent');
  assert.deepEqual(notices, ['alert', 'chase', 'attack-intent']);
  runtime.updateMonster(enemy);
  assert.equal(runtime.mode, 'BATTLE');
});

test('faster enemy acts before the player receives control', () => {
  const runtime = createRuntime();
  runtime.render = () => {};
  runtime.config.player.speed = 5;
  const config = { ...runtime.config.monsters[2], speed: 20 };
  const enemy = { id: 'fast-test', config, x: 6, y: 5, homeX: 6, homeY: 5, health: config.health, state: 'AttackIntent', cooldownTurns: 0 };
  runtime.monsters.push(enemy);
  const health = runtime.player.health;
  runtime.startBattle(enemy, 'player');
  assert.ok(runtime.player.health < health);
  assert.equal(runtime.getBattleView().phase, 'player');
  assert.match(runtime.getBattleView().log.join(' '), /敌人.*先行动/);
});

test('interaction describes harvest, full inventory, and extraction', () => {
  const runtime = createRuntime();
  runtime.corpses.push({ id: 'corpse', x: 5, y: 5, config: runtime.config.monsters[0], harvested: false });
  assert.equal(runtime.getInteraction().label, '切割（2 回合）');
  runtime.player.loot.monsterMeat = runtime.config.player.inventoryCapacity;
  assert.equal(runtime.getInteraction().enabled, false);
  runtime.corpses = [];
  runtime.player.x = runtime.mapConfig.extractPoint.x;
  runtime.player.y = runtime.mapConfig.extractPoint.y;
  assert.equal(runtime.getInteraction().label, '撤离（3 回合）');
});

test('expedition summary derives local statistics and records combat failure', () => {
  const runtime = createRuntime();
  runtime.expeditionStart = { madness: 0, enemiesKilled: 2, nestsDestroyed: 1, monsterMeatConsumed: 3 };
  runtime.turn = 8;
  runtime.visitedTiles = new Set(['1,1', '2,1', '3,1']);
  runtime.save.enemiesKilled = 4;
  runtime.save.nestsDestroyed = 2;
  runtime.save.totalMonsterMeatConsumed = 4;
  runtime.player.loot.monsterMeat = 3;
  runtime.player.madness = 12;
  assert.deepEqual(runtime.getExpeditionSummary(), {
    turns: 8, exploredTiles: 3, kills: 2, nestsDestroyed: 1,
    meatCollected: 4, meatConsumed: 1, madnessDelta: 12
  });
  runtime.stop = () => {};
  runtime.failExpedition('combat');
  assert.equal(runtime.save.lastResult.reason, 'combat');
  assert.equal(runtime.save.lastResult.lostMeat, 3);
});

test('outdoor item menu exposes meat and eating consumes one exploration turn', () => {
  const runtime = createRuntime();
  runtime.running = true;
  runtime.player.loot.monsterMeat = 2;
  runtime.player.hunger = 40;
  runtime.render = () => {};
  const beforeMadness = runtime.player.madness;
  const item = runtime.getOutdoorItems().find((entry) => entry.id === 'monster_meat');
  assert.equal(item.count, 2);
  const result = runtime.useOutdoorItem('monster_meat');
  assert.equal(result.ok, true);
  assert.equal(runtime.player.loot.monsterMeat, 1);
  assert.equal(runtime.turn, 1);
  assert.equal(runtime.player.hunger, 66);
  assert.ok(runtime.player.madness > beforeMadness);
});

test('hunger decreases on movement only', () => {
  const runtime = createRuntime();
  runtime.render = () => {};
  runtime.player.hunger = 50;
  runtime.consumeHunger('battle');
  runtime.consumeHunger('harvest');
  runtime.consumeHunger('wait');
  assert.equal(runtime.player.hunger, 50);
  runtime.consumeHunger('move');
  assert.equal(runtime.player.hunger, 49);
  assert.deepEqual(runtime.config.battle.playerActions, ['attack', 'defend', 'item', 'escape']);
});

test('battle keys are routed through the runtime input listener', () => {
  const runtime = createRuntime();
  const received = [];
  runtime.mode = 'BATTLE';
  runtime.callbacks.onBattleKey = (key) => { received.push(key); return true; };
  let prevented = false;
  runtime.onKeyDown({ key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.deepEqual(received, ['ArrowRight']);
  assert.equal(prevented, true);
});
