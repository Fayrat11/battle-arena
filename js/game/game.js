// js/game/game.js
// Главный игровой мир: игрок, враги, пули, карта, волны, победа/поражение.

import { clamp, norm } from "../engine.js";
import { Player } from "../entities/player.js";
import { Enemy } from "../entities/enemy.js";
import { Waves } from "../world/waves.js";

export class GameWorld {
  constructor({ config, input, ui, assets, mapData }) {
    this.cfg = config;
    this.input = input;
    this.ui = ui;
    this.assets = assets;

    this.map = mapData; // { world, obstacles, crates, startZone, ... }
    this.bounds = { x: 0, y: 0, w: this.map.world.w, h: this.map.world.h };

    this.time = 0;
    this.kills = 0;
    this.over = false;

    this.player = new Player(this.cfg, this.assets);
    this.enemies = [];
    this.bullets = [];

    this.waves = new Waves(this.cfg);

    // UI init
    this.ui.hideOverlay();
    this.ui.setGoal(this.cfg.winKills);
    this.ui.setKills(0);
    this.ui.setHP(this.player.hp);
  }

  reset() {
    this.time = 0;
    this.kills = 0;
    this.over = false;

    // восстановить ящики
    for (const c of this.map.crates) {
      c.alive = true;
      c.hp = c.maxHp;
    }

    // очистить
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.waves.reset();

    // игрок в центре старт-зоны
    const spawn = {
      x: this.map.startZone.x + this.map.startZone.w / 2,
      y: this.map.startZone.y + this.map.startZone.h / 2
    };
    this.player.reset(spawn);

    // первый набор врагов
    const want = this.waves.desiredEnemyCount();
    for (let i = 0; i < want; i++) this.spawnEnemy();

    this.ui.hideOverlay();
    this.ui.setKills(this.kills);
    this.ui.setHP(this.player.hp);
  }

  onResize() {
    // можно будет добавить адаптацию
  }

  // ======= SPAWN =======
  spawnEnemy() {
    const type = this.waves.pickEnemyType();

    // избегаем: старт-зона + рядом с игроком
    const avoid = [
      this.map.startZone,
      { x: this.player.x - 220, y: this.player.y - 220, w: 440, h: 440 }
    ];

    const p = this.map.pickPointAvoiding(avoid, this.cfg.enemy.spawnMinDist);
    this.enemies.push(new Enemy(this.cfg, type, p, this.assets));
  }

  // ======= COLLISION HELPERS =======
  resolveCircleRect(c, r) {
    const closestX = clamp(c.x, r.x, r.x + r.w);
    const closestY = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    const d = Math.hypot(dx, dy);

    if (d < c.r) {
      const n = norm(dx, dy);
      const push = (c.r - d) + 0.01;
      c.x += n.x * push;
      c.y += n.y * push;
      return true;
    }
    return false;
  }

  circleCircle(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.r + b.r;
    return (dx * dx + dy * dy) <= rr * rr;
  }

  // ======= UPDATE =======
  update(dt, camera) {
    if (this.over) return;

    this.time += dt;

    // держим камеру на игроке (engine отцентрирует)
    camera.x = this.player.x;
    camera.y = this.player.y;

    // обновляем игрока
    this.player.update(dt, this, this.input, null, this.assets);
    this.ui.setHP(this.player.hp);

    // поддерживаем нужное число врагов
    const want = this.waves.desiredEnemyCount();
    while (this.enemies.filter(e => e.alive).length < want) {
      this.spawnEnemy();
      if (this.enemies.length > this.cfg.waves.maxEnemiesOnField + 6) break;
    }

    // враги
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this, this.player, null, this.assets);

      // лёгкий контактный урон (если прижали игрока)
      if (this.player.alive && this.circleCircle(e, this.player)) {
        this.player.takeDamage(10 * dt);
        if (!this.player.alive) {
          this.lose();
          return;
        }
      }
    }

    // пули
    for (const b of this.bullets) b.update(dt, this);

    // коллизии пуль со стенами/ящиками/сущностями
    for (const b of this.bullets) {
      if (!b.alive) continue;

      // стены
      for (const o of this.map.obstacles) {
        if (b.hitsRect(o)) {
          b.alive = false;
          break;
        }
      }
      if (!b.alive) continue;

      // ящики
      for (const c of this.map.crates) {
        if (!c.alive) continue;
        const r = { x: c.x, y: c.y, w: c.size, h: c.size };
        if (b.hitsRect(r)) {
          c.hp -= b.damage;
          b.alive = false;
          this.assets.playSound("hit", 0.28);

          if (c.hp <= 0) {
            c.alive = false;
            // маленькая “награда”: лечим игрока чуть-чуть за сломанный ящик
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8);
            this.ui.setHP(this.player.hp);
          }
          break;
        }
      }
      if (!b.alive) continue;

      // попадание по врагу/игроку
      if (b.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (b.hitsCircle(e)) {
            e.takeDamage(b.damage);
            b.alive = false;
            this.assets.playSound("hit", 0.25);

            if (!e.alive) {
              this.kills++;
              this.waves.onKill();
              this.ui.setKills(this.kills);

              if (this.kills >= this.cfg.winKills) {
                this.win();
                return;
              }
            }
            break;
          }
        }
      } else {
        if (this.player.alive && b.hitsCircle(this.player)) {
          this.player.takeDamage(b.damage);
          b.alive = false;
          this.assets.playSound("hit", 0.22);

          this.ui.setHP(this.player.hp);
          if (!this.player.alive) {
            this.lose();
            return;
          }
        }
      }
    }

    // чистка
    this.bullets = this.bullets.filter(b => b.alive);
    // врагов оставляем, но можно чистить мёртвых для скорости
    this.enemies = this.enemies.filter(e => e.alive || this.enemies.length < 30);
  }

  // ======= DRAW =======
  draw(ctx) {
    // земля
    this.drawGround(ctx);

    // рамка мира
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, this.bounds.w, this.bounds.h);
    ctx.restore();

    // стены
    for (const o of this.map.obstacles) {
      ctx.save();
      ctx.fillStyle = "#1b2334";
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);
      ctx.restore();
    }

    // ящики
    for (const c of this.map.crates) {
      if (!c.alive) continue;
      ctx.save();
      ctx.fillStyle = "#2a3a2f";
      ctx.fillRect(c.x, c.y, c.size, c.size);
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.size - 1, c.size - 1);

      // hp полоска ящика
      const k = c.hp / c.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(c.x, c.y - 10, c.size, 6);
      ctx.fillStyle = k > 0.35 ? "#7CFF6B" : "#ff4d6d";
      ctx.fillRect(c.x, c.y - 10, c.size * k, 6);
      ctx.restore();
    }

    // пули
    for (const b of this.bullets) b.draw(ctx);

    // враги
    for (const e of this.enemies) e.draw(ctx, this.assets);

    // игрок
    this.player.draw(ctx, this.assets);
  }

  drawGround(ctx) {
    // если tiles.png есть — можно позже сделать тайловую отрисовку
    // сейчас делаем “арену” красиво: мягкие пятна + сетка
    ctx.save();

    ctx.fillStyle = "#0b0f16";
    ctx.fillRect(0, 0, this.bounds.w, this.bounds.h);

    // пятна
    for (let i = 0; i < 16; i++) {
      const x = (i * 173) % this.bounds.w;
      const y = (i * 241) % this.bounds.h;
      const r = 120 + (i % 5) * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.03)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // сетка
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    const step = this.map.gridStep || 80;
    for (let x = 0; x <= this.bounds.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.bounds.h);
      ctx.stroke();
    }
    for (let y = 0; y <= this.bounds.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.bounds.w, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ======= END STATES =======
  win() {
    this.over = true;
    this.ui.showOverlay("Победа!", "Ты набрал нужное число киллов.");
  }

  lose() {
    this.over = true;
    this.ui.showOverlay("Поражение", "Тебя вынесли. Нажми «Заново».");
  }
}