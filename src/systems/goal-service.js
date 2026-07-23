export class GoalService {
  constructor(config) { this.config = config.demoGoal; }

  progress(save) {
    return {
      extractions: save.successfulExtractions || 0,
      meat: save.totalMonsterMeatReturned || 0,
      failures: save.expeditionFailures || 0
    };
  }

  status(save) {
    if (!this.config.enabled) return { state: 'disabled' };
    const value = this.progress(save);
    if (value.extractions >= this.config.requiredExtractions && value.meat >= this.config.requiredMonsterMeat) return { state: 'victory', reason: 'goal', value };
    if (value.failures >= this.config.maxExpeditionFailures) return { state: 'failure', reason: 'failures', value };
    const meatCount = Array.isArray(save.monsterMeat) ? save.monsterMeat.length : (save.monsterMeat || 0);
    if ((save.safeFood || 0) <= 0 && meatCount <= 0) return { state: 'failure', reason: 'food', value };
    return { state: 'active', value };
  }
}
