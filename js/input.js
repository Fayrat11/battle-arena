// js/input.js
// Виртуальные джойстики (как в Brawl): левый — движение, правый — прицел/стрельба.
// Оптимизировано под iPhone Safari: pointer events + защита от "залипания".

import { clamp, norm } from "./engine.js";

export class Input {
  constructor({ canvas, stickL, stickR, knobL, knobR }) {
    this.canvas = canvas;

    this.elL = stickL;
    this.elR = stickR;
    this.knobL = knobL;
    this.knobR = knobR;

    this.left = this._makeStickState();
    this.right = this._makeStickState();

    // значения -1..1
    this.move = { x: 0, y: 0 };
    this.aim = { x: 0, y: 0, active: false };

    this._bind();
  }

  _makeStickState() {
    return {
      active: false,
      id: null,
      baseX: 0,
      baseY: 0,
      dx: 0,
      dy: 0,
      max: 56
    };
  }

  _bind() {
    // Если у canvas есть pointer capture — используем
    const onDown = (e) => {
      e.preventDefault?.();
      this.canvas.setPointerCapture?.(e.pointerId);

      const half = window.innerWidth / 2;
      if (e.clientX < half) {
        this._startStick(this.left, this.elL, e);
        this._updateStick(this.left, this.knobL, e);
      } else {
        this._startStick(this.right, this.elR, e);
        this._updateStick(this.right, this.knobR, e);
      }
    };

    const onMove = (e) => {
      if (this.left.active && this.left.id === e.pointerId) {
        e.preventDefault?.();
        this._updateStick(this.left, this.knobL, e);
      }
      if (this.right.active && this.right.id === e.pointerId) {
        e.preventDefault?.();
        this._updateStick(this.right, this.knobR, e);
      }
    };

    const onUp = (e) => {
      if (this.left.active && this.left.id === e.pointerId) {
        this._resetStick(this.left, this.knobL);
      }
      if (this.right.active && this.right.id === e.pointerId) {
        this._resetStick(this.right, this.knobR);
      }
    };

    this.canvas.addEventListener("pointerdown", onDown, { passive: false });
    this.canvas.addEventListener("pointermove", onMove, { passive: false });
    this.canvas.addEventListener("pointerup", onUp, { passive: true });
    this.canvas.addEventListener("pointercancel", onUp, { passive: true });

    // страховка: если палец “ушёл” из браузера/вкладки
    window.addEventListener("blur", () => {
      this._resetStick(this.left, this.knobL);
      this._resetStick(this.right, this.knobR);
    });
  }

  _startStick(s, el, e) {
    if (s.active) return;

    s.active = true;
    s.id = e.pointerId;

    // база всегда в центре визуального джойстика
    const r = el.getBoundingClientRect();
    s.baseX = r.left + r.width / 2;
    s.baseY = r.top + r.height / 2;
  }

  _updateStick(s, knob, e) {
    const dx = e.clientX - s.baseX;
    const dy = e.clientY - s.baseY;

    const n = norm(dx, dy);
    const mag = Math.min(s.max, n.d);

    s.dx = n.x * mag;
    s.dy = n.y * mag;

    knob.style.transform = `translate(calc(-50% + ${s.dx}px), calc(-50% + ${s.dy}px))`;
  }

  _resetStick(s, knob) {
    s.active = false;
    s.id = null;
    s.dx = 0;
    s.dy = 0;
    knob.style.transform = `translate(-50%, -50%)`;
  }

  update() {
    // move
    const lx = this.left.dx / this.left.max;
    const ly = this.left.dy / this.left.max;

    this.move.x = Math.abs(lx) < 0.05 ? 0 : clamp(lx, -1, 1);
    this.move.y = Math.abs(ly) < 0.05 ? 0 : clamp(ly, -1, 1);

    // aim
    const rx = this.right.dx / this.right.max;
    const ry = this.right.dy / this.right.max;

    const ax = Math.abs(rx) < 0.10 ? 0 : clamp(rx, -1, 1);
    const ay = Math.abs(ry) < 0.10 ? 0 : clamp(ry, -1, 1);

    this.aim.x = ax;
    this.aim.y = ay;
    this.aim.active = (Math.abs(ax) > 0 || Math.abs(ay) > 0);
  }
}