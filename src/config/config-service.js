import { cloneDefaultConfig } from './default-config.js';

export const CONFIG_STORAGE_KEY = 'tiny-signal-game.config';
export const SAVE_STORAGE_KEY = 'tiny-signal-game.save';

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export class ConfigService {
  loadDefaultConfig() { return cloneDefaultConfig(); }

  loadSavedConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  loadActiveConfig() {
    const saved = this.loadSavedConfig();
    return saved && this.validateConfig(saved).valid ? saved : this.loadDefaultConfig();
  }

  saveConfig(config) {
    const result = this.validateConfig(config);
    if (!result.valid) throw new Error(result.errors.join('\n'));
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }

  resetConfig() {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
    return this.loadDefaultConfig();
  }

  exportConfig(config) { return JSON.stringify(config, null, 2); }

  importConfig(json) {
    const config = JSON.parse(json);
    const result = this.validateConfig(config);
    if (!result.valid) throw new Error(result.errors.join('\n'));
    return config;
  }

  validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') return { valid: false, errors: ['配置根节点必须是对象'] };
    const required = ['global', 'player', 'monsters', 'foods', 'madnessStages', 'equipment', 'maps', 'farming'];
    required.forEach((key) => { if (!(key in config)) errors.push(`缺少配置分类：${key}`); });
    if (errors.length) return { valid: false, errors };

    ['maxHealth', 'maxHunger', 'maxMadness', 'extractDuration'].forEach((key) => {
      if (!isFiniteNumber(config.global[key]) || config.global[key] <= 0) errors.push(`global.${key} 必须大于 0`);
    });
    ['health', 'hunger', 'moveSpeed', 'baseAttack', 'attackRange', 'attackCooldown', 'inventoryCapacity'].forEach((key) => {
      if (!isFiniteNumber(config.player[key]) || config.player[key] < 0) errors.push(`player.${key} 必须是非负数`);
    });

    const uniqueIds = (items, label) => {
      const ids = new Set();
      items.forEach((item, index) => {
        if (!item.id) errors.push(`${label}[${index}] 缺少 id`);
        else if (ids.has(item.id)) errors.push(`${label} 存在重复 id：${item.id}`);
        ids.add(item.id);
      });
      return ids;
    };
    const monsterIds = uniqueIds(config.monsters, 'monsters');
    const foodIds = uniqueIds(config.foods, 'foods');
    uniqueIds(config.equipment, 'equipment');

    config.monsters.forEach((monster) => {
      ['health', 'moveSpeed', 'attackRange', 'attackCooldown', 'harvestDuration', 'meatYield'].forEach((key) => {
        if (!isFiniteNumber(monster[key]) || monster[key] < 0) errors.push(`${monster.id}.${key} 必须是非负数`);
      });
      if (monster.canChase && monster.maxChaseDistance < monster.attackRange) errors.push(`${monster.name}：最大追踪距离不能小于攻击距离`);
      if (monster.detectRadius > monster.loseTargetRadius && monster.hostile) errors.push(`${monster.name}：丢失目标距离不能小于感知距离`);
    });

    const sortedStages = [...config.madnessStages].sort((a, b) => a.min - b.min);
    sortedStages.forEach((stage, index) => {
      if (stage.min > stage.max) errors.push(`疯狂阶段 ${stage.state} 的最小值大于最大值`);
      if (index && stage.min <= sortedStages[index - 1].max) errors.push(`疯狂阶段 ${stage.state} 与上一阶段范围重叠`);
    });

    config.maps.forEach((map) => {
      const inside = (point) => point.x >= 0 && point.y >= 0 && point.x <= map.width && point.y <= map.height;
      if (!inside(map.playerSpawn)) errors.push(`${map.name}：玩家出生点超出地图边界`);
      if (!inside(map.extractPoint)) errors.push(`${map.name}：撤离点超出地图边界`);
      map.monsterSpawns.forEach((spawn) => {
        if (!monsterIds.has(spawn.monsterId)) errors.push(`${map.name} 引用了不存在的怪物：${spawn.monsterId}`);
        if (!inside(spawn)) errors.push(`${map.name} 的怪物出生点超出边界`);
      });
    });
    config.farming.forEach((crop) => {
      if (!foodIds.has(crop.yieldItem)) errors.push(`${crop.name} 引用了不存在的产物：${crop.yieldItem}`);
    });
    return { valid: errors.length === 0, errors };
  }
}

export function createInitialSave(config) {
  return {
    safeFood: config.shelter?.initialSafeFood ?? 4,
    monsterMeat: config.shelter?.initialMonsterMeat ?? 0,
    madness: config.player.madness,
    expeditions: 0,
    farm: { planted: false, cyclesLeft: 0 },
    lastResult: null
  };
}

export function loadSave(config) {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY));
    return value && typeof value === 'object' ? value : createInitialSave(config);
  } catch { return createInitialSave(config); }
}

export function persistSave(save) {
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}
