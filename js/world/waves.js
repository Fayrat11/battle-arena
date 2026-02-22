// js/world/waves.js
// Волны: регулируем количество врагов, типы, сложность по мере убийств.

export class Waves {
  constructor(cfg) {
    this.cfg = cfg;
    this.reset();
  }

  reset() {
    this.wave = 1;
    this.killsInWave = 0;
    this.totalKills = 0;
  }

  onKill() {
    this.totalKills++;
    this.killsInWave++;

    if (this.killsInWave >= this.cfg.waves.killsPerWave) {
      this.wave++;
      this.killsInWave = 0;
    }
  }

  // Вернёт тип врага для текущей волны
  pickEnemyType() {
    const t = this.cfg.enemyTypes;

    // чем выше волна, тем чаще быстрые/снайперы
    const w = this.wave;

    const r = Math.random();

    if (w <= 2) return t.grunt;

    if (w <= 4) {
      return r < 0.25 ? t.rusher : t.grunt;
    }

    if (w <= 7) {
      if (r < 0.22) return t.sniper;
      if (r < 0.55) return t.rusher;
      return t.grunt;
    }

    // поздние волны
    if (r < 0.30) return t.sniper;
    if (r < 0.70) return t.rusher;
    return t.grunt;
  }

  // Коэффициент сложности по волне
  difficultyMul() {
    // плавный рост
    return 1 + Math.min(1.2, (this.wave - 1) * 0.08);
  }

  // Сколько врагов должно быть одновременно
  desiredEnemyCount() {
    const base = this.cfg.enemy.baseCount;
    const add = Math.min(4, Math.floor((this.wave - 1) / 2));
    return Math.min(this.cfg.waves.maxEnemiesOnField, base + add);
  }
}