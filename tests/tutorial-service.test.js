import test from 'node:test';
import assert from 'node:assert/strict';
import { TutorialService, createTutorialState } from '../src/systems/tutorial-service.js';

test('tutorial state migrates missing and invalid legacy fields', () => {
  assert.deepEqual(createTutorialState(), { skippedAll: false, completedSteps: [] });
  assert.deepEqual(createTutorialState({ completedSteps: ['demo_goal', 'demo_goal', 'invalid'] }), {
    skippedAll: false, completedSteps: ['demo_goal']
  });
});

test('tutorial steps show once and skip all persists through callback', () => {
  const save = {};
  let writes = 0;
  const service = new TutorialService(save, () => { writes += 1; });
  assert.equal(service.shouldShow('demo_goal'), true);
  service.complete('demo_goal');
  assert.equal(service.shouldShow('demo_goal'), false);
  service.skipAll();
  assert.equal(service.shouldShow('first_battle'), false);
  assert.equal(writes, 2);
});

test('tutorial reset enables completed steps again', () => {
  const save = { tutorial: { skippedAll: true, completedSteps: ['demo_goal'] } };
  const service = new TutorialService(save);
  service.reset();
  assert.equal(service.shouldShow('demo_goal'), true);
});
