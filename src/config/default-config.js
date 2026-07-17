export const DEFAULT_CONFIG = {
  version: 1,
  global: {
    maxHealth: 100,
    maxHunger: 100,
    maxMadness: 100,
    hungerDrainPerSecond: 1.1,
    starvationDamagePerSecond: 7,
    extractDuration: 3,
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
      radius: 17, moveSpeed: 0, attackRange: 0, attackCooldown: 1.5,
      canMove: false, canWander: false, wanderRadius: 0, wanderInterval: 3,
      wanderSpeedMultiplier: 1, hostile: false, detectRadius: 0,
      loseTargetRadius: 0, loseTargetDelay: 0, canChase: false,
      maxChaseDistance: 0, maxHomeDistance: 0, chaseSpeedMultiplier: 1,
      returnHome: false, returnSpeedMultiplier: 1, canHarvest: true,
      harvestDuration: 2, meatYield: 2, carriedLoot: []
    },
    {
      id: 'wanderer', name: '游荡者', color: '#e5a65c', health: 42, attack: 8,
      radius: 18, moveSpeed: 52, attackRange: 33, attackCooldown: 1.15,
      canMove: true, canWander: true, wanderRadius: 105, wanderInterval: 2.4,
      wanderSpeedMultiplier: 0.72, hostile: true, detectRadius: 138,
      loseTargetRadius: 220, loseTargetDelay: 2, canChase: true,
      maxChaseDistance: 175, maxHomeDistance: 215, chaseSpeedMultiplier: 1.15,
      returnHome: true, returnSpeedMultiplier: 1.25, canHarvest: true,
      harvestDuration: 3, meatYield: 3, carriedLoot: []
    },
    {
      id: 'tracker', name: '寻迹者', color: '#d56878', health: 65, attack: 13,
      radius: 20, moveSpeed: 60, attackRange: 36, attackCooldown: 1.35,
      canMove: true, canWander: false, wanderRadius: 75, wanderInterval: 3,
      wanderSpeedMultiplier: 0.6, hostile: true, detectRadius: 215,
      loseTargetRadius: 315, loseTargetDelay: 2.4, canChase: true,
      maxChaseDistance: 310, maxHomeDistance: 255, chaseSpeedMultiplier: 1.12,
      returnHome: true, returnSpeedMultiplier: 1.35, canHarvest: true,
      harvestDuration: 4, meatYield: 5, carriedLoot: []
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
      id: 'outdoor_01', name: '雾蚀林缘', width: 960, height: 540,
      playerSpawn: { x: 95, y: 285 },
      extractPoint: { x: 885, y: 92, radius: 48 },
      monsterSpawns: [
        { monsterId: 'passive', x: 270, y: 180, count: 2, spread: 45 },
        { monsterId: 'wanderer', x: 510, y: 310, count: 2, spread: 70 },
        { monsterId: 'tracker', x: 750, y: 360, count: 1, spread: 35 }
      ],
      obstacles: [
        { x: 360, y: 70, width: 110, height: 45 },
        { x: 590, y: 420, width: 145, height: 38 },
        { x: 675, y: 125, width: 58, height: 105 }
      ]
    }
  ],
  farming: [
    { id: 'shelter_crop', name: '灰麦', growthCycles: 2, seedCost: 1, yieldItem: 'safe_food', yieldCount: 3, allowShelter: true, allowOutdoor: false }
  ],
  shelter: { initialSafeFood: 4, initialMonsterMeat: 0 }
};

export function cloneDefaultConfig() {
  return structuredClone(DEFAULT_CONFIG);
}
