/**
 * Canvas ember layer for the reroll dissolve. One full-viewport canvas,
 * particles spawned from card rects. Never blocks input; respects
 * prefers-reduced-motion by not spawning at all.
 */

interface Ember {
  x: number; y: number;
  vx: number; vy: number;
  life: number; ttl: number;
  size: number;
  hue: number;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let embers: Ember[] = [];
let raf = 0;

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountFxCanvas(el: HTMLCanvasElement) {
  canvas = el;
  ctx = el.getContext('2d');
  const resize = () => {
    if (!canvas) return;
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  };
  resize();
  window.addEventListener('resize', resize);
}

function tick() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const dpr = devicePixelRatio;
  embers = embers.filter((e) => e.life < e.ttl);
  for (const e of embers) {
    e.life += 16;
    e.x += e.vx; e.y += e.vy;
    e.vy -= 0.045; // embers rise
    e.vx *= 0.985;
    const p = 1 - e.life / e.ttl;
    ctx.globalAlpha = Math.max(0, p);
    ctx.fillStyle = `hsl(${e.hue}, 85%, ${45 + p * 25}%)`;
    ctx.fillRect(e.x * dpr, e.y * dpr, e.size * dpr * p + 0.5, e.size * dpr * p + 0.5);
  }
  ctx.globalAlpha = 1;
  if (embers.length > 0) raf = requestAnimationFrame(tick);
  else raf = 0;
}

/** Burn a set of rects (the cards being rerolled) into embers. */
export function burnRects(rects: DOMRect[]) {
  if (reducedMotion() || !ctx) return;
  for (const r of rects) {
    const count = Math.min(90, Math.floor((r.width * r.height) / 900));
    for (let i = 0; i < count; i++) {
      embers.push({
        x: r.left + Math.random() * r.width,
        y: r.top + Math.random() * r.height,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -Math.random() * 1.2 - 0.2,
        life: Math.random() * 120,
        ttl: 420 + Math.random() * 260,
        size: 2 + Math.random() * 2.5,
        hue: 15 + Math.random() * 30, // ember oranges
      });
    }
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

/** Crimson motes for the Vaal moment. */
export function vaalMotes() {
  if (reducedMotion() || !ctx) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < 70; i++) {
    const edge = Math.random() < 0.5;
    embers.push({
      x: edge ? (Math.random() < 0.5 ? Math.random() * 60 : w - Math.random() * 60) : Math.random() * w,
      y: edge ? Math.random() * h : (Math.random() < 0.5 ? Math.random() * 60 : h - Math.random() * 60),
      vx: (Math.random() - 0.5) * 0.8,
      vy: -Math.random() * 0.9,
      life: 0,
      ttl: 900 + Math.random() * 500,
      size: 2 + Math.random() * 2,
      hue: 350 + Math.random() * 12,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
