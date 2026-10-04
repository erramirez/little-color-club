// Coverage is measured over a whole gesture, independent of pointer-event frequency.
export function beginTexture(image, style, color, size, seed = 0) {
  return { image, base: new Uint8ClampedArray(image.data), coverage: new Float32Array(image.width * image.height), style, rgb: color.slice(1).match(/../g).map(h => parseInt(h, 16)), size, seed };
}
function grain(x, y, seed) {
  let n = Math.imul(x + seed * 31, 374761393) ^ Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function textureSegment(state, from, to) {
  const {image, base, coverage, rgb, size, style, seed} = state;
  const r = size / 2, dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  const left = Math.max(0, Math.floor(Math.min(from.x, to.x) - r)), right = Math.min(image.width - 1, Math.ceil(Math.max(from.x, to.x) + r));
  const top = Math.max(0, Math.floor(Math.min(from.y, to.y) - r)), bottom = Math.min(image.height - 1, Math.ceil(Math.max(from.y, to.y) + r));
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const t = length ? Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / length)) : 0;
    const distance = Math.hypot(x - from.x - t * dx, y - from.y - t * dy) / r;
    if (distance >= 1) continue;
    const noise = grain(x, y, seed);
    const amount = style === 'watercolor' ? .28 * Math.pow(1 - distance * distance, .65) * (.88 + .12 * noise) : .66 * Math.min(1, (1 - distance) * 8) * (noise < .22 ? .08 : .35 + .65 * noise);
    const pixel = y * image.width + x;
    if (amount <= coverage[pixel]) continue;
    coverage[pixel] = amount;
    const i = pixel * 4, oldAlpha = base[i + 3] / 255, alpha = amount + oldAlpha * (1 - amount);
    for (let c = 0; c < 3; c++) image.data[i + c] = (rgb[c] * amount + base[i + c] * oldAlpha * (1 - amount)) / alpha;
    image.data[i + 3] = alpha * 255;
  }
  return image;
}
