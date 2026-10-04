export const PROFILES = ["Olivia", "Henry", "Issa"];
export const SIZES = { 9: [3, 3], 16: [4, 4], 24: [6, 4], 36: [6, 6] };
export const SIDE = 900;
export function puzzleGrid(count) {
  const grid = SIZES[count];
  if (!grid) throw new Error("Unsupported puzzle size");
  return { cols: grid[0], rows: grid[1], count: Number(count) };
}
export function shuffled(a, random = Math.random) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function formatTime(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1e3);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export class PuzzleClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.total = 0;
    this.started = null;
    this.complete = false;
  }
  start() {
    if (this.started === null && !this.complete) this.started = this.now();
  }
  pause() {
    if (this.started !== null) {
      this.total += this.now() - this.started;
      this.started = null;
    }
  }
  finish() {
    this.pause();
    this.complete = true;
  }
  reset() {
    this.total = 0;
    this.started = null;
    this.complete = false;
  }
  get elapsed() {
    return this.total + (this.started === null ? 0 : this.now() - this.started);
  }
  get running() {
    return this.started !== null;
  }
}
export function floodFill(base, paint, width, height, x, y, rgb) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const start = (y * width + x) * 4, target = Array.from(base.slice(start, start + 3));
  if (Math.max(...target) < 105) return false;
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let head = 0, tail = 1, changed = false;
  queue[0] = y * width + x;
  seen[queue[0]] = 1;
  while (head < tail) {
    const p = queue[head++], k = p * 4;
    if (!target.every((v, c) => Math.abs(v - base[k + c]) <= 32)) continue;
    if (paint[k] !== rgb[0] || paint[k + 1] !== rgb[1] || paint[k + 2] !== rgb[2] || paint[k + 3] !== 255) changed = true;
    paint[k] = rgb[0];
    paint[k + 1] = rgb[1];
    paint[k + 2] = rgb[2];
    paint[k + 3] = 255;
    const px = p % width;
    for (const q of [px > 0 ? p - 1 : -1, px < width - 1 ? p + 1 : -1, p >= width ? p - width : -1, p < width * (height - 1) ? p + width : -1]) if (q >= 0 && !seen[q]) {
      seen[q] = 1;
      queue[tail++] = q;
    }
  }
  return changed;
}
export function normalizePairCode(code) {
  if (typeof code !== "string" || code.length > 200) throw new Error("Enter three words, like purple-dog-kite.");
  const legacy = code.replace(/[\s-]/g, "").toLowerCase();
  if (/^[a-f0-9]{64}$/.test(legacy)) return legacy;
  const phrase = code.trim().toLowerCase().replace(/[\s–—-]+/g, "-");
  if (!/^[a-z]{2,16}-[a-z]{2,16}-[a-z]{2,16}$/.test(phrase)) throw new Error("Enter three words, like purple-dog-kite.");
  return phrase;
}
export function validateArtwork(a, { local = false } = {}) {
  if (!a || !/^[a-z0-9-]{8,80}$/.test(a.id) || !PROFILES.includes(a.profile) || typeof a.title !== "string" || a.title.length > 100 || typeof a.pageId !== "string" || a.pageId.length > 80 || !Number.isFinite(a.updatedAt)) return false;
  if (a.deleted === true) return a.paint === "" && a.thumbnail === "" && !a.customBase;
  return typeof a.paint === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.paint) && a.paint.length <= (local ? 5e6 : 23e5) && typeof a.thumbnail === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a.thumbnail) && a.thumbnail.length <= 2e5 && (!a.customBase || typeof a.customBase === "string" && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(a.customBase) && a.customBase.length <= (local ? 5e6 : 18e5));
}
