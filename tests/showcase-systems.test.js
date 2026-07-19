import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneDefaultConfig } from '../src/config/default-config.js';
import { GoalService } from '../src/systems/goal-service.js';
import { MadnessPresentationService } from '../src/systems/madness-presentation.js';
import { MapEventService } from '../src/systems/map-event-service.js';

test('demo goal reaches victory only after both requirements', () => {
  const config = cloneDefaultConfig(), service = new GoalService(config);
  const save = { successfulExtractions: 3, totalMonsterMeatReturned: 11, expeditionFailures: 0, safeFood: 1, monsterMeat: 1 };
  assert.equal(service.status(save).state, 'active');
  save.totalMonsterMeatReturned = 12;
  assert.equal(service.status(save).state, 'victory');
});

test('demo goal reports configured failure conditions', () => {
  const service = new GoalService(cloneDefaultConfig());
  assert.equal(service.status({ expeditionFailures: 3, safeFood: 2, monsterMeat: 0 }).reason, 'failures');
  assert.equal(service.status({ expeditionFailures: 0, safeFood: 0, monsterMeat: 0 }).reason, 'food');
});

test('madness presentation detects stage changes and avoids repeated whispers', () => {
  const service = new MadnessPresentationService(cloneDefaultConfig());
  assert.equal(service.stageChange(29, 30).stage.id, 'whisper');
  assert.match(service.stageChange(60, 20).message, /低语远了/);
  const first = service.whisper();
  assert.notEqual(service.whisper(), first);
});

test('map events obey chance, step gap and expedition limit', () => {
  const config = cloneDefaultConfig();
  config.mapEvents = { enabled: true, triggerChancePerNewTile: 1, maxEventsPerExpedition: 2, minStepsBetweenEvents: 3 };
  config.events = [{ id: 'test', title: 'test', enabled: true, weight: 1, choices: [{ id: 'go', effects: [] }] }];
  const service = new MapEventService(config, () => 0);
  const context = (step) => ({ firstVisit: true, step, madness: 0, hunger: 50, seenEventIds: [] });
  assert.equal(service.tryTrigger(context(1)).id, 'test');
  assert.equal(service.tryTrigger(context(2)), null);
  assert.equal(service.tryTrigger(context(4)).id, 'test');
  assert.equal(service.tryTrigger(context(8)), null);
});

test('map event random outcomes resolve to an effect list', () => {
  const service = new MapEventService(cloneDefaultConfig(), () => 0);
  assert.deepEqual(service.effectsFor({ outcomes: [[{ type: 'safeFood', value: 1 }], []] }), [{ type: 'safeFood', value: 1 }]);
});
