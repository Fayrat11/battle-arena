const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const hpEl = document.getElementById("hp");
const killsEl = document.getElementById("kills");
const banner = document.getElementById("banner");
const bannerTitle = document.getElementById("bannerTitle");
const restartBtn = document.getElementById("restart");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

const world = {
  w: 2000,
  h: 2000
};

let state;

function reset() {
  state = {
    time: 0,
    kills: 0,
    player: {
      x: world.w/2,
      y: world.h/2,
      r: 22,
      hp: 100,
      speed: 6,
      targetX: world.w/2,
      targetY: world.h/2,
      fireCd: 0
    },
    bullets: [],
    enemies: [],
    over: false
  };

  // спавним ботов
  for (let i = 0; i < 10; i++) spawnEnemy();

  banner.hidden = true;
  hpEl.textContent = state.player.hp;
  killsEl.textContent = state.kills;
}

function spawnEnemy() {
  const e = {
    x: rand(100, world.w - 100),
    y: rand(100, world.h - 100),
    r: 18,
    hp: 30,
    speed: rand(1.8, 2.6),
    touchDmg: 12,
    touchCd: 0
  };
  // не слишком близко к игроку
  if (dist(e, state.player) < 250) {
    e.x = rand(100, world.w - 100);
    e.y = rand(100, world.h - 100);
  }
  state.enemies.push(e);
}

function nearestEnemy(p) {
  let best = null;
  let bestD = Infinity;
  for (const e of state.enemies) {
    const d = dist(p, e);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// управление касанием: игрок бежит к точке
canvas.addEventListener("pointerdown", (ev) => {
  const {x, y} = screenToWorld(ev.clientX, ev.clientY);
  state.player.targetX = x;
  state.player.targetY = y;
});
canvas.addEventListener("pointermove", (ev) => {
  if (ev.buttons === 1) {
    const {x, y} = screenToWorld(ev.clientX, ev.clientY);
    state.player.targetX = x;
    state.player.targetY = y;
  }
});
canvas.addEventListener("pointerup", () => {});

restartBtn.addEventListener("click", reset);

function screenToWorld(sx, sy) {
  const cam = getCamera();
  return { x: sx + cam.x, y: sy + cam.y };
}

function getCamera() {
  // камера следует за игроком
  const p = state.player;
  let camX = p.x - canvas.width/2;
  let camY = p.y - canvas.height/2;
  camX = clamp(camX, 0, world.w - canvas.width);
  camY = clamp(camY, 0, world.h - canvas.height);
  return { x: camX, y: camY };
}

function fireAt(p, e) {
  const dx = e.x - p.x;
  const dy = e.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * 10;
  const vy = (dy / len) * 10;

  state.bullets.push({
    x: p.x,
    y: p.y,
    r: 6,
    vx, vy,
    life: 90, // кадров
    dmg: 10
  });
}

function endGame(win) {
  state.over = true;
  bannerTitle.textContent = win ? "Победа!" : "Поражение";
  banner.hidden = false;
}

function update() {
  if (state.over) return;

  state.time++;

  const p = state.player;

  // движение к цели
  const dx = p.targetX - p.x;
  const dy = p.targetY - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 2) {
    const vx = (dx / d) * p.speed;
    const vy = (dy / d) * p.speed;
    p.x = clamp(p.x + vx, p.r, world.w - p.r);
    p.y = clamp(p.y + vy, p.r, world.h - p.r);
  }

  // авто-стрельба
  p.fireCd = Math.max(0, p.fireCd - 1);
  const target = nearestEnemy(p);
  if (target && dist(p, target) < 520 && p.fireCd === 0) {
    fireAt(p, target);
    p.fireCd = 12; // скорострельность
  }

  // пули
  for (const b of state.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
  }
  state.bullets = state.bullets.filter(b =>
    b.life > 0 && b.x > -50 && b.y > -50 && b.x < world.w+50 && b.y < world.h+50
  );

  // враги идут к игроку
  for (const e of state.enemies) {
    const ex = p.x - e.x;
    const ey = p.y - e.y;
    const ed = Math.hypot(ex, ey) || 1;
    e.x += (ex/ed) * e.speed;
    e.y += (ey/ed) * e.speed;

    e.touchCd = Math.max(0, e.touchCd - 1);

    // урон при касании
    if (dist(e, p) < e.r + p.r && e.touchCd === 0) {
      p.hp -= e.touchDmg;
      e.touchCd = 25;
      hpEl.textContent = Math.max(0, p.hp);
      if (p.hp <= 0) {
        endGame(false);
        return;
      }
    }
  }

  // столкновения пуль с врагами
  for (const b of state.bullets) {
    for (const e of state.enemies) {
      if (dist(b, e) < b.r + e.r) {
        e.hp -= b.dmg;
        b.life = 0;
        break;
      }
    }
  }

  // убрать мёртвых врагов
  const before = state.enemies.length;
  state.enemies = state.enemies.filter(e => e.hp > 0);
  const died = before - state.enemies.length;
  if (died > 0) {
    state.kills += died;
    killsEl.textContent = state.kills;
    // спавним новых, чтобы было движение
    for (let i = 0; i < died; i++) spawnEnemy();
  }

  // условие победы: 20 киллов
  if (state.kills >= 20) {
    endGame(true);
    return;
  }
}

function draw() {
  const cam = getCamera();

  // фон
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0f1115";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // сетка
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= world.w; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.h);
    ctx.stroke();
  }
  for (let y = 0; y <= world.h; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.w, y);
    ctx.stroke();
  }

  // цель движения
  const p = state.player;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,200,255,0.35)";
  ctx.arc(p.targetX, p.targetY, 16, 0, Math.PI*2);
  ctx.stroke();

  // пули
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = "#ffd54a";
    ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
    ctx.fill();
  }

  // враги
  for (const e of state.enemies) {
    ctx.beginPath();
    ctx.fillStyle = "#ff4d6d";
    ctx.arc(e.x, e.y, e.r, 0, Math.PI*2);
    ctx.fill();

    // hp bar
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(e.x - 18, e.y - 28, 36, 6);
    ctx.fillStyle = "#7CFF6B";
    ctx.fillRect(e.x - 18, e.y - 28, 36 * (e.hp/30), 6);
  }

  // игрок
  ctx.beginPath();
  ctx.fillStyle = "#3b82f6";
  ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
  ctx.fill();

  // прицел на ближайшего
  const t = nearestEnemy(p);
  if (t && dist(p, t) < 520) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.arc(t.x, t.y, t.r + 10, 0, Math.PI*2);
    ctx.stroke();
  }

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

reset();
loop();