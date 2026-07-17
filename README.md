# 雾下余粮（Tiny Signal V1）

一个轻量化的“搜打撤 + 资源管理”H5 游戏 Demo。

玩家从庇护所进入雾蚀林缘，狩猎并切割怪物，在饥饿与疯狂之间作出取舍，然后前往撤离点保住本次资源。

## 当前内容

- 主菜单：开始游戏 / 配置
- 庇护所：食物库存、食用、固定装备、灰麦种植格
- 户外：移动、近战攻击、饥饿、疯狂、死亡与撤离
- 怪物：统一状态机，支持 Idle / Wander / Chase / Attack / Return / Dead / Harvested
- 三套参数预设：静止型、游荡者、追踪者
- 尸体切割：读条、肉量、背包容量与切割倍率
- 配置系统：分类表单、本地保存、恢复默认、校验、JSON 导入/导出

## 操作

- 移动：方向键或 WASD
- 攻击：空格
- 切割 / 撤离：靠近目标后长按 E
- 手机：使用屏幕方向键和操作按钮

## 本地开发

```bash
npm install
npm run dev
```

测试与构建：

```bash
npm test
npm run build
```

在线体验：https://junli-huang.github.io/game_a_try/
