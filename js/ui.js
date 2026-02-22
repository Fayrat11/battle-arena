// js/ui.js
// Управление HUD и экраном победы/поражения

export class UI {
  constructor({
    hpEl,
    killsEl,
    goalEl,
    overlayEl,
    resultTitleEl,
    resultSubEl,
    restartBtn
  }) {
    this.hpEl = hpEl;
    this.killsEl = killsEl;
    this.goalEl = goalEl;

    this.overlayEl = overlayEl;
    this.resultTitleEl = resultTitleEl;
    this.resultSubEl = resultSubEl;
    this.restartBtn = restartBtn;

    this._restartCallback = null;

    if (this.restartBtn) {
      this.restartBtn.addEventListener("click", () => {
        if (this._restartCallback) {
          this.hideOverlay();
          this._restartCallback();
        }
      });
    }
  }

  setHP(value) {
    if (!this.hpEl) return;
    this.hpEl.textContent = `HP: ${Math.max(0, Math.floor(value))}`;
  }

  setKills(value) {
    if (!this.killsEl) return;
    this.killsEl.textContent = `Kills: ${value}`;
  }

  setGoal(value) {
    if (!this.goalEl) return;
    this.goalEl.textContent = `Goal: ${value}`;
  }

  showOverlay(title, sub) {
    if (!this.overlayEl) return;

    this.resultTitleEl.textContent = title;
    this.resultSubEl.textContent = sub;
    this.overlayEl.style.display = "grid";
  }

  hideOverlay() {
    if (!this.overlayEl) return;
    this.overlayEl.style.display = "none";
  }

  showWin() {
    this.showOverlay("Победа", "Ты уничтожил всех врагов.");
  }

  showLose() {
    this.showOverlay("Поражение", "Попробуй ещё раз.");
  }

  onRestart(callback) {
    this._restartCallback = callback;
  }
}