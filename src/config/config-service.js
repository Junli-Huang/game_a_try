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
    const saved = this.migrateConfig(this.loadSavedConfig());
    return saved && this.validateConfig(saved).valid ? saved : this.loadDefaultConfig();
  }

  migrateConfig(config) {
    if (!config) return config;
    const migrated = structuredClone(config);
    if (Array.isArray(migrated.battle?.playerActions)) {
      migrated.battle.playerActions = migrated.battle.playerActions.map((action) => action === 'eat' ? 'item' : action);
    }
    const defaults = this.loadDefaultConfig();
    const defaultFoods = new Map(defaults.foods.map((food) => [food.id, food]));
    migrated.foods = (migrated.foods || defaults.foods).map((food) => ({
      ...food,
      healthRestore: food.healthRestore ?? defaultFoods.get(food.id)?.healthRestore ?? 0
    }));
    const monsters = Array.isArray(migrated.monsters) ? migrated.monsters : structuredClone(defaults.monsters);
    const monsterIds = new Set(monsters.map((monster) => monster.id));
    migrated.monsters = [
      ...monsters,
      ...defaults.monsters.filter((monster) => monster.spawnConfig?.enabled && !monsterIds.has(monster.id)).map((monster) => structuredClone(monster))
    ];
    migrated.version = '1.3.1';
    migrated.maps = (migrated.maps || defaults.maps).map((map, index) => ({
      ...(defaults.maps[index] || defaults.maps[0]),
      ...map,
      extractionPoints: map.extractionPoints || (map.extractPoint ? [map.extractPoint] : structuredClone(defaults.maps[0].extractionPoints)),
      random: { ...defaults.maps[0].random, ...(map.random || {}) },
      randomSpawnRules: map.randomSpawnRules || []
    }));
    return migrated;
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
    const config = this.migrateConfig(JSON.parse(json));
    const result = this.validateConfig(config);
    if (!result.valid) throw new Error(result.errors.join('\n'));
    return config;
  }

  validateConfig(config) {
    const errors = [];
    if (!config || typeof config !== 'object') return { valid: false, errors: ['配置根节点必须是对象'] };
    const required = ['global', 'player', 'monsters', 'foods', 'madnessStages', 'equipment', 'maps', 'farming', 'battle', 'ui', 'demoGoal', 'madnessPresentation', 'mapEvents', 'events', 'audio'];
    required.forEach((key) => { if (!(key in config)) errors.push(`缺少配置分类：${key}`); });
    if (errors.length) return { valid: false, errors };

    ['maxHealth', 'maxHunger', 'maxMadness'].forEach((key) => {
      if (!isFiniteNumber(config.global[key]) || config.global[key] <= 0) errors.push(`global.${key} 必须大于 0`);
    });
    ['health', 'hunger', 'speed', 'moveSpeed', 'baseAttack', 'attackRange', 'attackCooldown', 'inventoryCapacity'].forEach((key) => {
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

    config.foods.forEach((food) => {
      ['healthRestore', 'hungerRestore', 'madnessGain', 'maxStack'].forEach((key) => {
        if (!isFiniteNumber(food[key]) || food[key] < 0) errors.push(`${food.id}.${key} 必须是非负数`);
      });
    });

    config.monsters.forEach((monster) => {
      ['health', 'speed', 'alertDuration', 'attackIntentRange', 'actionChance', 'maxMovesPerTurn', 'harvestTurns', 'meatYield'].forEach((key) => {
        if (!isFiniteNumber(monster[key]) || monster[key] < 0) errors.push(`${monster.id}.${key} 必须是非负数`);
      });
      if (monster.canChase && monster.maxChaseDistance < monster.detectRange) errors.push(`${monster.name}：最大追踪距离不能小于感知距离`);
      const spawn = monster.spawnConfig;
      if (spawn?.enabled) {
        ['intervalTurns', 'initialDelayTurns', 'maxAliveChildren', 'spawnRadiusMin', 'spawnRadiusMax'].forEach((key) => {
          if (!Number.isInteger(spawn[key]) || spawn[key] < 0) errors.push(`${monster.name}：产出配置 ${key} 必须是非负整数`);
        });
        if (spawn.maxTotalChildren != null && (!Number.isInteger(spawn.maxTotalChildren) || spawn.maxTotalChildren < 0)) errors.push(`${monster.name}：总产出上限必须是非负整数`);
        if (spawn.spawnRadiusMax < spawn.spawnRadiusMin) errors.push(`${monster.name}：产出最大半径不能小于最小半径`);
      }
    });

    const sortedStages = [...config.madnessStages].sort((a, b) => a.min - b.min);
    sortedStages.forEach((stage, index) => {
      if (stage.min > stage.max) errors.push(`疯狂阶段 ${stage.state} 的最小值大于最大值`);
      if (index && stage.min <= sortedStages[index - 1].max) errors.push(`疯狂阶段 ${stage.state} 与上一阶段范围重叠`);
    });

    config.maps.forEach((map) => {
      const inside = (point) => point && point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
      if (!Number.isInteger(map.width) || map.width < 10 || map.width > 50) errors.push(`${map.name}：地图宽度必须为 10～50 的整数`);
      if (!Number.isInteger(map.height) || map.height < 10 || map.height > 50) errors.push(`${map.name}：地图高度必须为 10～50 的整数`);
      if (!inside(map.playerSpawn)) errors.push(`${map.name}：玩家出生点超出地图边界`);
      const extracts = map.extractionPoints || [map.extractPoint];
      if (!extracts.length) errors.push(`${map.name}：至少需要一个撤离点`);
      extracts.forEach((point) => { if (!inside(point)) errors.push(`${map.name}：撤离点超出地图边界`); });
      if (!map.fogOfWar || map.fogOfWar.visionRadius < 1) errors.push(`${map.name}：视野半径必须大于 0`);
      const obstacles = new Set();
      (map.obstacles || []).forEach((obstacle) => {
        const key = `${obstacle.x},${obstacle.y}`;
        if (!inside(obstacle)) errors.push(`${map.name}：障碍格超出地图边界`);
        if (obstacles.has(key)) errors.push(`${map.name}：地图对象不能重叠（重复障碍格）`);
        obstacles.add(key);
      });
      const occupied = new Set([`${map.playerSpawn.x},${map.playerSpawn.y}`]);
      if (obstacles.has(`${map.playerSpawn.x},${map.playerSpawn.y}`)) errors.push(`${map.name}：玩家出生点不能位于障碍格`);
      extracts.forEach((point) => {
        const key = `${point.x},${point.y}`;
        if (obstacles.has(key)) errors.push(`${map.name}：撤离点不能位于障碍格`);
        if (occupied.has(key)) errors.push(`${map.name}：撤离点不能与其他对象重叠`);
        occupied.add(key);
      });
      map.monsterSpawns.forEach((spawn) => {
        if (!monsterIds.has(spawn.monsterId)) errors.push(`${map.name} 引用了不存在的怪物：${spawn.monsterId}`);
        if (!inside(spawn)) errors.push(`${map.name} 的怪物出生点超出边界`);
        if (!Number.isInteger(spawn.count) || spawn.count < 1) errors.push(`${map.name}：固定怪物数量必须是正整数`);
        if (obstacles.has(`${spawn.x},${spawn.y}`)) errors.push(`${map.name}：怪物不能位于障碍格`);
        const key = `${spawn.x},${spawn.y}`;
        if (occupied.has(key)) errors.push(`${map.name}：固定怪物不能与其他对象重叠`);
        occupied.add(key);
      });
      (map.randomSpawnRules || []).forEach((rule) => {
        if (!monsterIds.has(rule.monsterConfigId)) errors.push(`${map.name} 随机规则引用了不存在的怪物：${rule.monsterConfigId}`);
        if (rule.minCount < 0 || rule.maxCount < rule.minCount) errors.push(`${map.name}：随机规则 ${rule.id} 数量范围无效`);
      });
    });
    config.monsters.forEach((monster) => {
      if (monster.spawnConfig?.enabled && !monsterIds.has(monster.spawnConfig.monsterConfigId)) errors.push(`${monster.name} 产出配置引用了不存在的怪物：${monster.spawnConfig.monsterConfigId}`);
    });
    config.farming.forEach((crop) => {
      if (!foodIds.has(crop.yieldItem)) errors.push(`${crop.name} 引用了不存在的产物：${crop.yieldItem}`);
    });
    ['requiredExtractions', 'requiredMonsterMeat', 'maxExpeditionFailures'].forEach((key) => {
      if (!isFiniteNumber(config.demoGoal[key]) || config.demoGoal[key] < 1) errors.push(`demoGoal.${key} 必须大于 0`);
    });
    if (!isFiniteNumber(config.mapEvents.triggerChancePerNewTile) || config.mapEvents.triggerChancePerNewTile < 0 || config.mapEvents.triggerChancePerNewTile > 1) errors.push('mapEvents.triggerChancePerNewTile 必须在 0～1 之间');
    uniqueIds(config.events, 'events');
    ['masterVolume', 'bgmVolume', 'sfxVolume'].forEach((key) => {
      if (!isFiniteNumber(config.audio[key]) || config.audio[key] < 0 || config.audio[key] > 1) errors.push(`audio.${key} 必须在 0～1 之间`);
    });
    return { valid: errors.length === 0, errors };
  }
}

export function createInitialSave(config) {
  return {
    health: config.player.health,
    safeFood: config.shelter?.initialSafeFood ?? 4,
    monsterMeat: config.shelter?.initialMonsterMeat ?? 0,
    madness: config.player.madness,
    expeditions: 0,
    successfulExtractions: 0,
    expeditionFailures: 0,
    totalMonsterMeatReturned: 0,
    enemiesKilled: 0,
    corpsesHarvested: 0,
    nestsDestroyed: 0,
    totalMonsterMeatConsumed: 0,
    highestMadness: config.player.madness,
    introSeen: false,
    tutorial: { skippedAll: false, completedSteps: [] },
    goalResultSeen: false,
    seenEventIds: [],
    farm: { planted: false, cyclesLeft: 0 },
    lastResult: null,
    activeExpedition: null
  };
}

export function loadSave(config) {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY));
    const initial = createInitialSave(config);
    return value && typeof value === 'object' ? {
      ...initial, ...value,
      farm: { ...initial.farm, ...value.farm },
      tutorial: {
        ...initial.tutorial, ...(value.tutorial || {}),
        completedSteps: Array.isArray(value.tutorial?.completedSteps) ? [...new Set(value.tutorial.completedSteps)] : []
      }
    } : initial;
  } catch { return createInitialSave(config); }
}

export function persistSave(save) {
  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}
