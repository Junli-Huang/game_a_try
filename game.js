import { ConfigService, SAVE_STORAGE_KEY, createInitialSave, loadSave, persistSave } from './src/config/config-service.js';
import { GridExplorationRuntime } from './src/game-runtime.js';
import { GoalService } from './src/systems/goal-service.js';
import { MadnessPresentationService } from './src/systems/madness-presentation.js';
import { AudioService } from './src/systems/audio-service.js';

const app = document.querySelector('#app');
const fileInput = document.querySelector('#config-file');
const configService = new ConfigService();
let config = configService.loadActiveConfig();
let save = loadSave(config);
let runtime = null;
let configDraft = structuredClone(config);
let activeCategory = 'global';
let goalService = new GoalService(config);
let madnessPresentation = new MadnessPresentationService(config);
let audioService = new AudioService(config);
let battleKeyboardHandler = null;
addEventListener('pointerdown', () => audioService.unlock(), { once: true });

const labels = {
  global: '全局规则', player: '玩家', monsters: '怪物', foods: '食物', madnessStages: '疯狂阶段',
  equipment: '装备', maps: '地图', farming: '种植', shelter: '庇护所', ui: '界面反馈', speed: '速度',
  maxHealth: '最大生命', maxHunger: '最大饥饿', maxMadness: '最大疯狂', hungerDrainPerSecond: '每秒饥饿消耗',
  starvationDamagePerSecond: '饥饿伤害/秒', extractDuration: '撤离读条（秒）', loseLootOnDeath: '死亡丢失本局资源',
  keepEquipmentOnDeath: '死亡保留装备', keepMadnessOnDeath: '死亡保留疯狂', enableShelterFarming: '启用庇护所种植',
  enableOutdoorFarming: '启用户外种植', health: '生命', hunger: '饥饿', madness: '疯狂', radius: '碰撞半径',
  moveSpeed: '移动速度', baseAttack: '基础攻击', attackRange: '攻击距离', attackCooldown: '攻击间隔',
  invulnerableDuration: '受击无敌时间', inventoryCapacity: '背包容量', harvestSpeedMultiplier: '切割速度倍率',
  harvestYieldMultiplier: '切割产量倍率', id: '配置 ID', name: '显示名称', color: '颜色', attack: '攻击力',
  defense: '防御力', canMove: '允许移动', canWander: '允许游荡', wanderRadius: '游荡半径', wanderInterval: '游荡间隔',
  wanderSpeedMultiplier: '游荡速度倍率', hostile: '主动敌对', detectRadius: '感知距离', loseTargetRadius: '丢失目标距离',
  loseTargetDelay: '丢失等待时间', canChase: '允许追踪', maxChaseDistance: '最大追踪距离',
  maxHomeDistance: '最大离家距离', chaseSpeedMultiplier: '追踪速度倍率', returnHome: '返回出生点',
  returnSpeedMultiplier: '返回速度倍率', canHarvest: '可切割', harvestDuration: '切割时间', meatYield: '基础肉量',
  carriedLoot: '携带物掉落表', type: '类型', hungerRestore: '恢复饥饿', madnessGain: '增加疯狂',
  allowOutdoor: '户外可食用', allowShelter: '庇护所可食用', maxStack: '最大堆叠', min: '最小值', max: '最大值',
  attackMultiplier: '攻击倍率', state: '状态名', effectIntensity: '视觉强度', slot: '装备槽', attackSpeedMultiplier: '攻速倍率',
  attackRangeBonus: '攻击距离加成', defaultEquipped: '默认装备', width: '宽度', height: '高度', playerSpawn: '玩家出生点',
  extractPoint: '撤离点', monsterSpawns: '怪物出生点', monsterId: '怪物 ID', count: '数量', spread: '散布范围',
  obstacles: '障碍物', x: 'X', y: 'Y', growthCycles: '生长周期（外出次数）', seedCost: '播种消耗',
  yieldItem: '产出物 ID', yieldCount: '产出数量', allowShelter: '允许庇护所种植', initialSafeFood: '初始安全食物',
  initialMonsterMeat: '初始怪物肉', battle: '回合制战斗', fogOfWar: '战争迷雾', visionRadius: '视野半径', shape: '视野形状',
  terrainBlocksVision: '地形遮挡视野', exploredBrightness: '已探索亮度', showEnemyMemory: '显示敌人记忆', showCorpseMemory: '显示尸体记忆',
  allowDiagonalMove: '允许斜向移动', requiredTurns: '所需行动回合', actionChance: '每回合行动概率', maxMovesPerTurn: '每回合最大移动格',
  detectRange: '地图感知距离', disengageCooldownTurns: '脱战冷却回合', harvestTurns: '切割回合', playerActions: '玩家行动',
  initiatorActsFirst: '主动接敌方先手', baseEscapeChance: '基础逃跑概率', failedEscapeEnemyAttack: '逃跑失败立即受击',
  defenseDamageReduction: '防御减伤比例', allowFoodInBattle: '战斗中允许食物', victoryPlayerMovesIntoEnemyTile: '胜利后进入敌人格',
  hungerCostPerMove: '移动饥饿消耗', starvationDamagePerAction: '饥饿伤害/移动', alertDuration: '警觉持续回合',
  attackIntentRange: '攻击意图距离', useSpeedOrder: '按速度决定先手', battleTransition: '启用战斗转场', battleResultDelay: '结果展示秒数',
  showEnemyAlert: '显示敌人发现提示', showAttackIntent: '显示攻击意图', highlightInteract: '高亮可交互操作',
  demoGoal: 'Demo 目标', requiredExtractions: '目标撤离次数', requiredMonsterMeat: '目标带回肉量', maxExpeditionFailures: '最大失败次数',
  madnessPresentation: '疯狂表现', showStageMessages: '阶段变化提示', showWhispers: '显示低语', enableEdgeVignette: '边缘暗影', enableUiPulse: 'UI 脉动', enableUiJitter: 'UI 轻微偏移', reducedMotion: '减少动态效果',
  mapEvents: '地图事件规则', events: '地图事件内容', triggerChancePerNewTile: '新格触发概率', maxEventsPerExpedition: '单次事件上限', minStepsBetweenEvents: '事件最小间隔',
  audio: '音频', masterVolume: '主音量', bgmVolume: 'BGM 音量', sfxVolume: '音效音量', muted: '静音', enabled: '启用'
};

function button(label, action, className = '') {
  return `<button class="${className}" data-action="${action}">${label}</button>`;
}

function bindActions(root, actions) {
  root.querySelectorAll('[data-action]').forEach((element) => {
    element.addEventListener('click', () => actions[element.dataset.action]?.(element));
  });
}

function renderMain() {
  clearBattleKeyboard();
  runtime?.stop(); runtime = null;
  app.innerHTML = `
    <section class="menu-screen">
      <div class="menu-fog"></div>
      <div class="menu-copy">
        <p class="eyebrow">A LIGHT EXTRACTION SURVIVAL</p>
        <h1>雾下余粮</h1>
        <p class="tagline">活下去，需要吃掉一些不该入口的东西。</p>
        <div class="menu-actions">
          ${button('开始游戏', 'start', 'primary')}
          ${save.expeditions || save.introSeen ? button('继续游戏', 'continue') : ''}
          ${button('配置', 'config')}
          ${button('关于', 'about', 'ghost')}
          ${save.expeditions || save.introSeen ? button('重置存档', 'reset-save', 'ghost danger') : ''}
        </div>
        <p class="version">V1 · 数据驱动搜打撤 Demo</p>
      </div>
      <aside class="menu-note">
        <span>生存守则 01</span>
        <strong>安全食物让你保持清醒。</strong>
        <strong>怪物肉让你变得更强。</strong>
      </aside>
    </section>`;
  bindActions(app, { start: renderShelter, continue: renderShelter, config: renderConfig, about: renderAbout,
    'reset-save': () => { if (confirm('确定清空当前存档并重新开始？')) { localStorage.removeItem(SAVE_STORAGE_KEY); save = createInitialSave(config); renderMain(); } }
  });
}

function renderAbout() {
  showModal('关于《雾下余粮》', '一个关于生存、饥饿与污染的轻量搜打撤原型。\n\n安全食物让你保持清醒；怪物肉让你活下去，也让你变得更强。', [{ label: '返回', action: closeModal }]);
}

function madnessStage(value) {
  return config.madnessStages.find((stage) => value >= stage.min && value <= stage.max) || config.madnessStages.at(-1);
}

function renderShelter() {
  config = configService.loadActiveConfig();
  goalService = new GoalService(config); madnessPresentation = new MadnessPresentationService(config); audioService = new AudioService(config);
  const crop = config.farming[0];
  const stage = madnessStage(save.madness);
  const farmText = !save.farm.planted ? '空置' : save.farm.cyclesLeft > 0 ? `生长中 · 还需 ${save.farm.cyclesLeft} 次外出` : '可以收获';
  const result = save.lastResult ? `<div class="result ${save.lastResult.success ? 'success' : 'failure'}">${save.lastResult.success ? `上次成功撤离，带回 ${save.lastResult.meat} 份肉` : '上次外出失败，临时搜集物已丢失'}</div>` : '';
  const progress = goalService.progress(save), goal = config.demoGoal;
  app.innerHTML = `
    <section class="shelter-screen">
      <header class="topbar"><div><span class="eyebrow">SHELTER</span><h2>地下庇护所</h2></div>${button('返回主菜单', 'menu', 'ghost')}</header>
      ${result}
      <div class="shelter-grid">
        <article class="panel status-panel">
          <span class="panel-kicker">幸存者</span><h3>出发前状态</h3>
          <div class="stat-row"><span>疯狂</span><strong>${save.madness} / ${config.global.maxMadness}</strong></div>
          <div class="meter madness"><i style="width:${save.madness}%"></i></div>
          <p class="state-copy">${stage.state} · 攻击倍率 ×${stage.attackMultiplier}</p>
          <div class="equipment-list">${config.equipment.filter((item) => item.defaultEquipped).map((item) => `<div><span>${item.slot === 'weapon' ? '武器' : '防护'}</span><strong>${item.name}</strong></div>`).join('')}</div>
        </article>
        <article class="panel pantry-panel">
          <span class="panel-kicker">仓储</span><h3>食物库存</h3>
          <div class="resource"><span class="resource-icon safe"></span><div><strong>储备粮 × ${save.safeFood}</strong><small>安全，不增加疯狂</small></div>${button('食用', 'eat-safe', 'small')}</div>
          <div class="resource"><span class="resource-icon meat"></span><div><strong>异变肉块 × ${save.monsterMeat}</strong><small>恢复饥饿，但污染理智</small></div>${button('食用', 'eat-meat', 'small danger')}</div>
        </article>
        <article class="panel farm-panel">
          <span class="panel-kicker">种植格</span><h3>${crop.name}</h3>
          <div class="farm-visual ${save.farm.planted ? 'planted' : ''}"><i></i><i></i><i></i></div>
          <p>${farmText}</p>
          ${!save.farm.planted ? button(`播种（消耗 ${crop.seedCost} 份储备粮）`, 'plant', 'small') : save.farm.cyclesLeft <= 0 ? button(`收获 ${crop.yieldCount} 份储备粮`, 'harvest-crop', 'small primary') : ''}
        </article>
        <article class="panel expedition-panel">
          <span class="panel-kicker">外出区域 01</span><h3>${config.maps[0].name}</h3>
          <p>雾层下发现三种生命反应。固定撤离点仍然可用。</p>
          <ul><li>方向键 / WASD 移动</li><li>空格攻击</li><li>靠近尸体或撤离点长按 E</li></ul>
          ${button('进入户外', 'expedition', 'primary wide')}
        </article>
        ${goal.showGoalOnShelter ? `<article class="panel goal-panel">
          <span class="panel-kicker">DEMO GOAL</span><h3>生存目标</h3>
          <div class="goal-row"><span>成功撤离</span><strong>${progress.extractions} / ${goal.requiredExtractions}</strong></div>
          <div class="goal-row"><span>带回怪物肉</span><strong>${progress.meat} / ${goal.requiredMonsterMeat}</strong></div>
          <div class="goal-row"><span>外出失败</span><strong>${progress.failures} / ${goal.maxExpeditionFailures}</strong></div>
          <p>安全食物耗尽前，带回足够的肉。</p>
        </article>` : ''}
      </div>
      <footer class="shelter-footer">已完成外出 ${save.expeditions} 次 · 配置在下一次开始游戏时生效</footer>
    </section>`;
  bindActions(app, {
    menu: renderMain,
    expedition: startExpedition,
    'eat-safe': () => eatInShelter('safe_food'),
    'eat-meat': () => eatInShelter('monster_meat'),
    plant: () => {
      if (save.safeFood < crop.seedCost) return toast('储备粮不足，无法播种');
      save.safeFood -= crop.seedCost; save.farm = { planted: true, cyclesLeft: crop.growthCycles }; persistSave(save); renderShelter();
    },
    'harvest-crop': () => {
      save.safeFood += crop.yieldCount; save.farm = { planted: false, cyclesLeft: 0 }; persistSave(save); renderShelter();
    }
  });
  requestAnimationFrame(() => {
    if (!save.introSeen) showGoalIntro();
    else showGoalResultIfNeeded();
  });
}

function eatInShelter(itemId) {
  const food = config.foods.find((item) => item.id === itemId);
  const key = itemId === 'monster_meat' ? 'monsterMeat' : 'safeFood';
  if (save[key] <= 0) return toast('库存不足');
  const before = save.madness;
  save[key] -= 1;
  save.madness = Math.min(config.global.maxMadness, save.madness + food.madnessGain);
  save.highestMadness = Math.max(save.highestMadness || 0, save.madness);
  persistSave(save); renderShelter();
  audioService.playSfx(itemId === 'monster_meat' ? 'eat' : 'click');
  const stageChange = madnessPresentation.stageChange(before, save.madness);
  toast(itemId === 'monster_meat' ? madnessPresentation.eatMessage(save.madness) : `${food.name}已食用`);
  if (stageChange && config.madnessPresentation.showStageMessages) setTimeout(() => showStageMessage(stageChange), 350);
}

function showGoalIntro() {
  const goal = config.demoGoal;
  showModal('庇护所的安全食物已经所剩无几', `你必须进入雾区狩猎，将异变生物的肉带回来。\n\n完成 ${goal.requiredExtractions} 次撤离，并带回 ${goal.requiredMonsterMeat} 块怪物肉。\n\n它们可以让你活下去。\n\n代价是，你会逐渐变得不像自己。`, [{ label: '准备外出', primary: true, action: () => { save.introSeen = true; persistSave(save); closeModal(); } }]);
}

function showGoalResultIfNeeded() {
  const status = goalService.status(save);
  if (!['victory', 'failure'].includes(status.state) || save.goalResultSeen === `${status.state}:${status.reason}`) return;
  save.goalResultSeen = `${status.state}:${status.reason}`; persistSave(save);
  if (status.state === 'victory') {
    const stage = madnessPresentation.stage(save.madness);
    showModal('你暂时活了下来', `储藏室里重新堆起了食物。\n\n低语并没有消失。\n\n总外出 ${save.expeditions} 次 · 成功撤离 ${save.successfulExtractions} 次\n击杀 ${save.enemiesKilled} · 切割 ${save.corpsesHarvested}\n带回肉块 ${save.totalMonsterMeatReturned} · 最高疯狂 ${save.highestMadness}\n当前阶段：${stage.state || stage.name}`, [
      { label: '继续游戏', primary: true, action: closeModal }, { label: '重新开始', action: resetGame }, { label: '返回主菜单', action: () => { closeModal(); renderMain(); } }
    ]);
  } else {
    const copy = status.reason === 'food' ? '储藏室已经空了。\n\n你最后一次听见低语时，它们听起来像是在催促你进食。' : '你已经没有力气再次进入雾中了。\n\n门外仍有东西在移动，但庇护所里已经没有人回应。';
    showModal('庇护所沉默了', copy, [{ label: '重新开始', primary: true, action: resetGame }, { label: '返回主菜单', action: () => { closeModal(); renderMain(); } }]);
  }
}

function resetGame() { localStorage.removeItem(SAVE_STORAGE_KEY); save = createInitialSave(config); closeModal(); renderShelter(); }

function startExpedition() {
  clearBattleKeyboard();
  const madnessView = madnessPresentation.stage(save.madness), progress = goalService.progress(save);
  app.innerHTML = `
    <section class="game-screen madness-${madnessView.id} ${config.madnessPresentation.reducedMotion ? 'reduced-motion' : ''}">
      <div class="madness-overlay" aria-hidden="true"></div>
      <div class="exploration-layout"><canvas id="game" width="760" height="760"></canvas><aside class="exploration-side">
        <span class="eyebrow">OUTDOOR_EXPLORATION</span><h3>${config.maps[0].name}</h3>
        <p>亮色是当前视野，暗色是最后记忆，黑色区域尚未探索。</p>
        <div class="legend"><span><i class="player-dot"></i>玩家</span><span><i class="enemy-dot"></i>敌人</span><span><i class="corpse-dot"></i>尸体</span><span><i class="extract-dot"></i>撤离</span></div>
        <div id="turn-message" class="turn-message"></div>
        <div class="explore-actions">${button('原地等待', 'wait')}${button('使用道具', 'use-item', 'item-button')}<button id="interact-button" data-action="interact" hidden></button></div>
        <small>WASD / 方向键移动，也可以点击相邻格</small>
      </aside></div>
      <div class="hud">
        <div class="hud-bars">
          <label>生命 <span id="health-label"></span><i><b id="health-bar"></b></i></label>
          <label>饥饿 <span id="hunger-label"></span><i><b id="hunger-bar"></b></i></label>
          <label>疯狂 <span id="madness-label"></span><i><b id="madness-bar"></b></i></label>
        </div>
        <div class="hud-info"><span>回合 <b id="turn-label"></b></span><span>坐标 <b id="position-label"></b></span><span>攻击 <b id="attack-label"></b></span><span>本次肉 <b id="meat-label"></b> / ${config.player.inventoryCapacity}</span>${config.demoGoal.showGoalOnOutdoorHud ? `<span class="hud-goal">撤离 ${progress.extractions}/${config.demoGoal.requiredExtractions} · 肉 ${progress.meat}/${config.demoGoal.requiredMonsterMeat}</span>` : ''}</div>
      </div>
      <div id="battle-layer" class="battle-layer" hidden></div>
      <div id="danger-notice" class="danger-notice" hidden></div>
      <div class="mobile-pad"><button data-dir="0,-1">▲</button><button data-dir="-1,0">◀</button><button data-dir="1,0">▶</button><button data-dir="0,1">▼</button></div>
    </section>`;
  runtime = new GridExplorationRuntime(document.querySelector('#game'), config, save, {
    onHud: updateHud,
    onNotice: renderNotice,
    onBattleTransition: renderBattleTransition,
    onBattle: renderBattle,
    onBattleResult: renderBattleResult,
    onMapEvent: renderMapEvent,
    onMapEventResult: renderMapEventResult,
    onMadnessChange: handleMadnessChange,
    onComplete: (nextSave, success) => { save = nextSave; persistSave(save); renderShelter(); toast(success ? '撤离成功，搜集物已入库' : '外出失败，你失去了本次搜集物'); }
  });
  bindActions(app, { wait: () => runtime.wait(), interact: () => runtime.interact(), 'use-item': showOutdoorItems });
  app.querySelectorAll('[data-dir]').forEach((element) => {
    const [dx, dy] = element.dataset.dir.split(',').map(Number);
    element.addEventListener('click', () => runtime.movePlayer(dx, dy));
  });
  runtime.start();
  audioService.playBgm('outdoor');
  if (config.madnessPresentation.showWhispers && save.madness >= 30) setTimeout(() => showWhisper(madnessPresentation.whisper()), 1200);
}

function showOutdoorItems() {
  const items = runtime.getOutdoorItems();
  const meat = items.find((item) => item.id === 'monster_meat');
  showModal('使用道具', '使用道具会消耗一个探索回合，附近的敌人仍会行动。', [
    {
      label: `${meat?.name || '异变肉块'} × ${meat?.count || 0} · 饥饿 +${meat?.hungerRestore || 0} / 疯狂 +${meat?.madnessGain || 0}`,
      primary: true,
      disabled: !meat?.count,
      action: () => {
        closeModal();
        const result = runtime.useOutdoorItem('monster_meat');
        if (!result.ok) return toast(result.message, true);
        audioService.playSfx('eat');
        toast(madnessPresentation.eatMessage(result.madness));
      }
    },
    { label: '取消', action: closeModal }
  ]);
}

function updateHud(hud) {
  const set = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; };
  const width = (id, value, max) => { const node = document.querySelector(id); if (node) node.style.width = `${Math.max(0, value / max * 100)}%`; };
  set('#health-label', hud.health); set('#hunger-label', hud.hunger); set('#madness-label', `${hud.madness} · ${hud.madnessState}`);
  set('#attack-label', hud.attack); set('#meat-label', hud.meat); set('#turn-label', hud.turn); set('#position-label', hud.position);
  width('#health-bar', hud.health, config.global.maxHealth); width('#hunger-bar', hud.hunger, config.global.maxHunger); width('#madness-bar', hud.madness, config.global.maxMadness);
  const message = document.querySelector('#turn-message'); if (message) message.textContent = hud.message;
  const interact = document.querySelector('#interact-button');
  if (interact) {
    interact.textContent = hud.interaction.label;
    interact.hidden = !hud.interaction.enabled;
    interact.disabled = !hud.interaction.enabled;
    interact.className = hud.interaction.enabled && config.ui.highlightInteract ? `interactive-ready ${hud.interaction.tone}` : '';
  }
}

function handleMadnessChange(before, after) {
  const change = madnessPresentation.stageChange(before, after);
  const root = document.querySelector('.game-screen');
  if (root) root.className = root.className.replace(/madness-\w+/g, '').trim() + ` madness-${madnessPresentation.stage(after).id}`;
  if (change && config.madnessPresentation.showStageMessages) showStageMessage(change);
  if (config.madnessPresentation.showWhispers) showWhisper(madnessPresentation.eatMessage(after));
  audioService.playSfx('madness');
}

function renderMapEvent(event, choose) {
  audioService.playSfx('alert');
  showModal(event.title, event.description, event.choices.map((choice, index) => ({ label: choice.label, primary: index === 0, action: () => { closeModal(); choose(choice); } })));
}

function renderMapEventResult(messages, finish) {
  showModal('事件结果', messages.join('\n') || '什么也没有发生。', [{ label: '继续探索', primary: true, action: () => { closeModal(); finish(); } }]);
}

function renderNotice(notice) {
  const node = document.querySelector('#danger-notice');
  if (!node) return;
  node.hidden = false; node.className = `danger-notice ${notice.type}`;
  node.innerHTML = `<strong>${notice.type === 'attack-intent' ? '⚠ 攻击意图' : notice.type === 'chase' ? '危险！' : '！被发现'}</strong><span>${notice.message}</span>`;
  clearTimeout(renderNotice.timer);
  audioService.playSfx(notice.type === 'attack-intent' ? 'intent' : notice.type === 'chase' ? 'chase' : 'alert');
  renderNotice.timer = setTimeout(() => { node.hidden = true; }, 1800);
}

function renderBattleTransition(view, enter) {
  clearBattleKeyboard();
  const layer = document.querySelector('#battle-layer');
  if (!layer) return enter();
  layer.hidden = false;
  layer.innerHTML = `<div class="encounter-transition" style="--enemy:${view.color}"><span>发现</span><strong>${view.enemy}</strong><i></i></div>`;
  audioService.playSfx('battle');
  requestAnimationFrame(() => layer.classList.add('transition-active'));
  setTimeout(() => { layer.classList.remove('transition-active'); enter(); }, 900);
}

function renderBattleResult(result, finish) {
  clearBattleKeyboard();
  const layer = document.querySelector('#battle-layer');
  if (!layer) return finish();
  layer.hidden = false;
  layer.innerHTML = `<div class="battle-result ${result.type}"><span>${result.type === 'victory' ? 'BATTLE WON' : result.type === 'escaped' ? 'DISENGAGED' : 'EXPEDITION FAILED'}</span><h2>${result.title}</h2><p>${result.detail}</p></div>`;
  audioService.playSfx(result.type === 'victory' ? 'victory' : result.type === 'defeat' ? 'failure' : 'escape');
  const delay = Math.max(400, (config.battle.battleResultDelay || 0) * 1000);
  setTimeout(() => { layer.hidden = true; finish(); }, delay);
}

function renderBattle(view, act) {
  const layer = document.querySelector('#battle-layer');
  if (!layer) return;
  const names = { attack: '攻击', defend: '防御', item: '道具', escape: `逃跑（${Math.round(config.battle.baseEscapeChance * 100)}%）` };
  layer.hidden = false;
  layer.innerHTML = `<section class="battle-screen">
    <header><div><span class="eyebrow">BATTLE · ROUND ${view.round}</span><h2>${view.phase === 'player' ? '轮到你行动' : '敌人正在行动…'}</h2></div><span>速度决定先后手</span></header>
    <div class="combatants">
      <article class="combatant player-combatant"><div class="combatant-art">猎</div><h3>幸存者</h3><strong>${view.player.health} / ${view.player.maxHealth} HP</strong><i><b style="width:${view.player.health / view.player.maxHealth * 100}%"></b></i><small>攻击 ${view.player.attack} · 速度 ${view.player.speed} · 疯狂 ${view.player.madness}</small></article>
      <div class="versus">VS</div>
      <article class="combatant enemy-combatant"><div class="combatant-art" style="--enemy:${view.enemy.color}">异</div><h3>${view.enemy.name}</h3><strong>${view.enemy.health} / ${view.enemy.maxHealth} HP</strong><i><b style="width:${view.enemy.health / view.enemy.maxHealth * 100}%"></b></i><small>攻击 ${view.enemy.attack} · 速度 ${view.enemy.speed}</small></article>
    </div>
    <div class="battle-bottom"><div class="battle-log">${view.log.map((line) => `<p>${line}</p>`).join('')}</div><div id="battle-action-menu" class="battle-actions player-turn"></div></div>
  </section>`;
  const menu = layer.querySelector('#battle-action-menu');
  const bindMenuKeyboard = () => {
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
    let selectedIndex = 0;
    const select = (index) => {
      selectedIndex = (index + buttons.length) % buttons.length;
      buttons.forEach((button, cursor) => button.classList.toggle('keyboard-selected', cursor === selectedIndex));
      buttons[selectedIndex]?.focus({ preventScroll: true });
    };
    clearBattleKeyboard();
    battleKeyboardHandler = (event) => {
      if (!buttons.length || layer.hidden || !layer.contains(menu)) return;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 };
      if (event.key in offsets) {
        event.preventDefault(); event.stopPropagation();
        select(selectedIndex + offsets[event.key]);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault(); event.stopPropagation();
        buttons[selectedIndex]?.click();
      }
    };
    addEventListener('keydown', battleKeyboardHandler, true);
    select(0);
  };
  const renderActions = () => {
    menu.innerHTML = view.actions.map((action, index) => `<button data-battle-action="${action}" class="${index === 0 ? 'recommended-action' : ''}">${names[action]}</button>`).join('');
    menu.querySelectorAll('[data-battle-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.battleAction;
      if (action === 'item') return renderItems();
      audioService.playSfx(action === 'attack' ? 'attack' : action);
      act(action);
    }));
    bindMenuKeyboard();
  };
  const renderItems = () => {
    menu.innerHTML = `<button data-battle-item="monster_meat" ${view.player.meat <= 0 ? 'disabled' : ''}>异变肉块 × ${view.player.meat}</button><button data-battle-back>返回</button>`;
    menu.querySelector('[data-battle-item]')?.addEventListener('click', () => { audioService.playSfx('eat'); act('eat'); });
    menu.querySelector('[data-battle-back]')?.addEventListener('click', renderActions);
    bindMenuKeyboard();
  };
  renderActions();
}

function clearBattleKeyboard() {
  if (!battleKeyboardHandler) return;
  removeEventListener('keydown', battleKeyboardHandler, true);
  battleKeyboardHandler = null;
}

const categoryDescriptions = {
  global: '控制整局规则、上限、消耗与失败结算。', player: '玩家初始能力，不修改正在进行中的角色。', monsters: '三种预设共用同一状态机，差异完全来自参数。',
  foods: '定义食物恢复与污染效果。', madnessStages: '定义疯狂阈值和攻击倍率。', equipment: '定义默认装备提供的能力。',
  maps: '定义 20×20 地图、迷雾、出生点、撤离点、刷怪点与障碍物。', battle: '定义独立回合制战斗、速度先手、转场与结果展示。', ui: '定义目标、快捷键、敌人图标和交互反馈。',
  demoGoal: '定义展示版的胜利目标与失败上限。', madnessPresentation: '定义低语、边缘效果和减少动态效果。', mapEvents: '定义随机事件的触发频率与上限。', events: '定义事件内容、权重、条件、选择与效果。', audio: '定义合成音效开关、静音与音量。',
  farming: '定义作物周期与产出。', shelter: '定义新存档的初始库存。'
};

function renderConfig() {
  app.innerHTML = `
    <section class="config-screen">
      <header class="config-header"><div><span class="eyebrow">RULE CONFIGURATION</span><h2>游戏配置</h2><p>修改规则，而不是操纵某一局游戏。</p></div><div class="config-header-actions">${button('返回主菜单', 'menu', 'ghost')}${button('校验', 'validate')}${button('保存并应用', 'save', 'primary')}</div></header>
      <div class="config-layout">
        <nav class="config-nav">${Object.keys(categoryDescriptions).map((key) => `<button class="${key === activeCategory ? 'active' : ''}" data-category="${key}"><span>${labels[key]}</span><small>${Array.isArray(configDraft[key]) ? configDraft[key].length : ''}</small></button>`).join('')}</nav>
        <section class="config-editor"><div class="config-editor-head"><div><h3>${labels[activeCategory]}</h3><p>${categoryDescriptions[activeCategory]}</p></div><span>保存后，下次开始游戏生效</span></div><div id="config-fields"></div></section>
      </div>
      <footer class="config-footer"><div>${button('恢复默认', 'reset', 'danger ghost')}${button('导入 JSON', 'import')}${button('导出 JSON', 'export')}</div><span id="config-status">当前为${configService.loadSavedConfig() ? '已保存配置' : '默认配置'}</span></footer>
    </section>`;
  renderConfigFields();
  app.querySelectorAll('[data-category]').forEach((element) => element.addEventListener('click', () => { activeCategory = element.dataset.category; renderConfig(); }));
  bindActions(app, {
    menu: renderMain,
    validate: validateDraft,
    save: () => { if (validateDraft()) { configService.saveConfig(configDraft); config = configService.loadActiveConfig(); setConfigStatus('配置已保存，将在下次开始游戏时生效', true); } },
    reset: () => { if (confirm('恢复内置默认配置？当前未保存的修改会丢失。')) { configDraft = configService.resetConfig(); renderConfig(); toast('已恢复默认配置'); } },
    export: exportDraft,
    import: () => fileInput.click()
  });
}

function renderConfigFields() {
  const root = document.querySelector('#config-fields');
  const value = configDraft[activeCategory];
  root.innerHTML = Array.isArray(value)
    ? `<div class="array-editor">${value.map((item, index) => `<article class="config-card"><header><strong>${item.name || item.state || item.id || `项目 ${index + 1}`}</strong><span>#${index + 1}</span></header>${renderObjectFields(item, `${activeCategory}.${index}`)}</article>`).join('')}</div>`
    : `<article class="config-card single">${renderObjectFields(value, activeCategory)}</article>`;
  if (activeCategory === 'maps') root.insertAdjacentHTML('afterbegin', renderMapPreview(configDraft.maps[0]));
  bindConfigInputs(root);
  if (activeCategory === 'maps') bindMapPreview();
}

function renderMapPreview(map) {
  const obstacleSet = new Set(map.obstacles.map((item) => `${item.x},${item.y}`));
  const spawnMap = new Map(map.monsterSpawns.map((item) => [`${item.x},${item.y}`, item.monsterId]));
  return `<article class="map-preview-card"><header><div><strong>20×20 配置预览</strong><small>这是关卡配置，不是运行时 GM 工具</small></div><select id="map-brush"><option value="obstacle">障碍</option><option value="spawn">玩家出生点</option><option value="extract">撤离点</option>${configDraft.monsters.map((item) => `<option value="monster:${item.id}">怪物：${item.name}</option>`).join('')}<option value="erase">删除</option></select></header><div class="map-preview-grid">${Array.from({ length: map.width * map.height }, (_, index) => { const x = index % map.width, y = Math.floor(index / map.width), key = `${x},${y}`; let type = obstacleSet.has(key) ? 'obstacle' : ''; if (map.playerSpawn.x === x && map.playerSpawn.y === y) type = 'spawn'; if (map.extractPoint.x === x && map.extractPoint.y === y) type = 'extract'; if (spawnMap.has(key)) type = `monster ${spawnMap.get(key)}`; return `<button class="${type}" data-map-x="${x}" data-map-y="${y}" title="(${x},${y})"></button>`; }).join('')}</div></article>`;
}

function bindMapPreview() {
  document.querySelectorAll('[data-map-x]').forEach((cell) => cell.addEventListener('click', () => {
    const map = configDraft.maps[0], x = Number(cell.dataset.mapX), y = Number(cell.dataset.mapY), brush = document.querySelector('#map-brush').value;
    const clear = () => { map.obstacles = map.obstacles.filter((item) => item.x !== x || item.y !== y); map.monsterSpawns = map.monsterSpawns.filter((item) => item.x !== x || item.y !== y); };
    clear();
    if (brush === 'obstacle') map.obstacles.push({ x, y });
    else if (brush === 'spawn') map.playerSpawn = { x, y };
    else if (brush === 'extract') map.extractPoint = { ...map.extractPoint, x, y };
    else if (brush.startsWith('monster:')) map.monsterSpawns.push({ monsterId: brush.split(':')[1], x, y, count: 1 });
    renderConfigFields();
  }));
}

function renderObjectFields(object, path) {
  return `<div class="field-grid">${Object.entries(object).map(([key, value]) => {
    const fieldPath = `${path}.${key}`;
    if (Array.isArray(value)) {
      if (value.length && typeof value[0] === 'object') return `<details class="nested-array"><summary>${labels[key] || key} <small>${value.length} 项</small></summary>${value.map((item, index) => `<div class="nested-item"><strong>${item.name || item.monsterId || item.id || `#${index + 1}`}</strong>${renderObjectFields(item, `${fieldPath}.${index}`)}</div>`).join('')}</details>`;
      return `<label class="field"><span>${labels[key] || key}</span><textarea data-path="${fieldPath}" data-kind="array">${JSON.stringify(value)}</textarea></label>`;
    }
    if (value && typeof value === 'object') return `<fieldset class="nested-object"><legend>${labels[key] || key}</legend>${renderObjectFields(value, fieldPath)}</fieldset>`;
    const type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : key === 'color' ? 'color' : 'text';
    if (type === 'checkbox') return `<label class="field toggle"><span>${labels[key] || key}</span><input type="checkbox" data-path="${fieldPath}" ${value ? 'checked' : ''}><i></i></label>`;
    return `<label class="field"><span>${labels[key] || key}</span><input type="${type}" data-path="${fieldPath}" value="${String(value).replaceAll('"', '&quot;')}" ${type === 'number' ? 'step="any"' : ''}></label>`;
  }).join('')}</div>`;
}

function bindConfigInputs(root) {
  root.querySelectorAll('[data-path]').forEach((input) => input.addEventListener('change', () => {
    const parts = input.dataset.path.split('.');
    let target = configDraft;
    for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
    const key = parts.at(-1);
    if (input.dataset.kind === 'array') {
      try { target[key] = JSON.parse(input.value); input.classList.remove('invalid'); } catch { input.classList.add('invalid'); }
    } else if (input.type === 'checkbox') target[key] = input.checked;
    else if (input.type === 'number') target[key] = Number(input.value);
    else target[key] = input.value;
  }));
}

function validateDraft() {
  const result = configService.validateConfig(configDraft);
  if (result.valid) { setConfigStatus('校验通过：配置引用和数值范围有效', true); return true; }
  setConfigStatus(`发现 ${result.errors.length} 个问题：${result.errors.slice(0, 3).join('；')}`, false); return false;
}

function setConfigStatus(message, valid) {
  const node = document.querySelector('#config-status'); if (!node) return;
  node.textContent = message; node.className = valid ? 'valid' : 'invalid';
}

function exportDraft() {
  const blob = new Blob([configService.exportConfig(configDraft)], { type: 'application/json' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'tiny-signal-config.json'; link.click(); URL.revokeObjectURL(link.href);
}

fileInput.addEventListener('change', async () => {
  try { configDraft = configService.importConfig(await fileInput.files[0].text()); renderConfig(); toast('配置已导入，请检查后保存'); }
  catch (error) { toast(`导入失败：${error.message}`, true); }
  fileInput.value = '';
});

function toast(message, error = false) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div'); node.className = `toast ${error ? 'error' : ''}`; node.textContent = message; document.body.append(node);
  requestAnimationFrame(() => node.classList.add('show')); setTimeout(() => node.remove(), 2800);
}

function showModal(title, copy, actions = []) {
  closeModal();
  const layer = document.createElement('div'); layer.className = 'modal-layer'; layer.id = 'global-modal';
  layer.innerHTML = `<section class="story-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow">THE FOG REMEMBERS</span><h2 id="modal-title">${title}</h2><p>${String(copy).replaceAll('\n', '<br>')}</p><div class="modal-actions">${actions.map((item, index) => `<button data-modal-action="${index}" class="${item.primary ? 'primary' : ''}" ${item.disabled ? 'disabled' : ''}>${item.label}</button>`).join('')}</div></section>`;
  document.body.append(layer);
  actions.forEach((item, index) => layer.querySelector(`[data-modal-action="${index}"]`)?.addEventListener('click', () => { audioService.playSfx('click'); item.action?.(); }));
  layer.querySelector('button')?.focus();
}

function closeModal() { document.querySelector('#global-modal')?.remove(); }

function showWhisper(message) {
  if (!config.madnessPresentation.enabled || !config.madnessPresentation.showWhispers) return;
  document.querySelector('.whisper-toast')?.remove();
  const node = document.createElement('div'); node.className = 'whisper-toast'; node.textContent = message; document.body.append(node);
  setTimeout(() => node.remove(), 2600);
}

function showStageMessage(change) {
  showModal(change.stage.state || change.stage.name, change.message, [{ label: '继续', primary: true, action: closeModal }]);
}

window.addEventListener('beforeunload', () => runtime?.stop());
renderMain();
