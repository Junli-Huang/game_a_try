export const DEFAULT_CONFIG = {
  version: '1.3.3',
  global: {
    maxHealth: 100,
    maxHunger: 100,
    maxMadness: 100,
    hungerCostPerMove: 1,
    starvationDamagePerAction: 6,
    loseLootOnDeath: true,
    keepEquipmentOnDeath: true,
    keepMadnessOnDeath: true,
    enableShelterFarming: true,
    enableOutdoorFarming: false
  },
  player: {
    health: 100,
    hunger: 100,
    madness: 0,
    maxMadnessResistance: 10,
    initialMadnessResistance: 10,
    speed: 10,
    radius: 16,
    moveSpeed: 165,
    baseAttack: 10,
    attackRange: 48,
    attackCooldown: 0.55,
    invulnerableDuration: 0.35,
    inventoryCapacity: 8,
    harvestSpeedMultiplier: 1,
    harvestYieldMultiplier: 1
  },
  monsters: [
    {
      id: 'passive', name: '静默菌兽', color: '#8ac58a', health: 24, attack: 0,
      defense: 0, speed: 4, actionSpeed: 1, canMove: false, canWander: false,
      actionChance: 0, maxMovesPerTurn: 0, wanderRadius: 0,
      hostile: false, detectRange: 0, detectRadius: 0, alertDuration: 0, attackIntentRange: 0, canChase: false,
      vision: { enabled: true, range: 2, angle: 90, rotateWhenIdle: true, canRotateBeforeMove: true, canDetectAfterMove: true },
      maxChaseDistance: 0, maxHomeDistance: 0, returnHome: false,
      disengageCooldownTurns: 1, canHarvest: true,
      harvestTurns: 2, meatYield: 2, carriedLoot: []
    },
    {
      id: 'wanderer', name: '游荡者', color: '#e5a65c', health: 42, attack: 8,
      defense: 1, speed: 8, actionSpeed: 1, canMove: true, canWander: true,
      actionChance: 0.72, maxMovesPerTurn: 1, wanderRadius: 4,
      hostile: true, detectRange: 3, detectRadius: 3, alertDuration: 2, attackIntentRange: 1, canChase: true,
      vision: { enabled: true, range: 3, angle: 90, rotateWhenIdle: true, canRotateBeforeMove: true, canDetectAfterMove: true },
      maxChaseDistance: 5, maxHomeDistance: 6, returnHome: true,
      disengageCooldownTurns: 2, canHarvest: true,
      harvestTurns: 3, meatYield: 3, carriedLoot: []
    },
    {
      id: 'tracker', name: '寻迹者', color: '#d56878', health: 65, attack: 13,
      defense: 2, speed: 12, actionSpeed: 1.2, canMove: true, canWander: false,
      actionChance: 1, maxMovesPerTurn: 1, wanderRadius: 3,
      hostile: true, detectRange: 5, detectRadius: 5, alertDuration: 1, attackIntentRange: 1, canChase: true,
      vision: { enabled: true, range: 5, angle: 90, rotateWhenIdle: true, canRotateBeforeMove: true, canDetectAfterMove: true },
      maxChaseDistance: 8, maxHomeDistance: 7, returnHome: true,
      disengageCooldownTurns: 3, canHarvest: true,
      harvestTurns: 4, meatYield: 5, carriedLoot: []
    },
    {
      id: 'basic_nest', name: '腐化巢穴', color: '#a66ed1', health: 30, attack: 0,
      defense: 2, speed: 0, actionSpeed: 0, canMove: false, canWander: false,
      actionChance: 0, maxMovesPerTurn: 0, wanderRadius: 0,
      hostile: false, detectRange: 0, detectRadius: 0, alertDuration: 0, attackIntentRange: 0, canChase: false,
      vision: { enabled: false, range: 0, angle: 90, rotateWhenIdle: false, canRotateBeforeMove: false, canDetectAfterMove: false },
      maxChaseDistance: 0, maxHomeDistance: 0, returnHome: false,
      disengageCooldownTurns: 1, canHarvest: true,
      harvestTurns: 4, meatYield: 5, carriedLoot: [],
      spawnConfig: {
        enabled: true, monsterConfigId: 'wanderer', intervalTurns: 6, initialDelayTurns: 3,
        maxAliveChildren: 4, maxTotalChildren: 8, spawnRadiusMin: 1, spawnRadiusMax: 3,
        spawnOnVisibleTile: true, requireWalkableTile: true, childHomeLinkedToSpawner: true
      }
    }
  ],
  foods: [
    { id: 'safe_food', name: '储备粮', type: 'safe', healthRestore: 0, hungerRestore: 32, madnessGain: 0, allowOutdoor: true, allowShelter: true, maxStack: 20 },
    { id: 'monster_meat', name: '异变肉块', type: 'corrupted', healthRestore: 10, hungerRestore: 26, madnessGain: 12, allowOutdoor: true, allowShelter: true, maxStack: 20 }
  ],
  monsterMeat: { maxMadness: 12 },
  relic: {
    name: '静默圣遗物',
    enabled: true,
    maxPurification: 100,
    initialPurification: 100,
    resistanceRestoreCostMultiplier: 1,
    meatPurificationCostMultiplier: 1,
    protectsShelter: true
  },
  madnessStages: [
    { min: 0, max: 29, attackMultiplier: 1, state: '清醒', effectIntensity: 0 },
    { min: 30, max: 59, attackMultiplier: 1.15, state: '低语', effectIntensity: 0.25 },
    { min: 60, max: 89, attackMultiplier: 1.35, state: '狂热', effectIntensity: 0.55 },
    { min: 90, max: 100, attackMultiplier: 1.6, state: '失控边缘', effectIntensity: 0.9 }
  ],
  equipment: [
    { id: 'starter_blade', name: '旧猎刀', slot: 'weapon', attack: 8, defense: 0, attackSpeedMultiplier: 1, attackRangeBonus: 0, harvestSpeedMultiplier: 1.2, harvestYieldMultiplier: 1, defaultEquipped: true },
    { id: 'starter_coat', name: '旧防护服', slot: 'armor', attack: 0, defense: 3, attackSpeedMultiplier: 1, attackRangeBonus: 0, harvestSpeedMultiplier: 1, harvestYieldMultiplier: 1, defaultEquipped: true }
  ],
  maps: [
    {
      id: 'outdoor_01', name: '雾蚀林缘', width: 20, height: 20,
      allowDiagonalMove: false,
      environmentMadness: { enabled: true, amount: 0.1, intervalSeconds: 5 },
      fogOfWar: { enabled: true, visionRadius: 3, shape: 'square', terrainBlocksVision: false, exploredBrightness: 0.38, showEnemyMemory: true, showCorpseMemory: true },
      playerSpawn: { x: 1, y: 10 },
      extractPoint: { x: 18, y: 2, requiredTurns: 3 },
      extractionPoints: [{ x: 18, y: 2, requiredTurns: 3 }, { x: 18, y: 17, requiredTurns: 3 }],
      random: { useFixedSeed: true, seed: 'fog-v13-demo' },
      randomSpawnRules: [
        { id: 'random-wanderers', enabled: true, monsterConfigId: 'wanderer', minCount: 1, maxCount: 2,
          allowedArea: { x: 4, y: 3, width: 13, height: 14 }, excludedAreas: [], minDistanceFromPlayerSpawn: 5,
          minDistanceFromExtraction: 3, minDistanceBetweenSameType: 2, minDistanceBetweenAnyMonster: 1, placementAttempts: 120 }
      ],
      monsterSpawns: [
        { monsterId: 'passive', x: 5, y: 6, count: 2 },
        { monsterId: 'wanderer', x: 10, y: 12, count: 2 },
        { monsterId: 'tracker', x: 15, y: 15, count: 1 },
        { monsterId: 'basic_nest', x: 13, y: 6, count: 1 }
      ],
      obstacles: [
        { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
        { x: 8, y: 7 }, { x: 8, y: 8 }, { x: 8, y: 9 },
        { x: 12, y: 15 }, { x: 13, y: 15 }, { x: 14, y: 15 },
        { x: 16, y: 5 }, { x: 16, y: 6 }, { x: 16, y: 7 }
      ]
    }
  ],
  battle: {
    playerActions: ['attack', 'defend', 'item', 'escape'],
    initiatorActsFirst: true,
    baseEscapeChance: 0.55,
    failedEscapeEnemyAttack: true,
    defenseDamageReduction: 0.5,
    allowFoodInBattle: true,
    victoryPlayerMovesIntoEnemyTile: true,
    useSpeedOrder: true,
    battleTransition: true,
    battleResultDelay: 2
  },
  ui: {
    showEnemyAlert: true,
    showAttackIntent: true,
    highlightInteract: true,
    showGoal: true,
    showShortcuts: true,
    showEnemyStateIcons: true,
    showEnemyVision: true,
    transitionDurationMs: 600
  },
  demoGoal: {
    enabled: true,
    requiredExtractions: 3,
    requiredMonsterMeat: 12,
    maxExpeditionFailures: 3,
    showGoalOnShelter: true,
    showGoalOnOutdoorHud: true
  },
  madnessPresentation: {
    enabled: true,
    showStageMessages: true,
    showWhispers: true,
    enableEdgeVignette: true,
    enableUiPulse: true,
    enableUiJitter: true,
    reducedMotion: false
  },
  mapEvents: {
    enabled: true,
    triggerChancePerNewTile: 0.08,
    maxEventsPerExpedition: 3,
    minStepsBetweenEvents: 5
  },
  events: [
    { id: 'abandoned_pack', title: '废弃背包', description: '一个发霉的背包被压在碎石下面。\n\n拉链上沾着已经干涸的血。', weight: 3, enabled: true, oncePerExpedition: true, choices: [
      { id: 'open', label: '打开背包', outcomes: [[{ type: 'safeFood', value: 1 }], [{ type: 'message', value: '什么也没有找到。' }], [{ type: 'madness', value: 3 }]] },
      { id: 'leave', label: '离开', effects: [] }
    ] },
    { id: 'warm_campfire', title: '未熄灭的火堆', description: '灰烬下面仍有一点温度。\n\n刚才似乎还有人在这里。', weight: 2, enabled: true, choices: [
      { id: 'rest', label: '停下来休息', effects: [{ type: 'health', value: 5 }, { type: 'advanceTurn', value: 1 }] },
      { id: 'go', label: '继续前进', effects: [] }
    ] },
    { id: 'torn_note', title: '残缺笔记', description: '纸上只剩下一段还能辨认的字：\n\n“不要相信你离开视野后留下的东西。”', weight: 2, enabled: true, choices: [{ id: 'read', label: '收起笔记', effects: [{ type: 'madness', value: 2 }] }] },
    { id: 'rotten_crate', title: '腐烂的储藏箱', description: '木箱里传来甜腻的腐臭味。', weight: 2, enabled: true, choices: [
      { id: 'search', label: '翻找', outcomes: [[{ type: 'monsterMeat', value: 1 }], [{ type: 'safeFood', value: 1 }], [{ type: 'health', value: -3 }], [{ type: 'madness', value: 5 }]] },
      { id: 'leave', label: '不碰它', effects: [] }
    ] },
    { id: 'distant_steps', title: '远处的脚步', description: '雾里传来有节奏的脚步声。\n\n它没有靠近，也没有远去。', weight: 2, enabled: true, choices: [{ id: 'listen', label: '继续前进', effects: [{ type: 'madness', value: 3 }] }] },
    { id: 'strange_corpse', title: '陌生尸体', description: '尸体穿着和你相似的装备。\n\n脸已经无法辨认。', weight: 2, enabled: true, choices: [
      { id: 'search', label: '搜查', effects: [{ type: 'safeFood', value: 1 }, { type: 'madness', value: 5 }] },
      { id: 'bury', label: '掩埋', effects: [{ type: 'madness', value: -2 }, { type: 'advanceTurn', value: 1 }] }
    ] },
    { id: 'fog_call', title: '雾中的呼唤', description: '有人在雾里叫你的名字。\n\n声音来自撤离点的反方向。', weight: 2, enabled: true, minMadness: 30, choices: [
      { id: 'answer', label: '回应', effects: [{ type: 'madness', value: 8 }] },
      { id: 'silent', label: '保持沉默', effects: [{ type: 'madness', value: 2 }] }
    ] },
    { id: 'familiar_smell', title: '熟悉的味道', description: '你闻到了刚切开的肉的味道。\n\n附近明明什么都没有。', weight: 2, enabled: true, minMadness: 60, choices: [{ id: 'endure', label: '忍住饥饿', effects: [{ type: 'madness', value: 4 }] }] }
  ],
  audio: {
    enabled: true,
    masterVolume: 0.8,
    bgmVolume: 0.5,
    sfxVolume: 0.8,
    muted: false
  },
  farming: [
    { id: 'shelter_crop', name: '灰麦', growthCycles: 2, seedCost: 1, yieldItem: 'safe_food', yieldCount: 3, allowShelter: true, allowOutdoor: false }
  ],
  shelter: { initialSafeFood: 4, initialMonsterMeat: 0 }
};

export function cloneDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
