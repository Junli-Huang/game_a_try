const EAT_MESSAGES = {
  clear: ['肉里带着一股无法散去的铁锈味。', '你强迫自己咽了下去。', '胃里传来一阵短暂的抽搐。'],
  whisper: ['味道似乎没有上次那么难以接受。', '咀嚼声里混进了细小的低语。', '你开始怀念这种温热的味道。'],
  fervor: ['你几乎没有咀嚼。', '身体比你更早认出了食物。', '普通食物已经显得过于寡淡。'],
  edge: ['你没有等它完全冷下来。', '它曾经是什么，已经不重要了。', '你终于明白，饥饿并不是痛苦。']
};
const STAGE_MESSAGES = {
  whisper: '你听见了并不存在的呼吸声。',
  fervor: '你的心跳变得平稳。\n这具身体正在适应。',
  edge: '雾中的东西不再令你恐惧。\n它们看起来更像食物。'
};
export const WHISPERS = ['还不够。', '它还在附近。', '肉不会背叛你。', '回去做什么？', '你比上一次更强了。', '别让它冷掉。', '雾记得你。'];

export class MadnessPresentationService {
  constructor(config) { this.config = config; this.lastWhisper = null; }
  stage(value) {
    const stages = this.config.madnessStages;
    const index = stages.findIndex((item) => value >= item.min && value <= item.max);
    const source = stages[Math.max(0, index)];
    return { ...source, id: source.id || ['clear', 'whisper', 'fervor', 'edge'][Math.max(0, index)], index: Math.max(0, index) };
  }
  stageChange(before, after) {
    const from = this.stage(before), to = this.stage(after);
    if (from.index === to.index) return null;
    return { stage: to, message: to.index < from.index ? '低语远了一些。' : STAGE_MESSAGES[to.id] };
  }
  eatMessage(value) { const pool = EAT_MESSAGES[this.stage(value).id] || EAT_MESSAGES.clear; return pool[Math.floor(Math.random() * pool.length)]; }
  whisper() {
    const pool = WHISPERS.filter((item) => item !== this.lastWhisper);
    this.lastWhisper = pool[Math.floor(Math.random() * pool.length)];
    return this.lastWhisper;
  }
}
