// js/entities/bullet.js
// Пули: движение, жизнь, попадания, отрисовка

import { norm, clamp } from "../engine.js";

export class Bullet {
  constructor({ x, y, dx, dy, speed, life, damage, fromPlayer }) {
    const n = norm(dx, dy);
    this.x = x;
    this.y = y;
    this.vx = n.x * speed;
    this.vy = n.y * speed;

    this.r = fromPlayer ? 5 : 5;
    this.life = life;
    this.t = 0;
    this.damage = damage;
    this.fromPlayer = !!fromPlayer;

    this.alive = true;
  }

  update(dt, world) {
    if (!this.alive) return;

    this.t += dt;
    if (this.t >= this.life) {
      this.alive = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // вне мира
    if (this.x < -100 || this.y < -100 || this.x > world.bounds.w + 100 || this.y > world.bounds.h + 100) {
      this.alive = false;
    }
  }

  hitsCircle(ent) {
    const dx = this.x - ent.x;
    const dy = this.y - ent.y;
    const rr = this.r + ent.r;
    return (dx * dx + dy * dy) <= rr * rr;
  }

  hitsRect(rect) {
    // точка пули внутри прямоугольника
    return this.x >= rect.x && this.x <= rect.x + rect.w &&
           this.y >= rect.y && this.y <= rect.y + rect.h;
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.fillStyle = this.fromPlayer ? "#ffd54a" : "#ff7aa2";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}