// js/main.js
// Точка входа: создаём конфиг, грузим ассеты, запускаем Engine + GameWorld.

import { Engine } from "./engine.js";
import { Input } from "./input.js";
import { UI } from "./ui.js";
import { Assets } from "./assets.js";
import { createWorld } from "./world/map.js";
import { GameWorld } from "./game/game.js";
import { CONFIG } from "./core/constants.js";

const canvas = document.getElementById("game");

const stickL = document.getElementById("stickL");
const stickR = document.getElementById("stickR");
const knobL = document.getElementById("knobL");
const knobR = document.getElementById("knobR");

const input = new Input({ canvas, stickL, stickR, knobL, knobR });
const ui = new UI({
  hpEl: document.getElementById("hp"),
  killsEl: document.getElementById("kills"),
  goalEl: document.getElementById("goal"),
  overlayEl: document.getElementById("overlay"),
  resultTitleEl: document.getElementById("resultTitle"),
  resultSubEl: document.getElementById("resultSub"),
  restartBtn: document.getElementById("restartBtn"),
});

ui.setGoal(CONFIG.winKills);

const assets = new Assets({
  images: {
    player: "assets/player.png",
    enemy: "assets/enemy.png",
    tiles: "assets/tiles.png",
  },
  sounds: {
    shoot: "assets/sfx_shoot.mp3",
    hit: "assets/sfx_hit.mp3",
  }
});

// Важно для iOS: звук включится только после первого тапа.
let audioUnlocked = false;
function unlockAudioOnce() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  assets.unlockAudio();
  window.removeEventListener("pointerdown", unlockAudioOnce);
}
window.addEventListener("pointerdown", unlockAudioOnce, { passive: true });

(async function boot() {
  // Грузим ассеты (если ассеты пустые/не загружены, Assets сделает fallback)
  await assets.loadAll();

  const mapData = createWorld(CONFIG);
  const world = new GameWorld({ config: CONFIG, input, ui, assets, mapData });

  const engine = new Engine({
    canvas,
    world,
    input,
    ui,
    assets,
    config: { debug: false }
  });

  ui.onRestart(() => world.reset());

  world.reset();
  engine.start();
})();