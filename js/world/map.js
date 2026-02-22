// js/world/map.js
// Генерация карты: границы мира, препятствия (стены) и разрушимые ящики (crates)

import { rand, randInt, clamp, len } from "../engine.js";

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.x + a.w + pad < b.x ||
    a.x > b.x + b.w + pad ||
    a.y + a.h + pad < b.y ||
    a.y > b.y + b.h + pad
  );
}

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function pickSpawnPoint({ w, h, margin }, avoid = [], avoidPad = 120, tries = 200) {
  for (let i = 0; i < tries; i++) {
    const x = rand(margin, w - margin);
    const y = rand(margin, h - margin);

    let ok = true;
    for (const r of avoid) {
      if (pointInRect(x, y, { x: r.x - avoidPad, y: r.y - avoidPad, w: r.w + avoidPad * 2, h: r.h + avoidPad * 2 })) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, y };
  }
  return { x: w / 2, y: h / 2 };
}

function makeObstacle(world, cfg, placed) {
  const w = randInt(cfg.map.obstacleMinW, cfg.map.obstacleMaxW);
  const h = randInt(cfg.map.obstacleMinH, cfg.map.obstacleMaxH);

  const x = rand(world.margin, world.w - world.margin - w);
  const y = rand(world.margin, world.h - world.margin - h);

  const r = { x, y, w, h, kind: "wall" };

  // не ставим слишком близко к центру (чтобы старт был чище)
  const cx = world.w / 2;
  const cy = world.h / 2;
  const d = len((x + w / 2) - cx, (y + h / 2) - cy);
  if (d < 260) return null;

  for (const p of placed) {
    if (rectsOverlap(r, p, 30)) return null;
  }
  return r;
}

function makeCrate(world, cfg, placed) {
  const s = cfg.map.crateSize;
  const x = rand(world.margin, world.w - world.margin - s);
  const y = rand(world.margin, world.h - world.margin - s);

  const r = { x, y, w: s, h: s };

  // crates не должны пересекаться со стенами
  for (const p of placed) {
    if (rectsOverlap(r, p, 18)) return null;
  }

  return {
    x,
    y,
    size: s,
    hp: cfg.map.crateHp,
    maxHp: cfg.map.crateHp,
    alive: true,
    kind: "crate"
  };
}

export function createWorld(cfg) {
  const world = {
    w: cfg.world.w,
    h: cfg.world.h,
    margin: cfg.world.margin
  };

  const obstacles = [];
  const crates = [];

  // рамка по краям (для коллизий мы будем считать границы отдельно, но для рендера полезно)
  const placedForGeneration = [];

  // препятствия
  let guard = 0;
  while (obstacles.length < cfg.map.obstacleCount && guard++ < 2000) {
    const o = makeObstacle(world, cfg, placedForGeneration);
    if (!o) continue;
    obstacles.push(o);
    placedForGeneration.push(o);
  }

  // ящики
  guard = 0;
  while (crates.length < cfg.map.crateCount && guard++ < 2000) {
    const c = makeCrate(world, cfg, placedForGeneration);
    if (!c) continue;
    crates.push(c);
    placedForGeneration.push({ x: c.x, y: c.y, w: c.size, h: c.size, kind: "crate" });
  }

  // стартовая зона (в центре) — для спавна игрока
  const startZone = {
    x: world.w / 2 - 160,
    y: world.h / 2 - 160,
    w: 320,
    h: 320
  };

  // чистим всё, что слишком близко к старту
  for (const o of obstacles) {
    if (rectsOverlap(o, startZone, 10)) {
      // сдвигаем в сторону
      o.x = clamp(o.x + rand(-220, 220), world.margin, world.w - world.margin - o.w);
      o.y = clamp(o.y + rand(-220, 220), world.margin, world.h - world.margin - o.h);
    }
  }
  for (const c of crates) {
    if (rectsOverlap({ x: c.x, y: c.y, w: c.size, h: c.size }, startZone, 10)) {
      c.x = clamp(c.x + rand(-220, 220), world.margin, world.w - world.margin - c.size);
      c.y = clamp(c.y + rand(-220, 220), world.margin, world.h - world.margin - c.size);
    }
  }

  return {
    world,
    obstacles,
    crates,
    startZone,
    gridStep: cfg.map.gridStep,

    // утилита: случайная точка без пересечений (для спавна врагов)
    pickPointAvoiding(rects, pad = 120) {
      const avoid = [...obstacles, ...crates.filter(c => c.alive).map(c => ({ x: c.x, y: c.y, w: c.size, h: c.size })), ...rects];
      return pickSpawnPoint(world, avoid, pad);
    }
  };
}