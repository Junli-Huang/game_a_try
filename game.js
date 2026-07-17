const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const hint = document.querySelector('#hint');
const restart = document.querySelector('#restart');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const player = { x: 150, y: H / 2, r: 18, speed: 270 };
const beacon = { x: W - 155, y: H / 2, r: 30 };
let won = false;
let elapsed = 0;
let last = performance.now();

function reset() {
  Object.assign(player, { x: 150, y: H / 2 });
  won = false;
  elapsed = 0;
  restart.hidden = true;
  hint.style.opacity = '1';
}

function moveToward(clientX, clientY) {
  if (won) return;
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * W / rect.width;
  const y = (clientY - rect.top) * H / rect.height;
  const dx = x - player.x;
  const dy = y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  player.x += dx / length * Math.min(length, 34);
  player.y += dy / length * Math.min(length, 34);
}

addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  keys.add(event.key.toLowerCase());
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); moveToward(event.clientX, event.clientY); });
canvas.addEventListener('pointermove', (event) => { if (event.buttons) moveToward(event.clientX, event.clientY); });
restart.addEventListener('click', reset);

function roundedRect(x, y, w, h, radius) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}

function update(dt) {
  elapsed += dt;
  if (won) return;
  let dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
  let dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
  const length = Math.hypot(dx, dy) || 1;
  player.x = Math.max(50, Math.min(W - 50, player.x + dx / length * player.speed * dt));
  player.y = Math.max(70, Math.min(H - 70, player.y + dy / length * player.speed * dt));
  if (Math.hypot(player.x - beacon.x, player.y - beacon.y) < player.r + beacon.r) {
    won = true;
    hint.style.opacity = '0';
    restart.hidden = false;
  }
}

function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#182c48'); sky.addColorStop(1, '#0b1526');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 44; i++) {
    const x = (i * 227) % W;
    const y = (i * 97) % (H - 100) + 35;
    ctx.globalAlpha = .25 + (i % 5) * .09;
    ctx.fillStyle = '#c9efff';
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#44749544'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, H / 2); ctx.lineTo(W - 90, H / 2); ctx.stroke();

  const pulse = 1 + Math.sin(elapsed * 4) * .12;
  const glow = ctx.createRadialGradient(beacon.x, beacon.y, 2, beacon.x, beacon.y, 90 * pulse);
  glow.addColorStop(0, '#fff9aecc'); glow.addColorStop(.25, '#72e6ff55'); glow.addColorStop(1, '#72e6ff00');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(beacon.x, beacon.y, 90 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(beacon.x, beacon.y); ctx.rotate(elapsed * .7);
  ctx.fillStyle = '#fff3a8'; roundedRect(-22, -22, 44, 44, 11); ctx.restore();

  ctx.save(); ctx.translate(player.x, player.y);
  ctx.shadowBlur = 22; ctx.shadowColor = '#62d9ff';
  ctx.fillStyle = '#78dfff'; ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = '#12253b';
  ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  if (won) {
    ctx.fillStyle = '#07111dbb'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff3a8'; ctx.font = '700 54px system-ui';
    ctx.fillText('信号已点亮', W / 2, H / 2 - 18);
    ctx.fillStyle = '#cdeaff'; ctx.font = '22px system-ui';
    ctx.fillText('一个最小但完整的游戏循环', W / 2, H / 2 + 26);
  }
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, .033); last = now;
  update(dt); draw(); requestAnimationFrame(frame);
}
reset(); requestAnimationFrame(frame);
