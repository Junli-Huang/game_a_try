import { MapEventService } from './systems/map-event-service.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const keyOf = (x, y) => `${x},${y}`;
const clone = (value) => structuredClone(value);

export class GridExplorationRuntime {
  constructor(canvas, config, save, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.save = save;
    this.callbacks = callbacks;
    this.mapConfig = config.maps[0];
    this.tileSize = Math.floor(760 / Math.max(this.mapConfig.width, this.mapConfig.height));
    this.canvas.width = this.mapConfig.width * this.tileSize;
    this.canvas.height = this.mapConfig.height * this.tileSize;
    this.running = false;
    this.mode = 'OUTDOOR_EXPLORATION';
    this.turn = 0;
    this.message = '雾中没有声音。每一步都会让世界向前。';
    this.boundKeyDown = (event) => this.onKeyDown(event);
    this.boundClick = (event) => this.onCanvasClick(event);
  }

  start() {
    this.tiles = this.createTiles();
    this.player = {
      x: this.mapConfig.playerSpawn.x, y: this.mapConfig.playerSpawn.y,
      health: this.config.player.health, hunger: this.config.player.hunger,
      madness: this.save.madness, loot: { monsterMeat: 0 }, dead: false
    };
    this.monsters = this.spawnMonsters();
    this.corpses = [];
    this.battle = null;
    this.visitedTiles = new Set([keyOf(this.player.x, this.player.y)]);
    this.eventService = new MapEventService(this.config);
    this.running = true;
    addEventListener('keydown', this.boundKeyDown);
    this.canvas.addEventListener('click', this.boundClick);
    this.updateVision();
    this.render();
  }

  stop() {
    this.running = false;
    removeEventListener('keydown', this.boundKeyDown);
    this.canvas.removeEventListener('click', this.boundClick);
  }

  createTiles() {
    const obstacles = new Set(this.mapConfig.obstacles.map((item) => keyOf(item.x, item.y)));
    const tiles = [];
    for (let y = 0; y < this.mapConfig.height; y += 1) {
      for (let x = 0; x < this.mapConfig.width; x += 1) {
        const blocked = obstacles.has(keyOf(x, y));
        tiles.push({ x, y, terrainId: blocked ? 'obstacle' : 'ground', walkable: !blocked, visibility: 'unexplored', rememberedContent: null });
      }
    }
    return tiles;
  }

  spawnMonsters() {
    const monsters = [];
    this.mapConfig.monsterSpawns.forEach((spawn) => {
      const config = this.config.monsters.find((item) => item.id === spawn.monsterId);
      if (!config) return;
      for (let index = 0; index < spawn.count; index += 1) {
        const position = this.findFreeSpawn(spawn.x, spawn.y, index, monsters);
        monsters.push({
          id: `${config.id}-${monsters.length}`, config, x: position.x, y: position.y,
          homeX: position.x, homeY: position.y, health: config.health,
          state: config.canWander ? 'Wander' : 'Idle', cooldownTurns: 0,
          alertTurns: 0, intent: null
        });
      }
    });
    return monsters;
  }

  findFreeSpawn(x, y, index, existing) {
    const offsets = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    for (let cursor = index; cursor < offsets.length + index; cursor += 1) {
      const offset = offsets[cursor % offsets.length];
      const candidate = { x: clamp(x + offset[0], 0, this.mapConfig.width - 1), y: clamp(y + offset[1], 0, this.mapConfig.height - 1) };
      if (this.tileAt(candidate.x, candidate.y)?.walkable && !existing.some((item) => item.x === candidate.x && item.y === candidate.y)) return candidate;
    }
    return { x, y };
  }

  tileAt(x, y) { return this.tiles?.[y * this.mapConfig.width + x]; }
  monsterAt(x, y) { return this.monsters.find((item) => item.x === x && item.y === y); }
  corpseAt(x, y) { return this.corpses.find((item) => item.x === x && item.y === y && !item.harvested); }

  contentAt(x, y) {
    const monster = this.monsterAt(x, y);
    const corpse = this.corpseAt(x, y);
    return {
      enemy: monster ? { id: monster.id, name: monster.config.name, color: monster.config.color, state: monster.state } : null,
      corpse: corpse ? { id: corpse.id, name: corpse.config.name, harvested: corpse.harvested } : null,
      extract: x === this.mapConfig.extractPoint.x && y === this.mapConfig.extractPoint.y
    };
  }

  updateVision() {
    const fog = this.mapConfig.fogOfWar;
    this.tiles.forEach((tile) => {
      if (tile.visibility === 'visible') tile.visibility = 'explored';
      const dx = Math.abs(tile.x - this.player.x), dy = Math.abs(tile.y - this.player.y);
      const visible = !fog.enabled || (fog.shape === 'manhattan' ? dx + dy <= fog.visionRadius : Math.max(dx, dy) <= fog.visionRadius);
      if (visible) {
        tile.visibility = 'visible';
        tile.rememberedContent = clone(this.contentAt(tile.x, tile.y));
      }
    });
  }

  onKeyDown(event) {
    if (!this.running) return;
    if (this.mode === 'BATTLE') {
      if (this.callbacks.onBattleKey?.(event.key)) event.preventDefault();
      return;
    }
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    const moves = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    const move = moves[event.key.toLowerCase()];
    if (move) { event.preventDefault(); this.movePlayer(...move); }
    if (event.key.toLowerCase() === 'e') { event.preventDefault(); this.interact(); }
  }

  onCanvasClick(event) {
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) * this.canvas.width / rect.width / this.tileSize);
    const y = Math.floor((event.clientY - rect.top) * this.canvas.height / rect.height / this.tileSize);
    if (manhattan(this.player, { x, y }) === 1) this.movePlayer(x - this.player.x, y - this.player.y);
  }

  movePlayer(dx, dy) {
    if (!this.running || this.mode !== 'OUTDOOR_EXPLORATION') return false;
    const target = { x: this.player.x + dx, y: this.player.y + dy };
    const tile = this.tileAt(target.x, target.y);
    if (!tile?.walkable) { this.setMessage('那里无法通行。'); return false; }
    const monster = this.monsterAt(target.x, target.y);
    if (monster) { this.startBattle(monster, 'player'); return true; }
    this.player.x = target.x; this.player.y = target.y;
    const firstVisit = !this.visitedTiles.has(keyOf(target.x, target.y));
    this.visitedTiles.add(keyOf(target.x, target.y));
    this.advanceMapTurn('move');
    if (this.mode === 'OUTDOOR_EXPLORATION' && firstVisit) this.tryMapEvent();
    return true;
  }

  tryMapEvent() {
    if (!this.callbacks.onMapEvent) return;
    const event = this.eventService.tryTrigger({ firstVisit: true, step: this.turn, madness: this.player.madness, hunger: this.player.hunger, seenEventIds: this.save.seenEventIds || [] });
    if (!event) return;
    this.mode = 'MAP_EVENT';
    this.callbacks.onMapEvent?.(event, (choice) => this.resolveMapEvent(event, choice));
  }

  resolveMapEvent(event, choice) {
    if (this.mode !== 'MAP_EVENT') return;
    const effects = this.eventService.effectsFor(choice), messages = [];
    effects.forEach((effect) => {
      if (effect.type === 'health') { this.player.health = clamp(this.player.health + effect.value, 0, this.config.global.maxHealth); messages.push(`生命 ${effect.value >= 0 ? '+' : ''}${effect.value}`); }
      if (effect.type === 'hunger' && effect.value > 0) { this.player.hunger = clamp(this.player.hunger + effect.value, 0, this.config.global.maxHunger); messages.push(`饥饿 +${effect.value}`); }
      if (effect.type === 'madness') { this.changeMadness(effect.value); messages.push(`疯狂 ${effect.value >= 0 ? '+' : ''}${effect.value}`); }
      if (effect.type === 'safeFood') { this.save.safeFood += effect.value; messages.push(`获得储备粮 ×${effect.value}`); }
      if (effect.type === 'monsterMeat') { const amount = Math.min(effect.value, this.config.player.inventoryCapacity - this.player.loot.monsterMeat); this.player.loot.monsterMeat += amount; messages.push(`获得异变肉块 ×${amount}`); }
      if (effect.type === 'message') messages.push(effect.value);
    });
    if (event.oncePerSave && !(this.save.seenEventIds || []).includes(event.id)) this.save.seenEventIds.push(event.id);
    this.mode = 'OUTDOOR_EXPLORATION';
    const turns = effects.filter((effect) => effect.type === 'advanceTurn').reduce((sum, effect) => sum + effect.value, 0);
    for (let index = 0; index < turns && this.mode === 'OUTDOOR_EXPLORATION'; index += 1) this.advanceMapTurn('wait', false);
    const finish = () => { this.setMessage(messages.join(' · ') || '你决定不再停留。'); this.updateVision(); this.render(); };
    if (this.callbacks.onMapEventResult) this.callbacks.onMapEventResult(messages, finish); else finish();
  }

  wait() {
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    this.setMessage('你停下来观察雾中的动静。');
    this.advanceMapTurn('wait');
  }

  getOutdoorItems() {
    return this.config.foods.filter((item) => item.allowOutdoor).map((item) => ({
      ...item,
      count: item.id === 'monster_meat' ? this.player.loot.monsterMeat : 0
    }));
  }

  useOutdoorItem(itemId) {
    if (!this.running || this.mode !== 'OUTDOOR_EXPLORATION') return { ok: false, message: '现在无法使用道具。' };
    const item = this.config.foods.find((food) => food.id === itemId && food.allowOutdoor);
    if (!item) return { ok: false, message: '这个道具不能在户外使用。' };
    if (item.id !== 'monster_meat' || this.player.loot.monsterMeat <= 0) return { ok: false, message: '背包里没有可用的异变肉块。' };
    this.eatMonsterMeat();
    this.setMessage(`你吃下${item.name}：饥饿 +${item.hungerRestore}，疯狂 +${item.madnessGain}。`);
    this.advanceMapTurn('wait');
    return { ok: true, item, hunger: this.player.hunger, madness: this.player.madness };
  }

  interact() {
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    const corpse = this.corpseAt(this.player.x, this.player.y);
    if (corpse) return this.harvest(corpse);
    if (this.player.x === this.mapConfig.extractPoint.x && this.player.y === this.mapConfig.extractPoint.y) return this.extract();
    this.setMessage('这个格子没有可以交互的对象。');
    this.render();
  }

  getInteraction() {
    const corpse = this.corpseAt(this.player.x, this.player.y);
    if (corpse) {
      const full = this.player.loot.monsterMeat >= this.config.player.inventoryCapacity;
      return { type: 'harvest', label: full ? '背包已满' : '切割尸体', enabled: !full, tone: 'danger' };
    }
    if (this.player.x === this.mapConfig.extractPoint.x && this.player.y === this.mapConfig.extractPoint.y) {
      return { type: 'extract', label: '开始撤离', enabled: true, tone: 'gold' };
    }
    return { type: null, label: '暂无交互', enabled: false, tone: 'muted' };
  }

  harvest(corpse) {
    const turns = Math.max(1, corpse.config.harvestTurns);
    this.setMessage(`开始切割，需要 ${turns} 个地图回合。`);
    for (let index = 0; index < turns && this.mode === 'OUTDOOR_EXPLORATION'; index += 1) this.advanceMapTurn('harvest', false);
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    const gear = this.getEquipmentStats();
    const free = this.config.player.inventoryCapacity - this.player.loot.monsterMeat;
    const amount = Math.min(free, Math.max(1, Math.floor(corpse.config.meatYield * this.config.player.harvestYieldMultiplier * gear.harvestYield)));
    corpse.harvested = true;
    this.player.loot.monsterMeat += amount;
    this.save.corpsesHarvested = (this.save.corpsesHarvested || 0) + 1;
    this.setMessage(`切割完成，获得 ${amount} 份异变肉块。`);
    this.updateVision(); this.render();
  }

  extract() {
    const turns = Math.max(1, this.mapConfig.extractPoint.requiredTurns);
    this.setMessage(`开始撤离，需要守住 ${turns} 个地图回合。`);
    for (let index = 0; index < turns && this.mode === 'OUTDOOR_EXPLORATION'; index += 1) this.advanceMapTurn('wait', false);
    if (this.mode === 'OUTDOOR_EXPLORATION') this.succeedExpedition();
  }

  advanceMapTurn(type, render = true) {
    this.turn += 1;
    this.consumeHunger(type);
    if (this.player.health <= 0) return this.failExpedition();
    const enemies = [...this.monsters];
    for (const monster of enemies) {
      if (this.mode !== 'OUTDOOR_EXPLORATION') break;
      this.updateMonster(monster);
    }
    this.updateVision();
    if (render) this.render();
  }

  consumeHunger(type) {
    if (type !== 'move') return;
    this.player.hunger = clamp(this.player.hunger - (this.config.global.hungerCostPerMove || 0), 0, this.config.global.maxHunger);
    if (this.player.hunger <= 0) this.player.health = clamp(this.player.health - this.config.global.starvationDamagePerAction, 0, this.config.global.maxHealth);
  }

  updateMonster(monster) {
    const cfg = monster.config;
    monster.intent = null;
    if (monster.cooldownTurns > 0) {
      monster.cooldownTurns -= 1;
      if (monster.cooldownTurns === 0) monster.state = cfg.canWander ? 'Wander' : 'Idle';
      return;
    }
    const playerDistance = manhattan(monster, this.player);
    const homeDistance = manhattan(monster, { x: monster.homeX, y: monster.homeY });
    const detectRadius = cfg.detectRadius ?? cfg.detectRange;
    if (cfg.hostile && cfg.canChase && playerDistance <= detectRadius && homeDistance <= cfg.maxHomeDistance && !['Alert', 'Chase', 'AttackIntent'].includes(monster.state)) {
      monster.state = 'Alert';
      monster.alertTurns = Math.max(1, cfg.alertDuration || 1);
      this.notify('alert', monster, '附近的怪物似乎察觉到了你的存在。');
      return;
    }
    if (monster.state === 'Alert') {
      monster.alertTurns -= 1;
      if (monster.alertTurns <= 0) {
        monster.state = 'Chase';
        this.notify('chase', monster, `危险！${cfg.name}正在接近。`);
      } else return;
    }
    if (['Chase', 'AttackIntent'].includes(monster.state) && (playerDistance > cfg.maxChaseDistance || homeDistance > cfg.maxHomeDistance)) monster.state = cfg.returnHome ? 'Return' : 'Idle';
    if (!cfg.canMove || Math.random() > cfg.actionChance) return;
    let target = null;
    if (['Chase', 'AttackIntent'].includes(monster.state)) target = this.bestStepToward(monster, this.player);
    else if (monster.state === 'Return') {
      target = this.bestStepToward(monster, { x: monster.homeX, y: monster.homeY });
      if (homeDistance === 0) monster.state = cfg.canWander ? 'Wander' : 'Idle';
    } else if (cfg.canWander) {
      monster.state = 'Wander';
      const choices = this.neighbors(monster.x, monster.y).filter((tile) => manhattan(tile, { x: monster.homeX, y: monster.homeY }) <= cfg.wanderRadius);
      target = choices[Math.floor(Math.random() * choices.length)];
    }
    if (!target) return;
    if (target.x === this.player.x && target.y === this.player.y) {
      if (monster.state !== 'AttackIntent') {
        monster.state = 'AttackIntent';
        monster.intent = { action: 'attackPlayer', dx: this.player.x - monster.x, dy: this.player.y - monster.y };
        this.notify('attack-intent', monster, '它盯上你了。下一回合将会接敌。');
        return;
      }
      return this.startBattle(monster, 'enemy');
    }
    if (!this.monsterAt(target.x, target.y)) { monster.x = target.x; monster.y = target.y; }
  }

  notify(type, monster, message) {
    const enabled = type === 'attack-intent' ? this.config.ui.showAttackIntent : this.config.ui.showEnemyAlert;
    if (!enabled) return;
    this.setMessage(message);
    this.callbacks.onNotice?.({ type, message, enemy: monster.config.name });
  }

  neighbors(x, y) {
    return [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => this.tileAt(x + dx, y + dy)).filter((tile) => tile?.walkable);
  }

  bestStepToward(entity, target) {
    return this.neighbors(entity.x, entity.y).filter((tile) => !this.monsterAt(tile.x, tile.y)).sort((a, b) => manhattan(a, target) - manhattan(b, target))[0] || null;
  }

  startBattle(monster, initiator) {
    if (this.mode !== 'OUTDOOR_EXPLORATION') return;
    this.mode = this.config.battle.battleTransition ? 'BATTLE_TRANSITION' : 'BATTLE';
    const playerSpeed = this.config.player.speed || 0;
    const enemySpeed = monster.config.speed || 0;
    const enemyFirst = this.config.battle.useSpeedOrder
      ? enemySpeed > playerSpeed
      : initiator === 'enemy' && this.config.battle.initiatorActsFirst;
    this.battle = { monster, initiator, round: 1, defending: false, enemyFirst, playerTurn: false,
      log: [`遭遇 ${monster.config.name}。`, `速度：你 ${playerSpeed} / 敌人 ${enemySpeed}，${enemyFirst ? '敌人' : '你'}先行动。`] };
    const enter = () => {
      if (!this.battle) return;
      this.mode = 'BATTLE';
      if (enemyFirst) {
        this.battle.log.push('敌人正在行动…');
        this.enemyAttack();
        if (this.player.health <= 0) return this.loseBattle();
      }
      this.battle.playerTurn = true;
      this.emitBattle();
    };
    if (this.config.battle.battleTransition && this.callbacks.onBattleTransition) {
      this.callbacks.onBattleTransition({ enemy: monster.config.name, color: monster.config.color }, enter);
    } else enter();
  }

  battleAction(action) {
    if (this.mode !== 'BATTLE' || !this.battle || !this.battle.playerTurn) return;
    this.battle.playerTurn = false;
    if (action === 'attack') {
      const damage = Math.max(1, this.getAttackDamage() - (this.battle.monster.config.defense || 0));
      this.battle.monster.health = Math.max(0, this.battle.monster.health - damage);
      this.battle.log.push(`你造成 ${damage} 点伤害。`);
      if (this.battle.monster.health <= 0) return this.winBattle();
    } else if (action === 'defend') {
      this.battle.defending = true;
      this.battle.log.push('你收紧架势，准备承受攻击。');
    } else if (action === 'eat') {
      if (!this.config.battle.allowFoodInBattle || this.player.loot.monsterMeat <= 0) {
        this.battle.log.push('没有可以在战斗中食用的怪物肉。'); return this.emitBattle();
      }
      this.eatMonsterMeat();
      this.battle.log.push('你吞下异变肉块，力量与低语一同涌来。');
    } else if (action === 'escape') {
      if (Math.random() <= this.config.battle.baseEscapeChance) return this.escapeBattle();
      this.battle.log.push('逃跑失败。');
      if (!this.config.battle.failedEscapeEnemyAttack) return this.finishBattleRound();
    }
    if (!this.battle.enemyFirst) this.enemyAttack();
    this.finishBattleRound();
  }

  enemyAttack() {
    const gear = this.getEquipmentStats();
    const reduction = this.battle.defending ? this.config.battle.defenseDamageReduction : 0;
    const raw = Math.max(1, this.battle.monster.config.attack - gear.defense);
    const damage = Math.max(1, Math.round(raw * (1 - reduction)));
    this.player.health = Math.max(0, this.player.health - damage);
    this.battle.log.push(`${this.battle.monster.config.name}造成 ${damage} 点伤害。`);
    this.battle.defending = false;
  }

  finishBattleRound() {
    this.consumeHunger('battle');
    if (this.player.health <= 0) return this.loseBattle();
    this.battle.round += 1;
    if (this.battle.enemyFirst) {
      this.battle.log.push('敌人正在行动…');
      this.enemyAttack();
      if (this.player.health <= 0) return this.loseBattle();
    }
    this.battle.playerTurn = true;
    this.emitBattle();
  }

  winBattle() {
    const monster = this.battle.monster;
    this.monsters = this.monsters.filter((item) => item !== monster);
    this.save.enemiesKilled = (this.save.enemiesKilled || 0) + 1;
    this.corpses.push({ id: `corpse-${monster.id}`, x: monster.x, y: monster.y, config: monster.config, harvested: false });
    if (this.config.battle.victoryPlayerMovesIntoEnemyTile) { this.player.x = monster.x; this.player.y = monster.y; }
    const finish = () => {
      this.mode = 'OUTDOOR_EXPLORATION'; this.battle = null;
      this.setMessage(`${monster.config.name}倒下了。尸体就在脚下，可以切割。`);
      this.updateVision(); this.render();
    };
    if (this.callbacks.onBattleResult) this.callbacks.onBattleResult({ type: 'victory', title: `击败 ${monster.config.name}`, detail: '尸体已留下，可以进行切割。' }, finish);
    else finish();
  }

  loseBattle() {
    const finish = () => { this.battle = null; this.failExpedition(); };
    if (this.callbacks.onBattleResult) this.callbacks.onBattleResult({ type: 'defeat', title: '外出失败', detail: '你倒在了雾中。' }, finish);
    else finish();
  }

  escapeBattle() {
    const monster = this.battle.monster;
    monster.cooldownTurns = monster.config.disengageCooldownTurns;
    monster.state = 'Cooldown';
    const finish = () => {
      this.mode = 'OUTDOOR_EXPLORATION'; this.battle = null;
      this.setMessage(`你逃回接敌前的位置，${monster.config.name}暂时没有追来。`);
      this.updateVision(); this.render();
    };
    if (this.callbacks.onBattleResult) this.callbacks.onBattleResult({ type: 'escaped', title: '逃跑成功', detail: '敌人暂时失去了战斗意志。' }, finish);
    else finish();
  }

  emitBattle() {
    if (this.player.health <= 0) return this.loseBattle();
    this.callbacks.onBattle?.(this.getBattleView(), (action) => this.battleAction(action));
  }

  eatMonsterMeat() {
    const food = this.config.foods.find((item) => item.id === 'monster_meat');
    this.player.loot.monsterMeat -= 1;
    this.player.hunger = clamp(this.player.hunger + food.hungerRestore, 0, this.config.global.maxHunger);
    this.changeMadness(food.madnessGain);
  }

  changeMadness(value) {
    const before = this.player.madness;
    this.player.madness = clamp(this.player.madness + value, 0, this.config.global.maxMadness);
    this.save.highestMadness = Math.max(this.save.highestMadness || 0, this.player.madness);
    this.callbacks.onMadnessChange?.(before, this.player.madness);
  }

  getEquipmentStats() {
    return this.config.equipment.filter((item) => item.defaultEquipped).reduce((stats, item) => ({
      attack: stats.attack + (item.attack || 0), defense: stats.defense + (item.defense || 0),
      harvestYield: stats.harvestYield * (item.harvestYieldMultiplier || 1)
    }), { attack: 0, defense: 0, harvestYield: 1 });
  }

  getMadnessStage() {
    return this.config.madnessStages.find((stage) => this.player.madness >= stage.min && this.player.madness <= stage.max) || this.config.madnessStages.at(-1);
  }

  getAttackDamage() {
    const gear = this.getEquipmentStats();
    return Math.round((this.config.player.baseAttack + gear.attack) * this.getMadnessStage().attackMultiplier);
  }

  getBattleView() {
    return {
      round: this.battle.round, initiator: this.battle.initiator,
      phase: this.battle.playerTurn ? 'player' : 'enemy',
      player: { health: Math.round(this.player.health), maxHealth: this.config.global.maxHealth, hunger: Math.round(this.player.hunger), madness: Math.round(this.player.madness), attack: this.getAttackDamage(), speed: this.config.player.speed, meat: this.player.loot.monsterMeat },
      enemy: { name: this.battle.monster.config.name, health: this.battle.monster.health, maxHealth: this.battle.monster.config.health, attack: this.battle.monster.config.attack, speed: this.battle.monster.config.speed, color: this.battle.monster.config.color },
      actions: this.config.battle.playerActions,
      log: this.battle.log.slice(-5)
    };
  }

  getHud() {
    return { health: Math.round(this.player.health), hunger: Math.round(this.player.hunger), madness: Math.round(this.player.madness), madnessState: this.getMadnessStage().state, attack: this.getAttackDamage(), meat: this.player.loot.monsterMeat, turn: this.turn, message: this.message, position: `${this.player.x},${this.player.y}`, interaction: this.getInteraction() };
  }

  setMessage(message) { this.message = message; }

  succeedExpedition() {
    this.save.monsterMeat += this.player.loot.monsterMeat;
    this.save.successfulExtractions = (this.save.successfulExtractions || 0) + 1;
    this.save.totalMonsterMeatReturned = (this.save.totalMonsterMeatReturned || 0) + this.player.loot.monsterMeat;
    this.save.madness = Math.round(this.player.madness);
    this.advanceFarm(); this.save.expeditions += 1;
    this.save.lastResult = { success: true, meat: this.player.loot.monsterMeat };
    this.stop(); this.callbacks.onComplete?.(this.save, true);
  }

  failExpedition() {
    if (!this.running) return;
    if (this.config.global.keepMadnessOnDeath) this.save.madness = Math.round(this.player.madness);
    this.advanceFarm(); this.save.expeditions += 1;
    this.save.expeditionFailures = (this.save.expeditionFailures || 0) + 1;
    this.save.lastResult = { success: false, meat: this.config.global.loseLootOnDeath ? 0 : this.player.loot.monsterMeat };
    if (!this.config.global.loseLootOnDeath) this.save.monsterMeat += this.player.loot.monsterMeat;
    this.stop(); this.callbacks.onComplete?.(this.save, false);
  }

  advanceFarm() {
    if (this.save.farm.planted) this.save.farm.cyclesLeft = Math.max(0, this.save.farm.cyclesLeft - 1);
  }

  render() {
    if (!this.running || this.mode !== 'OUTDOOR_EXPLORATION') return;
    const ctx = this.ctx, size = this.tileSize, fog = this.mapConfig.fogOfWar;
    ctx.fillStyle = '#080d0c'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.tiles.forEach((tile) => {
      const px = tile.x * size, py = tile.y * size;
      if (tile.visibility === 'unexplored') {
        ctx.fillStyle = '#050807'; ctx.fillRect(px, py, size, size); return;
      }
      ctx.fillStyle = tile.walkable ? '#2a4037' : '#182521'; ctx.fillRect(px, py, size, size);
      ctx.strokeStyle = '#49605744'; ctx.strokeRect(px + .5, py + .5, size - 1, size - 1);
      const content = tile.visibility === 'visible' ? this.contentAt(tile.x, tile.y) : tile.rememberedContent;
      const memory = tile.visibility === 'explored';
      if (content?.extract) this.drawExtract(px, py, size, memory);
      if (content?.corpse && (tile.visibility === 'visible' || fog.showCorpseMemory)) this.drawCorpse(px, py, size, memory);
      if (content?.enemy && (tile.visibility === 'visible' || fog.showEnemyMemory)) this.drawEnemy(px, py, size, content.enemy, memory);
      if (memory) { ctx.fillStyle = `rgba(4,9,8,${1 - fog.exploredBrightness})`; ctx.fillRect(px, py, size, size); }
    });
    this.drawPlayer();
    this.callbacks.onHud?.(this.getHud());
  }

  drawEnemy(px, py, size, enemy, memory) {
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = memory ? .42 : 1;
    ctx.fillStyle = enemy.color; ctx.beginPath();
    ctx.arc(px + size / 2, py + size / 2, size * .25, 0, Math.PI * 2); ctx.fill();
    if (!memory && ['Alert', 'Chase', 'AttackIntent'].includes(enemy.state)) {
      ctx.fillStyle = enemy.state === 'AttackIntent' ? '#ff5f5f' : '#f5d078';
      ctx.font = `700 ${size * .42}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(enemy.state === 'Alert' ? '!' : enemy.state === 'AttackIntent' ? '⚠' : '↓', px + size / 2, py + size * .24);
    }
    if (memory) { ctx.fillStyle = '#e5d5a1'; ctx.font = `${size * .35}px serif`; ctx.textAlign = 'center'; ctx.fillText('?', px + size * .75, py + size * .35); }
    ctx.restore();
  }

  drawCorpse(px, py, size, memory) {
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = memory ? .38 : 1; ctx.fillStyle = '#8a7c68';
    ctx.beginPath(); ctx.ellipse(px + size / 2, py + size / 2, size * .28, size * .12, -.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  drawExtract(px, py, size, memory) {
    const ctx = this.ctx; ctx.save(); ctx.globalAlpha = memory ? .55 : 1; ctx.strokeStyle = '#b7f4d3'; ctx.lineWidth = 2;
    ctx.strokeRect(px + 5, py + 5, size - 10, size - 10); ctx.restore();
  }

  drawPlayer() {
    const ctx = this.ctx, size = this.tileSize, px = this.player.x * size, py = this.player.y * size;
    ctx.fillStyle = '#d9f1e4'; ctx.beginPath(); ctx.arc(px + size / 2, py + size / 2, size * .3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#263a33'; ctx.beginPath(); ctx.arc(px + size * .59, py + size * .43, size * .06, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d9c17d'; ctx.lineWidth = 2; ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
  }
}
