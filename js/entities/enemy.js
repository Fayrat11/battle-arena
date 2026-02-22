// js/entities/enemy.js
// Враг: поиск игрока, обход, стрельба, типы (grunt/rusher/sniper), отрисовка

import { clamp, norm, len } from "../engine.js";
import { Bullet } from "./bullet.js";

export class Enemy {
  constructor(cfg, type, spawn, assets) {
    this.cfg = cfg;
    this.type = type;

    const base = cfg.enemy;
    const mul = type || cfg.enemyTypes.grunt;

    this.r = base.radius;
    this.maxHp = Math.round(base.hp * mul.hpMul);
    this.hp = this.maxHp;

    this.speed = base.speed * mul.speedMul;
    this.fireRate = base.fireRate * mul.fireMul;
    this.bulletSpeed = base.bulletSpeed * mul.bulletMul;

    this.bulletLife = base.bulletLife;
    this.bulletDamage = base.bulletDamage;

    this.sight = base.sight;

    this.x = spawn.x;
    this.y = spawn.y;

    this.vx = 0;
    this.vy = 0;

    this.faceX = -1;
    this.faceY = 0;

    this.fireCd = Math.random() * this.fireRate;

    this.alive = true;

    this.assets = assets;
  }

  takeDamage(dmg) {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.alive = false;
  }

  // простая проверка "видит ли" (сэмплы точки по лучу)
  canSeePlayer(world, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > this.sight) return false;

    const steps = 7;
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1);
      const sx = this.x + dx * t;
      const sy = this.y + dy * t;

      // стены
      for (const o of world.map.obstacles) {
        if (sx >= o.x && sx <= o.x + o.w && sy >= o.y && sy <= o.y + o.h) return false;
      }
      // живые ящики
      for (const c of world.map.crates) {
        if (!c.alive) continue;
        if (sx >= c.x && sx <= c.x + c.size && sy >= c.y && sy <= c.y + c.size) return false;
      }
    }
    return true;
  }

  update(dt, world, player, fx, assets) {
    if (!this.alive) return;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const d = Math.hypot(dx, dy);

    // цель: приблизиться, но не вплотную
    const desired = (this.type?.name === "sniper") ? 420 : 240;
    const n = norm(dx, dy);

    let tx = n.x;
    let ty = n.y;

    if (d < desired) {
      // если близко — откатываемся
      tx = -n.x;
      ty = -n.y;
    }

    // “обход” перпендикуляром (чтобы не бежали прямолинейно)
    const perp = (Math.floor(world.time * 2) % 2 === 0) ? 1 : -1;
    tx = tx * 0.85 + (-n.y * perp) * 0.15;
    ty = ty * 0.85 + ( n.x * perp) * 0.15;

    const move = norm(tx, ty);
    this.vx += (move.x * this.speed - this.vx) * Math.min(1, 8 * dt);
    this.vy += (move.y * this.speed - this.vy) * Math.min(1, 8 * dt);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // границы мира
    this.x = clamp(this.x, this.r, world.bounds.w - this.r);
    this.y = clamp(this.y, this.r, world.bounds.h - this.r);

    // коллизии
    for (const o of world.map.obstacles) {
      world.resolveCircleRect(this, o);
    }
    for (const c of world.map.crates) {
      if (!c.alive) continue;
      world.resolveCircleRect(this, { x: c.x, y: c.y, w: c.size, h: c.size });
    }

    // направление взгляда
    if (d > 1) {
      this.faceX = n.x;
      this.faceY = n.y;
    }

    // стрельба
    this.fireCd = Math.max(0, this.fireCd - dt);
    const sees = this.canSeePlayer(world, player);

    if (sees && this.fireCd === 0) {
      this.fireCd = this.fireRate;

      world.bullets.push(new Bullet({
        x: this.x + this.faceX * (this.r + 6),
        y: this.y + this.faceY * (this.r + 6),
        dx: this.faceX,
        dy: this.faceY,
        speed: this.bulletSpeed,
        life: this.bulletLife,
        damage: this.bulletDamage,
        fromPlayer: false
      }));

      assets.playSound("shoot", 0.22);
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

    const img = assets.getImage("enemy");

    if (img) {
      const w = this.r * 2.3;
      const h = this.r * 2.3;
      const ang = Math.atan2(this.faceY, this.faceX);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(ang);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);

      // прицел точкой
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(this.r * 0.55, -this.r * 0.12, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = "#ff4d6d";
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // hp bar
    const k = this.hp / this.maxHp;
    const w = 44;
    const h = 6;
    const x = this.x - w / 2;
    const y = this.y - this.r - 16;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = k > 0.35 ? "#7CFF6B" : "#ff4d6d";
    ctx.fillRect(x, y, w * k, h);
    ctx.restore();
  }
}