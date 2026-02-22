const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const hpEl = document.getElementById("hp");
const killsEl = document.getElementById("kills");
const banner = document.getElementById("banner");
const bannerTitle = document.getElementById("bannerTitle");
const bannerSub = document.getElementById("bannerSub");
const restartBtn = document.getElementById("restart");

const stickL = document.getElementById("stickL");
const stickR = document.getElementById("stickR");
const knobL = document.getElementById("knobL");
const knobR = document.getElementById("knobR");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hypot(x, y) { return Math.hypot(x, y); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function normalize(x, y) {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d, d };
}

const CONFIG = {
  worldW: 1800,
  worldH: 1200,
  killsToWin: 15,

  player: {
    r: 22,
    hp: 100,
    speed: 5.2,
    fireRate: 10,     // кадры между выстрелами
    bulletSpeed: 12,
    bulletLife: 80,
    bulletDmg: 10
  },

  enemy: {
    r: 18,
    hp: 35,
    speed: 2.2,
    fireRate: 35,
    bulletSpeed: 8.6,
    bulletLife: 95,
    bulletDmg: 9,
    sight: 520
  },

  obstacles: {
    count: 10
  }
};

let state = null;

// ===== Камера =====
function getCamera() {
  const p = state.player;
  let cx = p.x - canvas.width / 2;
  let cy = p.y - canvas.height / 2;
  cx = clamp(cx, 0, CONFIG.worldW - canvas.width);
  cy = clamp(cy, 0, CONFIG.worldH - canvas.height);
  return { x: cx, y: cy };
}

function worldToScreen(wx, wy) {
  const cam = getCamera();
  return { x: wx - cam.x, y: wy - cam.y };
}

function screenToWorld(sx, sy) {
  const cam = getCamera();
  return { x: sx + cam.x, y: sy + cam.y };
}

// ===== Джойстики =====
const sticks = {
  left:  { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, max: 52 },
  right: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0, max: 52 },
};

function setKnob(knobEl, dx, dy) {
  knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function resetStick(side) {
  const s = sticks[side];
  s.active = false;
  s.id = null;
  s.dx = 0;
  s.dy = 0;
  if (side === "left") setKnob(knobL, 0, 0);
  if (side === "right") setKnob(knobR, 0, 0);
}
function updateStick(side, clientX, clientY) {
  const s = sticks[side];
  const dx = clientX - s.baseX;
  const dy = clientY - s.baseY;
  const n = normalize(dx, dy);
  const mag = Math.min(s.max, n.d);
  s.dx = n.x * mag;
  s.dy = n.y * mag;
  if (side === "left") setKnob(knobL, s.dx, s.dy);
  if (side === "right") setKnob(knobR, s.dx, s.dy);
}

function isLeftHalf(x) { return x < window.innerWidth / 2; }

canvas.addEventListener("pointerdown", (e) => {
  // важно: чтобы iOS не выделял/не скроллил
  canvas.setPointerCapture?.(e.pointerId);

  if (isLeftHalf(e.clientX)) {
    const s = sticks.left;
    if (!s.active) {
      s.active = true;
      s.id = e.pointerId;
      // базу берём по центру левого джойстика на экране (визуально всегда на месте)
      const rect = stickL.getBoundingClientRect();
      s.baseX = rect.left + rect.width / 2;
      s.baseY = rect.top + rect.height / 2;
      updateStick("left", e.clientX, e.clientY);
    }
  } else {
    const s = sticks.right;
    if (!s.active) {
      s.active = true;
      s.id = e.pointerId;
      const rect = stickR.getBoundingClientRect();
      s.baseX = rect.left + rect.width / 2;
      s.baseY = rect.top + rect.height / 2;
      updateStick("right", e.clientX, e.clientY);
    }
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (sticks.left.active && sticks.left.id === e.pointerId) {
    updateStick("left", e.clientX, e.clientY);
  }
  if (sticks.right.active && sticks.right.id === e.pointerId) {
    updateStick("right", e.clientX, e.clientY);
  }
});

function endPointer(e) {
  if (sticks.left.active && sticks.left.id === e.pointerId) resetStick("left");
  if (sticks.right.active && sticks.right.id === e.pointerId) resetStick("right");
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

// ===== Коллизии: круг и прямоугольник =====
function circleRectResolve(c, r) {
  // r: {x,y,w,h} - axis aligned
  const closestX = clamp(c.x, r.x, r.x + r.w);
  const closestY = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  const d = Math.hypot(dx, dy);
  if (d < c.r) {
    const n = normalize(dx, dy);
    const push = (c.r - d) + 0.01;
    c.x += n.x * push;
    c.y += n.y * push;
    return true;
  }
  return false;
}

function circleRectHitPoint(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function bulletHitsRect(b, r) {
  // быстрая проверка: точка внутри прямоугольника (пуля маленькая)
  return circleRectHitPoint(b.x, b.y, r);
}

// ===== Игровые сущности =====
function makePlayer() {
  return {
    x: CONFIG.worldW / 2,
    y: CONFIG.worldH / 2,
    r: CONFIG.player.r,
    hp: CONFIG.player.hp,
    fireCd: 0,
    facingX: 1,
    facingY: 0
  };
}

function spawnEnemy() {
  // спавним в стороне от игрока
  let x, y;
  for (let i = 0; i < 30; i++) {
    x = rand(80, CONFIG.worldW - 80);
    y = rand(80, CONFIG.worldH - 80);
    if (dist({ x, y }, state.player) > 320) break;
  }
  state.enemies.push({
    x, y,
    r: CONFIG.enemy.r,
    hp: CONFIG.enemy.hp,
    fireCd: rand(0, CONFIG.enemy.fireRate),
    vx: 0,
    vy: 0
  });
}

function spawnObstacles() {
  const obs = [];
  for (let i = 0; i < CONFIG.obstacles.count; i++) {
    const w = rand(90, 180);
    const h = rand(70, 160);
    const x = rand(60, CONFIG.worldW - w - 60);
    const y = rand(60, CONFIG.worldH - h - 60);
    obs.push({ x, y, w, h });
  }
  return obs;
}

function fireBullet(fromX, fromY, dirX, dirY, isPlayer) {
  const n = normalize(dirX, dirY);
  const speed = isPlayer ? CONFIG.player.bulletSpeed : CONFIG.enemy.bulletSpeed;

  state.bullets.push({
    x: fromX,
    y: fromY,
    r: isPlayer ? 5 : 5,
    vx: n.x * speed,
    vy: n.y * speed,
    life: isPlayer ? CONFIG.player.bulletLife : CONFIG.enemy.bulletLife,
    dmg: isPlayer ? CONFIG.player.bulletDmg : CONFIG.enemy.bulletDmg,
    fromPlayer: isPlayer
  });
}

// ===== Логика игры =====
function reset() {
  state = {
    time: 0,
    kills: 0,
    over: false,
    player: makePlayer(),
    enemies: [],
    bullets: [],
    obstacles: spawnObstacles()
  };

  // спавн врагов
  for (let i = 0; i < 8; i++) spawnEnemy();

  banner.hidden = true;
  hpEl.textContent = state.player.hp;
  killsEl.textContent = state.kills;
  resetStick("left");
  resetStick("right");
}

function endGame(win) {
  state.over = true;
  bannerTitle.textContent = win ? "Победа!" : "Поражение";
  bannerSub.textContent = win ? "Ты зачистил арену." : "Попробуй ещё раз.";
  banner.hidden = false;
}

restartBtn.addEventListener("click", reset);

function updatePlayer() {
  const p = state.player;

  // движение от левого джойстика
  const mx = sticks.left.dx / sticks.left.max; // -1..1
  const my = sticks.left.dy / sticks.left.max; // -1..1

  const move = normalize(mx, my);
  const moving = Math.abs(mx) > 0.05 || Math.abs(my) > 0.05;

  if (moving) {
    p.x += move.x * CONFIG.player.speed;
    p.y += move.y * CONFIG.player.speed;
    p.facingX = move.x;
    p.facingY = move.y;
  }

  // границы мира
  p.x = clamp(p.x, p.r, CONFIG.worldW - p.r);
  p.y = clamp(p.y, p.r, CONFIG.worldH - p.r);

  // коллизии с препятствиями
  for (const r of state.obstacles) circleRectResolve(p, r);

  // стрельба от правого джойстика
  p.fireCd = Math.max(0, p.fireCd - 1);
  const ax = sticks.right.dx / sticks.right.max;
  const ay = sticks.right.dy / sticks.right.max;
  const aiming = Math.abs(ax) > 0.12 || Math.abs(ay) > 0.12;

  if (aiming) {
    // направление выстрела = направление правого джойстика
    p.facingX = ax;
    p.facingY = ay;
    if (p.fireCd === 0) {
      fireBullet(p.x, p.y, ax, ay, true);
      p.fireCd = CONFIG.player.fireRate;
    }
  }
}

function enemyLineOfSight(e, p) {
  // простая проверка: если препятствие перекрывает "линию" — не стреляем
  // (упрощение) — проверяем несколько точек по сегменту
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > CONFIG.enemy.sight) return false;

  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1);
    const sx = e.x + dx * t;
    const sy = e.y + dy * t;
    for (const r of state.obstacles) {
      if (circleRectHitPoint(sx, sy, r)) return false;
    }
  }
  return true;
}

function updateEnemies() {
  const p = state.player;

  for (const e of state.enemies) {
    // движение к игроку, но если близко — чуть кружим
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const n = normalize(dx, dy);
    const d = n.d;

    let tx = n.x;
    let ty = n.y;

    if (d < 180) {
      // "обход" — перпендикуляр
      const perp = (state.time % 120 < 60) ? 1 : -1;
      tx = -n.y * perp * 0.8 + n.x * 0.2;
      ty =  n.x * perp * 0.8 + n.y * 0.2;
    }

    const nn = normalize(tx, ty);
    e.x += nn.x * CONFIG.enemy.speed;
    e.y += nn.y * CONFIG.enemy.speed;

    // границы + коллизии с препятствиями
    e.x = clamp(e.x, e.r, CONFIG.worldW - e.r);
    e.y = clamp(e.y, e.r, CONFIG.worldH - e.r);

    for (const r of state.obstacles) circleRectResolve(e, r);

    // стрельба по игроку если видит
    e.fireCd = Math.max(0, e.fireCd - 1);
    if (e.fireCd === 0 && enemyLineOfSight(e, p)) {
      fireBullet(e.x, e.y, p.x - e.x, p.y - e.y, false);
      e.fireCd = CONFIG.enemy.fireRate;
    }

    // контактный урон (лёгкий)
    if (dist(e, p) < e.r + p.r) {
      p.hp -= 0.25; // постепенно
      if (p.hp <= 0) {
        p.hp = 0;
        hpEl.textContent = 0;
        endGame(false);
        return;
      }
    }
  }

  hpEl.textContent = Math.floor(state.player.hp);
}

function updateBullets() {
  const p = state.player;

  for (const b of state.bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // препятствия — пули исчезают
    for (const r of state.obstacles) {
      if (bulletHitsRect(b, r)) {
        b.life = 0;
        break;
      }
    }

    // попадание
    if (b.life <= 0) continue;

    if (b.fromPlayer) {
      for (const e of state.enemies) {
        if (dist(b, e) < b.r + e.r) {
          e.hp -= b.dmg;
          b.life = 0;
          break;
        }
      }
    } else {
      if (dist(b, p) < b.r + p.r) {
        p.hp -= b.dmg;
        hpEl.textContent = Math.max(0, Math.floor(p.hp));
        b.life = 0;
        if (p.hp <= 0) {
          p.hp = 0;
          endGame(false);
          return;
        }
      }
    }
  }

  state.bullets = state.bullets.filter(b =>
    b.life > 0 &&
    b.x > -80 && b.y > -80 && b.x < CONFIG.worldW + 80 && b.y < CONFIG.worldH + 80
  );

  // убрать мёртвых врагов + киллы
  const before = state.enemies.length;
  state.enemies = state.enemies.filter(e => e.hp > 0);
  const died = before - state.enemies.length;

  if (died > 0) {
    state.kills += died;
    killsEl.textContent = state.kills;

    // спавним новых, чтобы матч продолжался (как в арене)
    for (let i = 0; i < died; i++) spawnEnemy();

    if (state.kills >= CONFIG.killsToWin) {
      endGame(true);
      return;
    }
  }
}

function update() {
  if (!state || state.over) return;
  state.time++;
  updatePlayer();
  updateEnemies();
  updateBullets();
}

// ===== Рендер =====
function drawBackground(cam) {
  // темный фон + сетка
  ctx.fillStyle = "#0b0f16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const step = 80;
  for (let x = 0; x <= CONFIG.worldW; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CONFIG.worldH);
    ctx.stroke();
  }
  for (let y = 0; y <= CONFIG.worldH; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CONFIG.worldW, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacles(cam) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  for (const r of state.obstacles) {
    // "блоки" как укрытия
    ctx.fillStyle = "#1b2334";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }

  ctx.restore();
}

function drawEntities(cam) {
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  // пули
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = b.fromPlayer ? "#ffd54a" : "#ff7aa2";
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // враги
  for (const e of state.enemies) {
    ctx.beginPath();
    ctx.fillStyle = "#ff4d6d";
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    // hp bar
    const w = 40, h = 6;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(e.x - w/2, e.y - e.r - 14, w, h);
    ctx.fillStyle = "#7CFF6B";
    ctx.fillRect(e.x - w/2, e.y - e.r - 14, w * (e.hp / CONFIG.enemy.hp), h);
  }

  // игрок
  const p = state.player;
  ctx.beginPath();
  ctx.fillStyle = "#3b82f6";
  ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
  ctx.fill();

  // направление (маленькая точка-нос)
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.arc(p.x + p.facingX * (p.r - 6), p.y + p.facingY * (p.r - 6), 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  if (!state) return;
  const cam = getCamera();
  drawBackground(cam);
  drawObstacles(cam);
  drawEntities(cam);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// старт
reset();
loop();