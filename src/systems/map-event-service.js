export class MapEventService {
  constructor(config, random = Math.random) { this.config = config; this.random = random; this.triggered = new Set(); this.count = 0; this.lastStep = -Infinity; }
  tryTrigger(context) {
    const rules = this.config.mapEvents;
    if (!rules.enabled || !context.firstVisit || this.count >= rules.maxEventsPerExpedition || context.step - this.lastStep < rules.minStepsBetweenEvents || this.random() > rules.triggerChancePerNewTile) return null;
    const choices = this.config.events.filter((event) => event.enabled && (!event.minMadness || context.madness >= event.minMadness) && (!event.maxMadness || context.madness <= event.maxMadness) && (!event.oncePerExpedition || !this.triggered.has(event.id)) && (!event.oncePerSave || !context.seenEventIds.includes(event.id)));
    const total = choices.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.random() * total;
    const selected = choices.find((item) => (roll -= item.weight) <= 0);
    if (!selected) return null;
    this.count += 1; this.lastStep = context.step; this.triggered.add(selected.id);
    return selected;
  }
  effectsFor(choice) {
    if (choice.outcomes?.length) return choice.outcomes[Math.floor(this.random() * choice.outcomes.length)];
    return choice.effects || [];
  }
}
