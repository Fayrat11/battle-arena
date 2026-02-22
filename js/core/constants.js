// js/core/constants.js
// Все основные настройки игры в одном месте.

export const CONFIG = {
  // мир
  world: {
    w: 2200,
    h: 1400,
    margin: 80
  },

  // победа
  winKills: 15,

  // игрок
  player: {
    radius: 24,
    hp: 120,
    speed: 340,           // пикс/сек
    friction: 10,         // сглаживание скорости
    fireRate: 0.11,       // секунды между выстрелами
    bulletSpeed: 860,
    bulletLife: 1.0,
    bulletDamage: 14,
    recoil: 0.0
  },

  // враги
  enemy: {
    baseCount: 7,
    spawnMinDist: 380,
    radius: 22,
    hp: 55,
    speed: 230,
    fireRate: 0.55,
    bulletSpeed: 720,
    bulletLife: 1.15,
    bulletDamage: 12,
    sight: 720,
    avoidDist: 64
  },

  // типы врагов (будут в waves)
  enemyTypes: {
    grunt: {
      name: "grunt",
      hpMul: 1.0,
      speedMul: 1.0,
      fireMul: 1.0,
      bulletMul: 1.0
    },
    rusher: {
      name: "rusher",
      hpMul: 0.85,
      speedMul: 1.25,
      fireMul: 0.95,
      bulletMul: 0.95
    },
    sniper: {
      name: "sniper",
      hpMul: 0.9,
      speedMul: 0.85,
      fireMul: 1.55,
      bulletMul: 1.25
    }
  },

  // карта/укрытия
  map: {
    obstacleCount: 14,
    obstacleMinW: 90,
    obstacleMaxW: 210,
    obstacleMinH: 80,
    obstacleMaxH: 200,

    crateCount: 10,        // разрушимые ящики
    crateSize: 62,
    crateHp: 35,

    // сетка декоративная
    gridStep: 80
  },

  // эффекты
  fx: {
    hitBurstCount: 14
  },

  // баланс волнами
  waves: {
    killsPerWave: 6,
    maxEnemiesOnField: 10
  }
};