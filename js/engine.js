// js/engine.js
// Игровой цикл + масштабирование canvas + простая камера

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function len(x, y) {
  return Math.hypot(x, y);
}

export function norm(x, y) {
  const d = Math.hypot(x, y) || 1;
  return { x: x / d, y: y / d, d };
}

export function rand(a, b) {
  return a + Math.random() * (b - a);
}

export function randInt(a, b) {
  return Math.floor(rand(a, b + 1));
}

export function now() {
  return performance.now() / 1000;
}

export class Engine {
  constructor({ canvas, world, input, ui, assets, config }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.world = world;
    this.input = input;
    this.ui = ui;
    this.assets = assets;

    this.config = config || { debug: false };

    this._running = false;
    this._last = 0;

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1
    };

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    this.canvas.width = w;
    this.canvas.height = h;

    // логический размер
    this.viewW = w / dpr;
    this.viewH = h / dpr;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;

    // немного зума под мобилку
    const base = Math.min(this.viewW, this.viewH);
    this.camera.zoom = clamp(base / 780, 0.85, 1.15);

    if (this.world && this.world.onResize) {
      this.world.onResize(this.viewW, this.viewH, this.camera.zoom);
    }
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    requestAnimationFrame((t) => this._tick(t));
  }

  stop() {
    this._running = false;
  }

  _tick(t) {
    if (!this._running) return;

    const dt = clamp((t - this._last) / 1000, 0, 1 / 20);
    this._last = t;

    // input
    this.input.update();

    // update world
    this.world.update(dt, this.camera);

    // render
    this._render();

    requestAnimationFrame((tt) => this._tick(tt));
  }

  _render() {
    const ctx = this.ctx;

    // background
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // camera transform
    ctx.save();

    const z = this.camera.zoom;
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(z, z);
    ctx.translate(-this.camera.x, -this.camera.y);

    // world draw
    this.world.draw(ctx);

    ctx.restore();

    // debug overlay (по желанию)
    if (this.config.debug) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "12px monospace";
      ctx.fillText(`cam: ${this.camera.x.toFixed(1)}, ${this.camera.y.toFixed(1)} z=${z.toFixed(2)}`, 10, this.viewH - 10);
    }
  }
}