import test from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '../src/config/config-service.js';

const service = new ConfigService();

test('default config passes validation', () => {
  const result = service.validateConfig(service.loadDefaultConfig());
  assert.equal(result.valid, true, result.errors.join('\n'));
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
