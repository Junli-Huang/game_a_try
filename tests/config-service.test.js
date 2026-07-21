import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '../src/config/config-service.js';

const service = new ConfigService();

test('default config passes validation', () => {
  const result = service.validateConfig(service.loadDefaultConfig());
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(service.loadDefaultConfig().player.hunger, 100);
});

test('invalid references and overlapping madness stages are rejected', () => {
  const config = service.loadDefaultConfig();
  config.maps[0].monsterSpawns[0].monsterId = 'missing_monster';
  config.madnessStages[1].min = 20;
  const result = service.validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('不存在的怪物')));
  assert.ok(result.errors.some((error) => error.includes('范围重叠')));
});

test('exported config can be imported without losing data', () => {
  const config = service.loadDefaultConfig();
  config.player.baseAttack = 17;
  const imported = service.importConfig(service.exportConfig(config));
  assert.equal(imported.player.baseAttack, 17);
});

test('legacy battle eat action migrates to item menu', () => {
  const config = service.loadDefaultConfig();
  config.battle.playerActions = ['attack', 'defend', 'eat', 'escape'];
  const imported = service.importConfig(JSON.stringify(config));
  assert.deepEqual(imported.battle.playerActions, ['attack', 'defend', 'item', 'escape']);
});

test('V1.2 config migration adds V1.3 fields without changing fixed placements', () => {
  const legacy = service.loadDefaultConfig();
  legacy.version = '1.2.0';
  legacy.monsters = legacy.monsters.filter((monster) => monster.id !== 'basic_nest');
  legacy.maps[0].monsterSpawns = legacy.maps[0].monsterSpawns.filter((spawn) => spawn.monsterId !== 'basic_nest');
  const fixedPlacements = structuredClone(legacy.maps[0].monsterSpawns);
  delete legacy.maps[0].extractionPoints;
  delete legacy.maps[0].random;
  delete legacy.maps[0].randomSpawnRules;

  const migrated = service.importConfig(JSON.stringify(legacy));
  assert.equal(migrated.version, '1.3.0');
  assert.ok(migrated.monsters.some((monster) => monster.id === 'basic_nest'));
  assert.deepEqual(migrated.maps[0].monsterSpawns, fixedPlacements);
  assert.deepEqual(migrated.maps[0].extractionPoints, [legacy.maps[0].extractPoint]);
  assert.deepEqual(migrated.maps[0].randomSpawnRules, []);
});

test('map validation rejects every authored object overlap', () => {
  const config = service.loadDefaultConfig();
  const map = config.maps[0];
  map.obstacles.push({ ...map.obstacles[0] });
  map.extractionPoints.push({ ...map.playerSpawn, requiredTurns: 1 });
  map.monsterSpawns.push({ monsterId: 'passive', x: map.extractionPoints[0].x, y: map.extractionPoints[0].y, count: 1 });

  const result = service.validateConfig(config);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('重复障碍格')));
  assert.ok(result.errors.some((error) => error.includes('撤离点不能与其他对象重叠')));
  assert.ok(result.errors.some((error) => error.includes('固定怪物不能与其他对象重叠')));
});
