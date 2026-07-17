const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const moveToward = (entity, target, speed, dt) => {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const length = Math.hypot(dx, dy) || 1;
  const step = Math.min(length, speed * dt);
  entity.x += dx / length * step;
  entity.y += dy / length * step;
  return length;
};

export class GameRuntime {
  constructor(canvas, config, save, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.config = config;
    this.save = save;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.elapsed = 0;
    this.lastTime = performance.now();
    this.running = false;
    this.attackFlash = 0;
    this.action = null;
    this.message = '';
    this.messageTime = 0;
    this.frameId = null;
    this.boundKeyDown = (event) => this.onKeyDown(event);
    this.boundKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
  }

  start() {
    const map = this.config.maps[0];
    this.canvas.width = map.width;
    this.canvas.height = map.height;
    this.player = {
      x: map.playerSpawn.x, y: map.playerSpawn.y, radius: this.config.player.radius,
      health: this.config.player.health, hunger: this.config.player.hunger,
      madness: this.save.madness, attackCooldown: 0, invulnerable: 0,
      loot: { monsterMeat: 0 }, dead: false
    };
    this.monsters = this.spawnMonsters(map);
    this.running = true;
    addEventListener('keydown', this.boundKeyDown);
    addEventListener('keyup', this.boundKeyUp);
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    removeEventListener('keydown', this.boundKeyDown);
    removeEventListener('keyup', this.boundKeyUp);
  }

  spawnMonsters(map) {
    const monsters = [];
    map.monsterSpawns.forEach((spawn) => {
      const config = this.config.monsters.find((item) => item.id === spawn.monsterId);
      if (!config) return;
      for (let index = 0; index < spawn.count; index += 1) {
        const angle = index * 2.399;
        const spread = (spawn.spread || 0) * (index / Math.max(1, spawn.count - 1));
        const x = spawn.x + Math.cos(angle) * spread;
        const y = spawn.y + Math.sin(angle) * spread;
        monsters.push({
          id: `${config.id}-${monsters.length}`, config, x, y, homeX: x, homeY: y,
          radius: config.radius, health: config.health, state: config.canWander ? 'Wander' : 'Idle',
          stateTime: 0, attackCooldown: 0, lostTime: 0, target: null,
          wanderTarget: null, harvested: false, harvestProgress: 0, hitFlash: 0
        });
      }
    });
    return monsters;
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e'].includes(key)) event.preventDefault();
    this.keys.add(key);
    if (key === ' ' && !event.repeat) this.attack();
  }

  setVirtualDirection(dx, dy) { this.virtualDirection = { dx, dy }; }
  clearVirtualDirection() { this.virtualDirection = null; }
  setInteract(active) { this.virtualInteract = active; }

  getEquipmentStats() {
    return this.config.equipment.filter((item) => item.defaultEquipped).reduce((stats, item) => ({
      attack: stats.attack + (item.attack || 0),
      defense: stats.defense + (item.defense || 0),
      attackSpeed: stats.attackSpeed * (item.attackSpeedMultiplier || 1),
      attackRange: stats.attackRange + (item.attackRangeBonus || 0),
      harvestSpeed: stats.harvestSpeed * (item.harvestSpeedMultiplier || 1),
      harvestYield: stats.harvestYield * (item.harvestYieldMultiplier || 1)
    }), { attack: 0, defense: 0, attackSpeed: 1, attackRange: 0, harvestSpeed: 1, harvestYield: 1 });
  }

  getMadnessStage() {
    return this.config.madnessStages.find((stage) => this.player.madness >= stage.min && this.player.madness <= stage.max)
      || this.config.madnessStages.at(-1);
  }

  getAttackDamage() {
    const gear = this.getEquipmentStats();
    return Math.round((this.config.player.baseAttack + gear.attack) * this.getMadnessStage().attackMultiplier);
  }

  attack() {
    if (!this.running || this.player.dead || this.player.attackCooldown > 0 || this.action) return;
    const gear = this.getEquipmentStats();
    this.player.attackCooldown = this.config.player.attackCooldown / gear.attackSpeed;
    this.attackFlash = 0.18;
    const range = this.config.player.attackRange + gear.attackRange;
    const target = this.monsters
      .filter((monster) => monster.state !== 'Dead' && monster.state !== 'Harvested' && distance(this.player, monster) <= range + monster.radius)
      .sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
    if (!target) { this.notify('挥空了'); return; }
    target.health -= this.getAttackDamage();
    target.hitFlash = 0.16;
    if (target.config.hostile && target.state !== 'Dead') target.state = 'Chase';
    if (target.health <= 0) {
      target.health = 0;
      target.state = 'Dead';
      target.stateTime = 0;
      this.notify(`${target.config.name}倒下了，靠近后长按 E 切割`);
    }
  }

  eat(itemId) {
    const food = this.config.foods.find((item) => item.id === itemId);
    if (!food || !food.allowOutdoor) return;
    const key = itemId === 'monster_meat' ? 'monsterMeat' : 'safeFood';
    if (key === 'monsterMeat') {
      if (this.player.loot.monsterMeat <= 0) return this.notify('背包里没有异变肉块');
      this.player.loot.monsterMeat -= 1;
    } else {
      if (this.save.safeFood <= 0) return this.notify('庇护所没有可携带的储备粮');
      this.save.safeFood -= 1;
    }
    this.player.hunger = clamp(this.player.hunger + food.hungerRestore, 0, this.config.global.maxHunger);
    this.player.madness = clamp(this.player.madness + food.madnessGain, 0, this.config.global.maxMadness);
    this.notify(`${food.name}：饥饿 +${food.hungerRestore}${food.madnessGain ? `，疯狂 +${food.madnessGain}` : ''}`);
  }

  notify(message) { this.message = message; this.messageTime = 2.6; }

  frame(time) {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.035);
    this.lastTime = time;
    this.update(dt);
    this.draw();
    this.callbacks.onHud?.(this.getHud());
    this.frameId = requestAnimationFrame((next) => this.frame(next));
  }

  update(dt) {
    this.elapsed += dt;
    this.messageTime = Math.max(0, this.messageTime - dt);
    this.attackFlash = Math.max(0, this.attackFlash - dt);
    this.player.attackCooldown = Math.max(0, this.player.attackCooldown - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    if (this.player.dead) return;

    const keyboardX = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    const keyboardY = (this.keys.has('arrowdown') || this.keys.has('s') ? 1 : 0) - (this.keys.has('arrowup') || this.keys.has('w') ? 1 : 0);
    const dx = this.virtualDirection?.dx ?? keyboardX;
    const dy = this.virtualDirection?.dy ?? keyboardY;
    const length = Math.hypot(dx, dy) || 1;
    if (!this.action) {
      this.player.x += dx / length * this.config.player.moveSpeed * dt;
      this.player.y += dy / length * this.config.player.moveSpeed * dt;
      this.player.x = clamp(this.player.x, this.player.radius, this.canvas.width - this.player.radius);
      this.player.y = clamp(this.player.y, this.player.radius, this.canvas.height - this.player.radius);
    }

    this.player.hunger = clamp(this.player.hunger - this.config.global.hungerDrainPerSecond * dt, 0, this.config.global.maxHunger);
    if (this.player.hunger <= 0) this.damagePlayer(this.config.global.starvationDamagePerSecond * dt, true);
    this.updateAction(dt);
    this.monsters.forEach((monster) => this.updateMonster(monster, dt));
    if (this.player.health <= 0) this.failExpedition();
  }

  updateAction(dt) {
    const wantsAction = this.keys.has('e') || this.virtualInteract;
    const corpse = this.monsters
      .filter((monster) => monster.state === 'Dead' && !monster.harvested && distance(this.player, monster) < 52)
      .sort((a, b) => distance(this.player, a) - distance(this.player, b))[0];
    const map = this.config.maps[0];
    const inExtract = distance(this.player, map.extractPoint) <= map.extractPoint.radius;

    if (!wantsAction) { this.action = null; return; }
    if (corpse) {
      if (!this.action || this.action.type !== 'harvest' || this.action.target !== corpse) this.action = { type: 'harvest', target: corpse, progress: 0 };
      const gear = this.getEquipmentStats();
      this.action.progress += dt * this.config.player.harvestSpeedMultiplier * gear.harvestSpeed;
      if (this.action.progress >= corpse.config.harvestDuration) this.finishHarvest(corpse, gear);
      return;
    }
    if (inExtract) {
      if (!this.action || this.action.type !== 'extract') this.action = { type: 'extract', progress: 0 };
      this.action.progress += dt;
      if (this.action.progress >= this.config.global.extractDuration) this.succeedExpedition();
      return;
    }
    this.action = null;
  }

  finishHarvest(corpse, gear) {
    const free = this.config.player.inventoryCapacity - this.player.loot.monsterMeat;
    const amount = Math.min(free, Math.max(1, Math.floor(corpse.config.meatYield * this.config.player.harvestYieldMultiplier * gear.harvestYield)));
    corpse.harvested = true;
    corpse.state = 'Harvested';
    this.player.loot.monsterMeat += amount;
    this.action = null;
    this.notify(`切割完成，获得 ${amount} 份异变肉块`);
  }

  updateMonster(monster, dt) {
    monster.stateTime += dt;
    monster.attackCooldown = Math.max(0, monster.attackCooldown - dt);
    monster.hitFlash = Math.max(0, monster.hitFlash - dt);
    if (monster.state === 'Dead' || monster.state === 'Harvested') return;
    const cfg = monster.config;
    const playerDistance = distance(monster, this.player);
    const homeDistance = Math.hypot(monster.x - monster.homeX, monster.y - monster.homeY);

    if (cfg.hostile && cfg.canChase && playerDistance <= cfg.detectRadius && homeDistance <= cfg.maxHomeDistance) {
      monster.state = playerDistance <= cfg.attackRange + this.player.radius ? 'Attack' : 'Chase';
      monster.lostTime = 0;
    }

    if (monster.state === 'Chase' || monster.state === 'Attack') {
      const tooFar = playerDistance > cfg.loseTargetRadius || homeDistance > cfg.maxChaseDistance;
      monster.lostTime = tooFar ? monster.lostTime + dt : 0;
      if (homeDistance > cfg.maxHomeDistance || monster.lostTime >= cfg.loseTargetDelay) {
        monster.state = cfg.returnHome ? 'Return' : 'Idle';
        monster.stateTime = 0;
      }
    }

    switch (monster.state) {
      case 'Idle':
        if (cfg.canWander && monster.stateTime >= cfg.wanderInterval) this.pickWanderTarget(monster);
        break;
      case 'Wander':
        if (!monster.wanderTarget) this.pickWanderTarget(monster);
        if (moveToward(monster, monster.wanderTarget, cfg.moveSpeed * cfg.wanderSpeedMultiplier, dt) < 4) {
          monster.state = 'Idle'; monster.stateTime = 0; monster.wanderTarget = null;
        }
        break;
      case 'Chase':
        if (cfg.canMove) moveToward(monster, this.player, cfg.moveSpeed * cfg.chaseSpeedMultiplier, dt);
        break;
      case 'Attack':
        if (playerDistance > cfg.attackRange + this.player.radius + 8) monster.state = 'Chase';
        else if (monster.attackCooldown <= 0) {
          this.damagePlayer(cfg.attack);
          monster.attackCooldown = cfg.attackCooldown;
        }
        break;
      case 'Return':
        if (moveToward(monster, { x: monster.homeX, y: monster.homeY }, cfg.moveSpeed * cfg.returnSpeedMultiplier, dt) < 5) {
          monster.state = cfg.canWander ? 'Wander' : 'Idle'; monster.stateTime = 0;
        }
        break;
    }
  }

  pickWanderTarget(monster) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * monster.config.wanderRadius;
    monster.wanderTarget = { x: monster.homeX + Math.cos(angle) * radius, y: monster.homeY + Math.sin(angle) * radius };
    monster.state = 'Wander'; monster.stateTime = 0;
  }

  damagePlayer(amount, ignoreDefense = false) {
    if (!ignoreDefense && this.player.invulnerable > 0) return;
    const defense = ignoreDefense ? 0 : this.getEquipmentStats().defense;
    this.player.health = clamp(this.player.health - Math.max(ignoreDefense ? amount : 1, amount - defense), 0, this.config.global.maxHealth);
    if (!ignoreDefense) this.player.invulnerable = this.config.player.invulnerableDuration;
  }

  succeedExpedition() {
    if (!this.running) return;
    this.save.monsterMeat += this.player.loot.monsterMeat;
    this.save.madness = Math.round(this.player.madness);
    this.advanceFarm();
    this.save.expeditions += 1;
    this.save.lastResult = { success: true, meat: this.player.loot.monsterMeat };
    this.stop();
    this.callbacks.onComplete?.(this.save, true);
  }

  failExpedition() {
    if (this.player.dead) return;
    this.player.dead = true;
    if (this.config.global.keepMadnessOnDeath) this.save.madness = Math.round(this.player.madness);
    this.advanceFarm();
    this.save.expeditions += 1;
    this.save.lastResult = { success: false, meat: this.config.global.loseLootOnDeath ? 0 : this.player.loot.monsterMeat };
    if (!this.config.global.loseLootOnDeath) this.save.monsterMeat += this.player.loot.monsterMeat;
    setTimeout(() => { this.stop(); this.callbacks.onComplete?.(this.save, false); }, 900);
  }

  advanceFarm() {
    if (!this.save.farm.planted) return;
    this.save.farm.cyclesLeft = Math.max(0, this.save.farm.cyclesLeft - 1);
  }

  getHud() {
    const actionDuration = this.action?.type === 'extract' ? this.config.global.extractDuration : this.action?.target?.config.harvestDuration;
    return {
      health: Math.round(this.player.health), hunger: Math.round(this.player.hunger), madness: Math.round(this.player.madness),
      madnessState: this.getMadnessStage().state, attack: this.getAttackDamage(), meat: this.player.loot.monsterMeat,
      action: this.action ? { label: this.action.type === 'extract' ? '正在撤离' : '正在切割', progress: this.action.progress / actionDuration } : null,
      message: this.messageTime > 0 ? this.message : ''
    };
  }

  draw() {
    const ctx = this.ctx;
    const map = this.config.maps[0];
    const stage = this.getMadnessStage();
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#23373a'); gradient.addColorStop(1, '#101c20');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#263f3a';
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 137 + 41) % this.canvas.width;
      const y = (i * 83 + 19) % this.canvas.height;
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2); ctx.fill();
    }
    map.obstacles.forEach((item) => {
      ctx.fillStyle = '#172829'; ctx.strokeStyle = '#44605a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(item.x, item.y, item.width, item.height, 12); ctx.fill(); ctx.stroke();
    });

    const extract = map.extractPoint;
    ctx.strokeStyle = '#9edcbd'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.arc(extract.x, extract.y, extract.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#b7f4d3'; ctx.font = '13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('撤离点 · 长按 E', extract.x, extract.y + 4);

    this.monsters.forEach((monster) => this.drawMonster(monster));
    this.drawPlayer();

    if (stage.effectIntensity > 0) {
      const alpha = stage.effectIntensity * (0.06 + Math.sin(this.elapsed * 2.7) * 0.025);
      const vignette = ctx.createRadialGradient(this.canvas.width / 2, this.canvas.height / 2, 150, this.canvas.width / 2, this.canvas.height / 2, 520);
      vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, `rgba(125,20,76,${alpha})`);
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.player.dead) {
      ctx.fillStyle = '#0b090ad9'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#eab8ad'; ctx.font = '700 42px system-ui'; ctx.textAlign = 'center'; ctx.fillText('你没有回来', this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  drawMonster(monster) {
    const ctx = this.ctx;
    if (monster.state === 'Harvested') {
      ctx.fillStyle = '#26302c'; ctx.beginPath(); ctx.ellipse(monster.x, monster.y, monster.radius + 5, 7, 0, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (monster.state === 'Dead') {
      ctx.save(); ctx.translate(monster.x, monster.y); ctx.rotate(0.4);
      ctx.fillStyle = '#4b4d43'; ctx.beginPath(); ctx.ellipse(0, 0, monster.radius + 5, monster.radius * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (distance(this.player, monster) < 60) {
        ctx.fillStyle = '#f0d99e'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('长按 E 切割', monster.x, monster.y - 27);
      }
      return;
    }
    ctx.save(); ctx.translate(monster.x, monster.y);
    ctx.shadowBlur = monster.state === 'Chase' || monster.state === 'Attack' ? 16 : 5;
    ctx.shadowColor = monster.config.color; ctx.fillStyle = monster.hitFlash > 0 ? '#fff0d5' : monster.config.color;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = i / 8 * Math.PI * 2;
      const radius = monster.radius * (i % 2 ? 0.74 : 1.08);
      const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#1b2020'; ctx.beginPath(); ctx.arc(5, -2, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#111a1a'; ctx.fillRect(monster.x - 20, monster.y - monster.radius - 13, 40, 4);
    ctx.fillStyle = '#c86868'; ctx.fillRect(monster.x - 20, monster.y - monster.radius - 13, 40 * monster.health / monster.config.health, 4);
    ctx.fillStyle = '#b8c9c0'; ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(monster.state, monster.x, monster.y + monster.radius + 16);
  }

  drawPlayer() {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(this.player.x, this.player.y);
    ctx.shadowBlur = 18; ctx.shadowColor = '#b8e9d2'; ctx.fillStyle = this.player.invulnerable > 0 ? '#ffffff' : '#caead7';
    ctx.beginPath(); ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#293b35'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(3, -3); ctx.lineTo(13, -10); ctx.stroke();
    if (this.attackFlash > 0) {
      ctx.strokeStyle = '#f4d99d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, this.config.player.attackRange, -0.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  }
}
