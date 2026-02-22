// js/entities/player.js
// Игрок: управление от Input, физика, стрельба, HP, отрисовка (спрайт или fallback)

import { clamp, norm, len } from "../engine.js";
import { Bullet } from "./bullet.js";

export class Player {
  constructor(cfg, assets) {
    this.cfg = cfg;
    this.assets = assets;

    this.x = cfg.world.w / 2;
    this.y = cfg.world.h / 2;

    this.r = cfg.player.radius;
    this.hp = cfg.player.hp;
    this.maxHp = cfg.player.hp;

    this.vx = 0;
    this.vy = 0;

    this.faceX = 1;
    this.faceY = 0;

    this.fireCd = 0;

    this.alive = true;
  }

  reset(spawn) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.hp = this.maxHp;
    this.vx = 0; this.vy = 0;
    this.faceX = 1; this.faceY = 0;
    this.fireCd = 0;
    this.alive = true;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.alive = false;
  }

  update(dt, world, input, fx, assets) {
    if (!this.alive) return;

    // движение
    const mx = input.move.x;
    const my = input.move.y;
    const m = norm(mx, my);

    const targetVX = m.x * this.cfg.player.speed;
    const targetVY = m.y * this.cfg.player.speed;

    // сглаживание скорости (как “инерция”)
    const f = this.cfg.player.friction;
    this.vx += (targetVX - this.vx) * Math.min(1, f * dt);
    this.vy += (targetVY - this.vy) * Math.min(1, f * dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // границы мира
    this.x = clamp(this.x, this.r, world.bounds.w - this.r);
    this.y = clamp(this.y, this.r, world.bounds.h - this.r);

    // коллизии со стенами
    for (const o of world.map.obstacles) {
      world.resolveCircleRect(this, o);
    }
    // коллизии с ящиками
    for (const c of world.map.crates) {
      if (!c.alive) continue;
      world.resolveCircleRect(this, { x: c.x, y: c.y, w: c.size, h: c.size });
    }

    // направление взгляда — куда двигаемся или куда целимся
    if (input.aim.active) {
      this.faceX = input.aim.x;
      this.faceY = input.aim.y;
    } else if (Math.abs(mx) + Math.abs(my) > 0.05) {
      this.faceX = m.x;
      this.faceY = m.y;
    }

    // стрельба — только если aim активен
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (input.aim.active && this.fireCd === 0) {
      this.fireCd = this.cfg.player.fireRate;

      const bx = this.x + this.faceX * (this.r + 6);
      const by = this.y + this.faceY * (this.r + 6);

      world.bullets.push(new Bullet({
        x: bx,
        y: by,
        dx: this.faceX,
        dy: this.faceY,
        speed: this.cfg.player.bulletSpeed,
        life: this.cfg.player.bulletLife,
        damage: this.cfg.player.bulletDamage,
        fromPlayer: true
      }));

      assets.playSound("shoot", 0.35);
    }
  }

  draw(ctx, assets) {
    if (!this.alive) return;

    // тень
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.r * 0.6, this.r * 0.95, this.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const img = assets.getImage("player");

    // спрайт, если есть
    if (img) {
      const w = this.r * 2.4;
      const h = this.r * 2.4;

      const ang = Math.atan2(this.faceY, this.faceX);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);

      ctx.drawImage(img, -w / 2, -h / 2, w, h);

      // “нос”/прицел точкой (чтобы направление читалось)
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(this.r * 0.55, -this.r * 0.12, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else {
      // fallback: круг
      ctx.save();
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();

      // направление
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(this.x + this.faceX * (this.r - 6), this.y + this.faceY * (this.r - 6), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // hp ring (как стилизация)
    const k = this.hp / this.maxHp;
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = k > 0.35 ? "#7CFF6B" : "#ff4d6d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
    ctx.stroke();
    ctx.restore();
  }
}