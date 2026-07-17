import { ConfigService, SAVE_STORAGE_KEY, createInitialSave, loadSave, persistSave } from './src/config/config-service.js';
import { GameRuntime } from './src/game-runtime.js';

const app = document.querySelector('#app');
const fileInput = document.querySelector('#config-file');
const configService = new ConfigService();
let config = configService.loadActiveConfig();
let save = loadSave(config);
let runtime = null;
let configDraft = structuredClone(config);
let activeCategory = 'global';

const labels = {
  global: '全局规则', player: '玩家', monsters: '怪物', foods: '食物', madnessStages: '疯狂阶段',
  equipment: '装备', maps: '地图', farming: '种植', shelter: '庇护所',
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
  initialMonsterMeat: '初始怪物肉'
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
          ${button('配置', 'config')}
        </div>
        <p class="version">V1 · 数据驱动搜打撤 Demo</p>
      </div>
      <aside class="menu-note">
        <span>生存守则 01</span>
        <strong>安全食物让你保持清醒。</strong>
        <strong>怪物肉让你变得更强。</strong>
      </aside>
    </section>`;
  bindActions(app, { start: renderShelter, config: renderConfig });
}

function madnessStage(value) {
  return config.madnessStages.find((stage) => value >= stage.min && value <= stage.max) || config.madnessStages.at(-1);
}

function renderShelter() {
  config = configService.loadActiveConfig();
  const crop = config.farming[0];
  const stage = madnessStage(save.madness);
  const farmText = !save.farm.planted ? '空置' : save.farm.cyclesLeft > 0 ? `生长中 · 还需 ${save.farm.cyclesLeft} 次外出` : '可以收获';
  const result = save.lastResult ? `<div class="result ${save.lastResult.success ? 'success' : 'failure'}">${save.lastResult.success ? `上次成功撤离，带回 ${save.lastResult.meat} 份肉` : '上次外出失败，临时搜集物已丢失'}</div>` : '';
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
}

function eatInShelter(itemId) {
  const food = config.foods.find((item) => item.id === itemId);
  const key = itemId === 'monster_meat' ? 'monsterMeat' : 'safeFood';
  if (save[key] <= 0) return toast('库存不足');
  save[key] -= 1;
  save.madness = Math.min(config.global.maxMadness, save.madness + food.madnessGain);
  persistSave(save); renderShelter(); toast(`${food.name}已食用${food.madnessGain ? `，疯狂 +${food.madnessGain}` : ''}`);
}

function startExpedition() {
  app.innerHTML = `
    <section class="game-screen">
      <canvas id="game" width="960" height="540"></canvas>
      <div class="hud">
        <div class="hud-bars">
          <label>生命 <span id="health-label"></span><i><b id="health-bar"></b></i></label>
          <label>饥饿 <span id="hunger-label"></span><i><b id="hunger-bar"></b></i></label>
          <label>疯狂 <span id="madness-label"></span><i><b id="madness-bar"></b></i></label>
        </div>
        <div class="hud-info"><span>攻击 <b id="attack-label"></b></span><span>肉块 <b id="meat-label"></b> / ${config.player.inventoryCapacity}</span></div>
      </div>
      <div id="game-message" class="game-message"></div>
      <div id="action-progress" class="action-progress" hidden><span></span><i><b></b></i></div>
      <div class="game-actions">
        ${button('攻击', 'attack', 'attack-button')}
        ${button('长按交互', 'interact', 'interact-button')}
        ${button('吃怪物肉', 'eat-meat', 'eat-button')}
      </div>
      <div class="mobile-pad"><button data-dir="0,-1">▲</button><button data-dir="-1,0">◀</button><button data-dir="1,0">▶</button><button data-dir="0,1">▼</button></div>
    </section>`;
  runtime = new GameRuntime(document.querySelector('#game'), config, save, {
    onHud: updateHud,
    onComplete: (nextSave, success) => { save = nextSave; persistSave(save); renderShelter(); toast(success ? '撤离成功，搜集物已入库' : '外出失败，你失去了本次搜集物'); }
  });
  bindActions(app, { attack: () => runtime.attack(), 'eat-meat': () => runtime.eat('monster_meat') });
  const interact = app.querySelector('[data-action="interact"]');
  ['pointerdown', 'touchstart'].forEach((name) => interact.addEventListener(name, (event) => { event.preventDefault(); runtime.setInteract(true); }));
  ['pointerup', 'pointercancel', 'pointerleave', 'touchend'].forEach((name) => interact.addEventListener(name, () => runtime.setInteract(false)));
  app.querySelectorAll('[data-dir]').forEach((element) => {
    const [dx, dy] = element.dataset.dir.split(',').map(Number);
    element.addEventListener('pointerdown', () => runtime.setVirtualDirection(dx, dy));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => element.addEventListener(name, () => runtime.clearVirtualDirection()));
  });
  runtime.start();
}

function updateHud(hud) {
  const set = (id, value) => { const node = document.querySelector(id); if (node) node.textContent = value; };
  const width = (id, value, max) => { const node = document.querySelector(id); if (node) node.style.width = `${Math.max(0, value / max * 100)}%`; };
  set('#health-label', hud.health); set('#hunger-label', hud.hunger); set('#madness-label', `${hud.madness} · ${hud.madnessState}`);
  set('#attack-label', hud.attack); set('#meat-label', hud.meat);
  width('#health-bar', hud.health, config.global.maxHealth); width('#hunger-bar', hud.hunger, config.global.maxHunger); width('#madness-bar', hud.madness, config.global.maxMadness);
  const message = document.querySelector('#game-message'); if (message) { message.textContent = hud.message; message.classList.toggle('visible', Boolean(hud.message)); }
  const progress = document.querySelector('#action-progress');
  if (progress) { progress.hidden = !hud.action; if (hud.action) { progress.querySelector('span').textContent = hud.action.label; progress.querySelector('b').style.width = `${hud.action.progress * 100}%`; } }
}

const categoryDescriptions = {
  global: '控制整局规则、上限、消耗与失败结算。', player: '玩家初始能力，不修改正在进行中的角色。', monsters: '三种预设共用同一状态机，差异完全来自参数。',
  foods: '定义食物恢复与污染效果。', madnessStages: '定义疯狂阈值和攻击倍率。', equipment: '定义默认装备提供的能力。',
  maps: '定义出生点、撤离点、刷怪点与障碍物。', farming: '定义作物周期与产出。', shelter: '定义新存档的初始库存。'
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
  bindConfigInputs(root);
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

window.addEventListener('beforeunload', () => runtime?.stop());
renderMain();
