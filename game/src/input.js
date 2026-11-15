// VOIDPRISM — keyboard and mouse state.
// The game reads held keys plus edge-triggered "just pressed" sets, cleared once
// per frame by endFrame(). Mouse position is in canvas/CSS pixels.

const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, down: false, right: false, middle: false };
    this.mousePressed = { left: false, right: false, middle: false };
    this.wheel = 0;
    this.anyPressed = false;
    this._mv = { x: 0, y: 0 };
    this._bind();
  }

  _bind() {
    const block = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    };
    window.addEventListener('keydown', (e) => {
      block(e);
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.anyPressed = true;
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = this.mouse.right = this.mouse.middle = false;
    });
    const setMouse = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * this.canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * this.canvas.height;
    };
    this.canvas.addEventListener('mousemove', setMouse);
    this.canvas.addEventListener('mousedown', (e) => {
      setMouse(e);
      if (e.button === 0) { this.mouse.down = true; this.mousePressed.left = true; }
      if (e.button === 1) { this.mouse.middle = true; this.mousePressed.middle = true; }
      if (e.button === 2) { this.mouse.right = true; this.mousePressed.right = true; }
      this.anyPressed = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 1) this.mouse.middle = false;
      if (e.button === 2) this.mouse.right = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mouseleave', () => { this.mouse.down = this.mouse.right = this.mouse.middle = false; });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mousePressed.left = this.mousePressed.right = this.mousePressed.middle = false;
    this.wheel = 0;
    this.anyPressed = false;
  }

  isDown(...codes) {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  wasPressed(...codes) {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  moveVector() {
    const v = this._mv;
    let x = 0, y = 0;
    if (this.isDown(...MOVE_KEYS.left)) x -= 1;
    if (this.isDown(...MOVE_KEYS.right)) x += 1;
    if (this.isDown(...MOVE_KEYS.up)) y -= 1;
    if (this.isDown(...MOVE_KEYS.down)) y += 1;
    if (x !== 0 && y !== 0) { const s = Math.SQRT1_2; x *= s; y *= s; }
    v.x = x; v.y = y;
    return v;
  }
}