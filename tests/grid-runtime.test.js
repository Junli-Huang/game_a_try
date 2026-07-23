import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { GridExplorationRuntime } from '../src/game-runtime.js';

function createRuntime() {
  const canvas = { width: 0, height: 0, getContext: () => ({}), addEventListener() {}, removeEventListener() {} };
  const config = cloneDefaultConfig();
  const save = { safeFood: 4, monsterMeat: [], madness: 0, madnessResistance: 10, maxMadnessResistance: 10, expeditions: 0, farm: { planted: false, cyclesLeft: 0 } };
  const runtime = new GridExplorationRuntime(canvas, config, save);
  runtime.tiles = runtime.createTiles();
  runtime.player = { x: 5, y: 5, health: 100, hunger: 80, madness: 0, madnessResistance: 10, loot: { monsterMeat: [] } };
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
  const config = {
    ...runtime.config.monsters[1], actionChance: 1, alertDuration: 1,
    vision: { ...runtime.config.monsters[1].vision, canRotateBeforeMove: false }
  };
  const enemy = { id: 'warn-test', config, x: 7, y: 5, homeX: 7, homeY: 5, health: config.health, state: 'Wander', facing: 'west', cooldownTurns: 0, alertTurns: 0, intent: null };
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

test('a player behind an adjacent enemy is not detected', () => {
  const runtime = createRuntime();
  const base = runtime.config.monsters[1];
  const config = { ...base, actionChance: 0, vision: { ...base.vision, canRotateBeforeMove: false } };
  const enemy = {
    id: 'backstab-test', config, x: 6, y: 5, homeX: 6, homeY: 5,
    health: config.health, state: 'Wander', facing: 'east', cooldownTurns: 0
  };
  runtime.monsters.push(enemy);
  runtime.updateMonster(enemy);
  assert.equal(enemy.state, 'Wander');
});

test('turning is free and a wanderer can still move in the same enemy phase', () => {
  const runtime = createRuntime();
  const base = runtime.config.monsters[1];
  const config = { ...base, actionChance: 1, vision: { ...base.vision, rotateWhenIdle: true } };
  const enemy = {
    id: 'turn-and-move', config, x: 8, y: 8, homeX: 8, homeY: 8,
    health: config.health, state: 'Wander', facing: 'east', cooldownTurns: 0
  };
  runtime.monsters.push(enemy);
  runtime.random = () => 0.5;
  const turn = runtime.turn;
  const before = { x: enemy.x, y: enemy.y };
  runtime.updateMonster(enemy);
  assert.equal(runtime.turn, turn);
  assert.notDeepEqual({ x: enemy.x, y: enemy.y }, before);
  const expectedFacing = enemy.x > before.x ? 'east' : enemy.x < before.x ? 'west' : enemy.y > before.y ? 'south' : 'north';
  assert.equal(enemy.facing, expectedFacing);
  assert.equal(runtime.mode, 'OUTDOOR_EXPLORATION');
});

test('post-move detection enters Alert without granting chase or attack', () => {
  const notices = [];
  const runtime = createRuntime();
  runtime.callbacks.onNotice = (notice) => notices.push(notice.type);
  const base = runtime.config.monsters[1];
  const config = {
    ...base, actionChance: 1, alertDuration: 2,
    vision: { ...base.vision, canRotateBeforeMove: false, canDetectAfterMove: true }
  };
  const enemy = {
    id: 'post-move-detect', config, x: 8, y: 5, homeX: 7, homeY: 5,
    health: config.health, state: 'Return', facing: 'east', cooldownTurns: 0
  };
  runtime.monsters.push(enemy);
  runtime.updateMonster(enemy);
  assert.deepEqual({ x: enemy.x, y: enemy.y }, { x: 7, y: 5 });
  assert.equal(enemy.facing, 'west');
  assert.equal(enemy.state, 'Alert');
  assert.equal(enemy.alertTurns, 2);
  assert.deepEqual(notices, ['alert']);
  assert.equal(runtime.mode, 'OUTDOOR_EXPLORATION');
});

test('Alert, Chase, Return, and Cooldown face their active target', () => {
  const runtime = createRuntime();
  const base = runtime.config.monsters[1];
  const config = { ...base, actionChance: 0 };
  const enemy = {
    id: 'state-facing', config, x: 8, y: 8, homeX: 6, homeY: 8,
    health: config.health, state: 'Alert', facing: 'north', cooldownTurns: 0,
    alertTurns: 2, lastSeenPlayerPosition: { x: 8, y: 5 }
  };
  runtime.monsters.push(enemy);
  runtime.updateMonster(enemy);
  assert.equal(enemy.facing, 'north');
  enemy.state = 'Chase'; enemy.lastSeenPlayerPosition = { x: 5, y: 8 };
  runtime.updateMonster(enemy);
  assert.equal(enemy.facing, 'west');
  enemy.state = 'AttackIntent'; enemy.lastSeenPlayerPosition = { x: 8, y: 5 };
  runtime.updateMonster(enemy);
  assert.equal(enemy.facing, 'north');
  enemy.state = 'Return'; enemy.lastSeenPlayerPosition = null;
  runtime.updateMonster(enemy);
  assert.equal(enemy.facing, 'west');
  enemy.state = 'Cooldown'; enemy.cooldownTurns = 2; enemy.lastSeenPlayerPosition = { x: 8, y: 5 };
  runtime.updateMonster(enemy);
  assert.equal(enemy.facing, 'north');
});

test('visible enemy vision respects fog, memory, UI display, death, and nests', () => {
  const runtime = createRuntime();
  runtime.player.x = 5; runtime.player.y = 5;
  const base = runtime.config.monsters[1];
  const visible = { id: 'visible', config: base, x: 6, y: 5, homeX: 6, homeY: 5, health: 10, state: 'Wander', facing: 'east' };
  const hidden = { ...visible, id: 'hidden', x: 15, y: 15 };
  const dead = { ...visible, id: 'dead', x: 5, y: 6, health: 0 };
  const nestConfig = runtime.config.monsters.find((monster) => monster.id === 'basic_nest');
  const nest = { ...visible, id: 'nest', config: nestConfig, x: 6, y: 6 };
  runtime.monsters.push(visible, hidden, dead, nest);
  runtime.updateVision();
  const overlay = runtime.getVisibleEnemyVision();
  assert.ok(overlay.size > 0);
  assert.ok(![...overlay.keys()].some((key) => key.startsWith('15,')));
  runtime.config.ui.showEnemyVision = false;
  assert.equal(runtime.getVisibleEnemyVision().size, 0);
  assert.equal(visible.config.vision.enabled, true, 'display setting does not disable AI vision');
});

test('snapshot restores facing and gives legacy enemies a stable fallback', () => {
  const runtime = createRuntime();
  const base = runtime.config.monsters[1];
  runtime.save.activeExpedition = {
    mapId: runtime.mapConfig.id, seed: 'legacy-facing', player: runtime.player,
    monsters: [
      { id: 'saved-facing', configId: base.id, x: 6, y: 5, homeX: 6, homeY: 5, health: 10, state: 'Wander', facing: 'north' },
      { id: 'legacy-facing', configId: base.id, x: 7, y: 5, homeX: 7, homeY: 5, health: 10, state: 'Wander' }
    ],
    corpses: [], visitedTiles: []
  };
  runtime.restoreExpedition();
  assert.equal(runtime.monsters[0].facing, 'north');
  const fallback = runtime.monsters[1].facing;
  runtime.restoreExpedition();
  assert.equal(runtime.monsters[1].facing, fallback);
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
  runtime.player.loot.monsterMeat = Array.from({ length: runtime.config.player.inventoryCapacity }, (_, index) => ({ id: `meat-${index}`, currentMadness: 12, maxMadness: 12 }));
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
  runtime.player.loot.monsterMeat = Array.from({ length: 3 }, (_, index) => ({ id: `meat-${index}`, currentMadness: 12, maxMadness: 12 }));
  runtime.player.madness = 12;
  assert.deepEqual(runtime.getExpeditionSummary(), {
    turns: 8, exploredTiles: 3, kills: 2, nestsDestroyed: 1,
    meatCollected: 4, meatConsumed: 1, madnessDelta: 12,
    resistanceRemaining: 10, sceneMadness: 0
  });
  runtime.stop = () => {};
  runtime.failExpedition('combat');
  assert.equal(runtime.save.lastResult.reason, 'combat');
  assert.equal(runtime.save.lastResult.lostMeat, 3);
});

test('successful extraction persists remaining health', () => {
  const runtime = createRuntime();
  runtime.running = true;
  runtime.player.health = 63;
  runtime.player.madnessResistance = 3.5;
  runtime.stop = () => {};
  runtime.succeedExpedition();
  assert.equal(runtime.save.health, 63);
  assert.equal(runtime.save.madnessResistance, 3.5);
});

test('failed expedition resets health as part of death recovery', () => {
  const runtime = createRuntime();
  runtime.running = true;
  runtime.player.health = 0;
  runtime.player.madnessResistance = 2.5;
  runtime.stop = () => {};
  runtime.failExpedition('combat');
  assert.equal(runtime.save.health, runtime.config.player.health);
  assert.equal(runtime.save.madnessResistance, 2.5);
});

test('outdoor item menu exposes meat and eating consumes one exploration turn', () => {
  const runtime = createRuntime();
  runtime.running = true;
  runtime.player.loot.monsterMeat = [
    { id: 'meat-1', currentMadness: 12, maxMadness: 12 },
    { id: 'meat-2', currentMadness: 12, maxMadness: 12 }
  ];
  runtime.player.health = 75;
  runtime.player.hunger = 40;
  runtime.render = () => {};
  const beforeMadness = runtime.player.madness;
  const item = runtime.getOutdoorItems().find((entry) => entry.id === 'monster_meat');
  assert.equal(item.count, 2);
  const result = runtime.useOutdoorItem('monster_meat');
  assert.equal(result.ok, true);
  assert.equal(runtime.player.loot.monsterMeat.length, 1);
  assert.equal(runtime.turn, 1);
  assert.equal(runtime.player.health, 85);
  assert.equal(runtime.player.hunger, 66);
  assert.ok(runtime.player.madness > beforeMadness);
});

test('eating meat in battle restores health up to the configured maximum', () => {
  const runtime = createRuntime();
  runtime.player.health = 95;
  runtime.player.loot.monsterMeat = [{ id: 'meat-1', currentMadness: 12, maxMadness: 12 }];
  runtime.eatMonsterMeat();
  assert.equal(runtime.player.health, 100);
  assert.equal(runtime.player.loot.monsterMeat.length, 0);
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
