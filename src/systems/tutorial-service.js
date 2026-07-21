export const TUTORIAL_STEPS = [
  'demo_goal', 'outdoor_movement', 'fog_of_war', 'enemy_alert', 'first_battle',
  'first_harvest', 'monster_meat', 'first_nest', 'first_extraction'
];

export function createTutorialState(value = {}) {
  return {
    skippedAll: Boolean(value.skippedAll),
    completedSteps: [...new Set(Array.isArray(value.completedSteps) ? value.completedSteps.filter((step) => TUTORIAL_STEPS.includes(step)) : [])]
  };
}

export class TutorialService {
  constructor(save, onChange = () => {}) {
    this.save = save;
    this.onChange = onChange;
    this.save.tutorial = createTutorialState(save.tutorial);
  }

  shouldShow(step) {
    return TUTORIAL_STEPS.includes(step) && !this.save.tutorial.skippedAll && !this.save.tutorial.completedSteps.includes(step);
  }

  complete(step) {
    if (!this.save.tutorial.completedSteps.includes(step)) this.save.tutorial.completedSteps.push(step);
    this.onChange(this.save);
  }

  skipAll() {
    this.save.tutorial.skippedAll = true;
    this.onChange(this.save);
  }

  reset() {
    this.save.tutorial = createTutorialState();
    this.onChange(this.save);
  }
}
