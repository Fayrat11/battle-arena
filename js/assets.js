// js/assets.js
// Загрузка изображений и звуков + fallback если файл не найден

export class Assets {
  constructor({ images = {}, sounds = {} }) {
    this.imagePaths = images;
    this.soundPaths = sounds;

    this.images = {};
    this.sounds = {};
    this._audioUnlocked = false;
  }

  async loadAll() {
    const imagePromises = Object.entries(this.imagePaths).map(
      ([key, path]) => this._loadImage(key, path)
    );

    const soundPromises = Object.entries(this.soundPaths).map(
      ([key, path]) => this._loadSound(key, path)
    );

    await Promise.all([...imagePromises, ...soundPromises]);
  }

  _loadImage(key, path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = path;

      img.onload = () => {
        this.images[key] = img;
        resolve();
      };

      img.onerror = () => {
        console.warn("Image load failed:", path);
        this.images[key] = null; // fallback
        resolve();
      };
    });
  }

  _loadSound(key, path) {
    return new Promise((resolve) => {
      const audio = new Audio(path);
      audio.preload = "auto";

      audio.oncanplaythrough = () => {
        this.sounds[key] = audio;
        resolve();
      };

      audio.onerror = () => {
        console.warn("Sound load failed:", path);
        this.sounds[key] = null;
        resolve();
      };
    });
  }

  getImage(key) {
    return this.images[key] || null;
  }

  playSound(key, volume = 1) {
    if (!this._audioUnlocked) return;

    const snd = this.sounds[key];
    if (!snd) return;

    const clone = snd.cloneNode();
    clone.volume = volume;
    clone.play().catch(() => {});
  }

  unlockAudio() {
    this._audioUnlocked = true;
  }
}