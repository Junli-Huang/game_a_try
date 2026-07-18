export const DEFAULT_CONFIG = {
  version: '1.1.1',
  global: {
    maxHealth: 100,
    maxHunger: 100,
    maxMadness: 100,
    hungerCostPerMove: 1,
    hungerCostPerBattleRound: 1,
    hungerCostPerHarvestRound: 1,
    hungerCostPerWait: 1,
    starvationDamagePerAction: 6,
    loseLootOnDeath: true,
    keepEquipmentOnDeath: true,
    keepMadnessOnDeath: true,
    enableShelterFarming: true,
    enableOutdoorFarming: false
  },
  player: {
    health: 100,
    hunger: 82,
    madness: 0,
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
      maxChaseDistance: 0, maxHomeDistance: 0, returnHome: false,
      disengageCooldownTurns: 1, canHarvest: true,
      harvestTurns: 2, meatYield: 2, carriedLoot: []
    },
    {
      id: 'wanderer', name: '游荡者', color: '#e5a65c', health: 42, attack: 8,
      defense: 1, speed: 8, actionSpeed: 1, canMove: true, canWander: true,
      actionChance: 0.72, maxMovesPerTurn: 1, wanderRadius: 4,
      hostile: true, detectRange: 3, detectRadius: 3, alertDuration: 2, attackIntentRange: 1, canChase: true,
      maxChaseDistance: 5, maxHomeDistance: 6, returnHome: true,
      disengageCooldownTurns: 2, canHarvest: true,
      harvestTurns: 3, meatYield: 3, carriedLoot: []
    },
    {
      id: 'tracker', name: '寻迹者', color: '#d56878', health: 65, attack: 13,
      defense: 2, speed: 12, actionSpeed: 1.2, canMove: true, canWander: false,
      actionChance: 1, maxMovesPerTurn: 1, wanderRadius: 3,
      hostile: true, detectRange: 5, detectRadius: 5, alertDuration: 1, attackIntentRange: 1, canChase: true,
      maxChaseDistance: 8, maxHomeDistance: 7, returnHome: true,
      disengageCooldownTurns: 3, canHarvest: true,
      harvestTurns: 4, meatYield: 5, carriedLoot: []
    }
  ],
  foods: [
    { id: 'safe_food', name: '储备粮', type: 'safe', hungerRestore: 32, madnessGain: 0, allowOutdoor: true, allowShelter: true, maxStack: 20 },
    { id: 'monster_meat', name: '异变肉块', type: 'corrupted', hungerRestore: 26, madnessGain: 12, allowOutdoor: true, allowShelter: true, maxStack: 20 }
  ],
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
      fogOfWar: { enabled: true, visionRadius: 3, shape: 'square', terrainBlocksVision: false, exploredBrightness: 0.38, showEnemyMemory: true, showCorpseMemory: true },
      playerSpawn: { x: 1, y: 10 },
      extractPoint: { x: 18, y: 2, requiredTurns: 3 },
      monsterSpawns: [
        { monsterId: 'passive', x: 5, y: 6, count: 2 },
        { monsterId: 'wanderer', x: 10, y: 12, count: 2 },
        { monsterId: 'tracker', x: 15, y: 15, count: 1 }
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
    playerActions: ['attack', 'defend', 'eat', 'escape'],
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
    highlightInteract: true
  },
  farming: [
    { id: 'shelter_crop', name: '灰麦', growthCycles: 2, seedCost: 1, yieldItem: 'safe_food', yieldCount: 3, allowShelter: true, allowOutdoor: false }
  ],
  shelter: { initialSafeFood: 4, initialMonsterMeat: 0 }
};

export function cloneDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
