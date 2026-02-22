// js/engine.js
// Мини-движок: цикл, таймер, камера, коллизии, частицы, рендер, ассеты-хелперы.
// Специально сделано “жирно” и модульно, чтобы игра ощущалась как проект, а не демка.

export class Engine {
  constructor({ canvas, world, input, ui, assets, config }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.world = world;
    this.input = input;
    this.ui = ui;
    this.assets = assets;
    this.config = config;

    this.time = 0;
    this.dt = 0;
    this.fps = 0;

    this._last = performance.now();
    this._acc = 0;

    this.camera = new Camera();
    this.fx = new FXSystem();

    this.running = false;
    this.paused = false;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    // Чтобы canvas был чётким на Retina
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.dpr = dpr;

    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);

    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);

    this.viewW = w;
    this.viewH = h;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = (t) => {
      if (!this.running) return;
      requestAnimationFrame(tick);

      const now = t || performance.now();
      let delta = (now - this._last) / 1000;
      this._last = now;

      // защита от “скачка” если вкладка была в фоне
      delta = Math.min(0.05, Math.max(0, delta));

      // FPS
      this._acc += delta;
      if (this._acc >= 0.25) {
        this.fps = Math.round(1 / Math.max(0.0001, delta));
        this._acc = 0;
      }

      if (!this.paused) {
        this.dt = delta;
        this.time += delta;

        this.input.update(); // джойстики/кнопки
        this.world.update(this.dt, this); // логика мира
        this.fx.update(this.dt); // эффекты
      }

      this.render();
    };

    requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
  }

  setPaused(v) {
    this.paused = !!v;
  }

  // ======== РЕНДЕР =========

  clear() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
  }

  render() {
    const ctx = this.ctx;
    this.clear();

    // камера
    const cam = this.camera;
    cam.updateFromTarget(this.world.player, this.viewW, this.viewH, this.world.bounds);

    // фон
    this.drawBackground(ctx, cam);

    // мир
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    this.world.draw(ctx, this, cam);

    // эффекты поверх мира
    this.fx.draw(ctx);

    ctx.restore();

    // UI поверх
    this.ui.draw(ctx, this, this.world);

    // отладка (можно выключить)
    if (this.config.debug) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#fff";
      ctx.font = "12px -apple-system, system-ui, Segoe UI, Roboto, Arial";
      ctx.fillText(`FPS: ${this.fps}`, 12, this.viewH - 14);
      ctx.restore();
    }
  }

  drawBackground(ctx, cam) {
    // более “игровой” фон: градиент + сетка
    const g = ctx.createLinearGradient(0, 0, 0, this.viewH);
    g.addColorStop(0, "#0b0f16");
    g.addColorStop(1, "#070a0f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // мягкая виньетка
    ctx.save();
    const vg = ctx.createRadialGradient(
      this.viewW * 0.5, this.viewH * 0.45, 0,
      this.viewW * 0.5, this.viewH * 0.45, Math.max(this.viewW, this.viewH) * 0.75
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.restore();

    // сетка в координатах мира (чтобы двигалась)
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;

    // рисуем сетку через world->screen: проще — сдвигаем по камере
    const step = 80;
    const startX = - (cam.x % step);
    const startY = - (cam.y % step);

    for (let x = startX; x < this.viewW; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.viewH);
      ctx.stroke();
    }
    for (let y = startY; y < this.viewH; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.viewW, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ======== CAMERA =========

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.smooth = 0.14; // сглаживание
  }

  updateFromTarget(target, viewW, viewH, bounds) {
    if (!target) return;

    const tx = target.x - viewW / 2;
    const ty = target.y - viewH / 2;

    // lerp
    this.x += (tx - this.x) * this.smooth;
    this.y += (ty - this.y) * this.smooth;

    // clamp к миру
    this.x = clamp(this.x, bounds.x, bounds.x + bounds.w - viewW);
    this.y = clamp(this.y, bounds.y, bounds.y + bounds.h - viewH);
  }
}

// ======== FX (частицы/вспышки/текст) =========

export class FXSystem {
  constructor() {
    this.particles = [];
    this.floats = []; // плавающий текст
    this.flashes = []; // вспышки
  }

  burst(x, y, opts = {}) {
    const n = opts.count ?? 14;
    const speed = opts.speed ?? 220;
    const life = opts.life ?? 0.45;
    const color = opts.color ?? "#ffd54a";

    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: 2 + Math.random() * 3,
        life,
        t: 0,
        color,
        drag: 6 + Math.random() * 8
      });
    }
  }

  hitText(x, y, text, color = "#fff") {
    this.floats.push({
      x, y,
      vy: -40,
      life: 0.8,
      t: 0,
      text,
      color
    });
  }

  flash(x, y, r = 80, life = 0.18) {
    this.flashes.push({ x, y, r, life, t: 0 });
  }

  update(dt) {
    // particles
    for (const p of this.particles) {
      p.t += dt;
      const k = Math.max(0, 1 - p.t / p.life);
      // drag
      p.vx -= p.vx * Math.min(1, p.drag * dt);
      p.vy -= p.vy * Math.min(1, p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r = Math.max(0.5, p.r * (0.985 + 0.02 * k));
    }
    this.particles = this.particles.filter(p => p.t < p.life);

    // floats
    for (const f of this.floats) {
      f.t += dt;
      f.y += f.vy * dt;
    }
    this.floats = this.floats.filter(f => f.t < f.life);

    // flashes
    for (const fl of this.flashes) fl.t += dt;
    this.flashes = this.flashes.filter(fl => fl.t < fl.life);
  }

  draw(ctx) {
    // flashes
    for (const fl of this.flashes) {
      const k = 1 - fl.t / fl.life;
      ctx.save();
      ctx.globalAlpha = 0.35 * k;
      const g = ctx.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, fl.r);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      ctx.save();
      ctx.globalAlpha = 0.9 * k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // floating text
    for (const f of this.floats) {
      const k = 1 - f.t / f.life;
      ctx.save();
      ctx.globalAlpha = 0.95 * k;
      ctx.fillStyle = f.color;
      ctx.font = "14px -apple-system, system-ui, Segoe UI, Roboto, Arial";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
  }
}

// ======== COLLISION / PHYS =========

export function circleVsCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy);
  return d < (a.r + b.r);
}

export function resolveCircleCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const overlap = (a.r + b.r) - d;
  if (overlap > 0) {
    const nx = dx / d;
    const ny = dy / d;
    a.x += nx * (overlap * 0.5);
    a.y += ny * (overlap * 0.5);
    b.x -= nx * (overlap * 0.5);
    b.y -= ny * (overlap * 0.5);
    return true;
  }
  return false;
}

export function circleVsRect(c, r) {
  const cx = clamp(c.x, r.x, r.x + r.w);
  const cy = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - cx;
  const dy = c.y - cy;
  return (dx * dx + dy * dy) < (c.r * c.r);
}

export function resolveCircleRect(c, r) {
  const cx = clamp(c.x, r.x, r.x + r.w);
  const cy = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - cx;
  const dy = c.y - cy;
  const d = Math.hypot(dx, dy);

  if (d < c.r) {
    const nx = dx / (d || 1);
    const ny = dy / (d || 1);
    const push = (c.r - d) + 0.01;
    c.x += nx * push;
    c.y += ny * push;
    return true;
  }
  return false;
}

// ======== ASSET HELPERS =========

export function drawImageCentered(ctx, img, x, y, w, h, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawShadowCircle(ctx, x, y, r, alpha = 0.22) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.55, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ======== MATH =========

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function ang(dx, dy) {
  return Math.atan2(dy, dx);
}

export function norm(dx, dy) {
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, d };
}