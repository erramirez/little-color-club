import { beginTexture, textureSegment } from "./textured-paint.mjs";
import { PROFILES, SIDE, puzzleGrid, shuffled, PuzzleClock, formatTime, floodFill, validateArtwork } from "./core.mjs";
import { PAGES, THEMES, pageById, pageThumbnail } from "./library.mjs";
import { getSetting, setSetting, putArt, getArt, listArt, deleteArt, artKey } from "./storage.mjs";
import { family, familyPassphrase, ensureFamilyPassphrase, initFamily, pairFamily, flush, retrySync, syncProblems, previousFamilyPhrase, mergeGallery, loadRemote } from "./sync.mjs";
import { bindPuzzleDrag, puzzleSlotAtPoint } from "./puzzle-drag.mjs";
const $ = (id) => document.getElementById(id);
const canvas = $("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
const layer = () => {
  const c = document.createElement("canvas");
  c.width = c.height = SIDE;
  return c;
};
const baseCanvas = layer(), paintCanvas = layer();
const baseCtx = baseCanvas.getContext("2d"), paintCtx = paintCanvas.getContext("2d", { willReadFrequently: true });
let profile = "", art = null, tool = "fill", color = "#f05b67", undo = [], redo = [], ready = false, drawing = false, last = null, dirty = false;
let saveTimer, cloudTimer, saveChain = Promise.resolve(), theme = "All", loadingTicket = 0, galleryTicket = 0;
let puzzleImage = "", grid = puzzleGrid(9), placed = /* @__PURE__ */ new Set(), selected = null, paused = false, puzzleReady = false, resetMode = "colors", dragCleanups = [];
const clock = new PuzzleClock();
let brushSize = 36, difficulty = 9, libraryChoice = null, galleryManaging = false, finishedShareFile = null;
const mainColors = [["#f05b67", "Red"], ["#ff9847", "Orange"], ["#ffd54a", "Yellow"], ["#69b857", "Green"], ["#22aaa2", "Teal"], ["#4d9fe8", "Blue"], ["#9166d3", "Purple"], ["#f69ac4", "Pink"], ["#925e40", "Brown"], ["#263746", "Black"], ["#ffffff", "White"], ["#f6c4a0", "Peach"]];
const extraColors = [["#9d253c", "Dark red"], ["#db6f24", "Dark orange"], ["#f8eac0", "Cream"], ["#afd478", "Light green"], ["#276b50", "Dark green"], ["#acdcec", "Light blue"], ["#284d9b", "Dark blue"], ["#ceb1ee", "Lilac"], ["#f7d3e5", "Light pink"], ["#c69a72", "Tan"], ["#624032", "Dark brown"], ["#a3acb2", "Gray"]];
const themePictures = { "All": ["🎨", "All"], "Animals": ["🐾", "Animals"], "Space": ["🚀", "Space"], "Ocean": ["🐟", "Ocean"], "Wheels": ["🚗", "Vehicles"], "Sports": ["⚽", "Sports"], "Fairy Tales": ["👑", "Fairy tales"], "Graphic Novels": ["📖", "Stories"] };
const avatars = { Olivia: "🦄", Henry: "⚽", Issa: "🐱" };
const profileButtons = [...document.querySelectorAll("[data-profile]")];
const uiIcons = {"palette": "🎨", "pictures": "🖼️", "puzzle": "🧩", "fill": "🪣", "draw": "🖊️", "watercolor": "🖌️", "crayon": "🖍️", "erase": "🧽", "back": "⬅️", "undo": "↩️", "redo": "↪️", "check": "✔︎", "close": "✖️", "more": "➕", "settings": "⚙️", "pause": "⏸️", "play": "▶️", "mix": "🔀", "eye": "👁️", "download": "📥", "flower": "🌸", "rocket": "🚀", "sun": "☀️", "star": "⭐", "share": "📤"};
function icon(name) {
  const symbol = document.createElement("span");
  symbol.className = "ui-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = uiIcons[name];
  return symbol;
}
function buttonContents(button, name, label) {
  const span = document.createElement("span");
  span.textContent = label;
  button.replaceChildren(icon(name), span);
}
function notify(message) {
  $("toast").textContent = message;
  $("toast").style.display = "block";
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => $("toast").style.display = "none", 3500);
}
function syncStatus(status) {
  $("syncStatus").textContent = { synced: "Saved to your family", syncing: "Syncing with your family…", offline: "Saved on this device. Offline.", waiting: "Saved on this device. Family sync is waiting.", attention: "Some pictures need attention. Open the details below." }[status] || status;
}
function render() {
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, SIDE, SIDE);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(paintCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
}
async function decode(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}
function fitImage(context, image) {
  context.fillStyle = "white";
  context.fillRect(0, 0, SIDE, SIDE);
  const s = Math.min(SIDE / image.width, SIDE / image.height);
  context.drawImage(image, (SIDE - image.width * s) / 2, (SIDE - image.height * s) / 2, image.width * s, image.height * s);
}
function thumbnail() {
  const c = document.createElement("canvas");
  c.width = c.height = 280;
  c.getContext("2d").drawImage(canvas, 0, 0, 280, 280);
  const result = c.toDataURL("image/webp", 0.75);
  return result.length <= 2e5 ? result : c.toDataURL("image/jpeg", 0.75);
}
let keyboardNavigation = false;
document.addEventListener("keydown", (e) => {
  if (e.key === "Tab") keyboardNavigation = true;
});
document.addEventListener("pointerdown", () => keyboardNavigation = false);
function focusView(name) {
  if (keyboardNavigation) ($(name + "Heading") || $(name))?.focus({ preventScroll: true });
}
function view(name) {
  if (name !== "puzzle") {
    cancelDrags();
    if (clock.running) pausePuzzle();
  }
  document.body.dataset.view = name;
  $("finishManaging").hidden = name !== "gallery" || !galleryManaging;
  ["library", "studio", "puzzle", "gallery"].forEach((v) => $(v).hidden = v !== name);
  ["library", "gallery"].forEach((v) => {
    const active = v === name || v === "library" && name === "studio";
    $(v + "Tab").classList.toggle("active", active);
    $(v + "Tab").setAttribute("aria-pressed", String(active));
  });
  focusView(name);
}
function updateHistory() {
  $("undo").disabled = !ready || !undo.length;
  $("redo").disabled = !ready || !redo.length;
}
function studioLoading(on) {
  $("studio").classList.toggle("loading", on);
  $("loadingArt").hidden = !on;
  canvas.setAttribute("aria-busy", String(on));
  ["fillTool", "brushTool", "watercolorTool", "crayonTool", "eraserTool", "brushSize", "studioMore", "save"].forEach((id) => $(id).disabled = on || !ready);
  document.querySelectorAll(".swatch").forEach((b) => b.disabled = on || !ready);
  updateHistory();
}
function checkpoint() {
  undo.push(paintCtx.getImageData(0, 0, SIDE, SIDE));
  if (undo.length > 12) undo.shift();
  redo = [];
  updateHistory();
}
function changed() {
  dirty = true;
  puzzleReady = false;
  $("saveStatus").textContent = "Saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveLocal().catch(() => {
  }), 600);
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => saveLocal().then(() => flush()).catch(() => {
  }), 2200);
}
function saveLocal() {
  clearTimeout(saveTimer);
  if (!art || !ready || !dirty) return saveChain;
  const target = art, revision = crypto.randomUUID();
  const snapshot = { ...target, paint: paintCanvas.toDataURL("image/png"), customBase: target.customBase || baseCanvas.toDataURL("image/png"), thumbnail: thumbnail(), updatedAt: Date.now(), revision, pending: true };
  dirty = false;
  Object.assign(target, snapshot);
  saveChain = saveChain.catch(() => {
  }).then(async () => {
    const stored = await putArt(snapshot);
    if (stored && art === target) {
      Object.assign(target, { id: stored.id, key: stored.key, etag: stored.etag });
    }
    await setSetting("last:" + snapshot.family + ":" + snapshot.profile, stored?.id || snapshot.id);
    if (art === target && art.revision === revision) {
      $("saveStatus").textContent = "Saved";
      $("saveIssue").hidden = true;
    }
    return snapshot;
  }).catch((e) => {
    if (art === target) dirty = true;
    $("saveStatus").textContent = "Saving failed";
    $("saveIssue").hidden = false;
    notify("Can’t save. Ask a grown-up.");
    throw e;
  });
  return saveChain;
}
async function openArt(record) {
  if (!record || record.deleted || record.family !== family) throw new Error("Missing artwork");
  await saveLocal();
  if (record.family !== family || record.profile !== profile) return;
  const ticket = ++loadingTicket;
  ready = false;
  art = { ...record, editorId: record.editorId || crypto.randomUUID() };
  dirty = false;
  $("saveIssue").hidden = true;
  undo = [];
  redo = [];
  puzzleReady = false;
  $("artTitle").value = record.title;
  canvas.setAttribute("aria-label", "Coloring picture: " + record.title);
  view("studio");
  studioLoading(true);
  const previewPage = pageById(record.pageId);
  $("loadingPreview").src = record.thumbnail || (previewPage ? pageThumbnail(previewPage) : record.customBase);
  paintCtx.clearRect(0, 0, SIDE, SIDE);
  baseCtx.fillStyle = "white";
  baseCtx.fillRect(0, 0, SIDE, SIDE);
  render();
  setTool("fill");
  try {
    const page = pageById(record.pageId), source = record.customBase || page?.image;
    if (!source) throw new Error("Missing picture");
    const image = await decode(source);
    if (ticket !== loadingTicket) return;
    fitImage(baseCtx, image);
    if (record.paint) {
      const paint = await decode(record.paint);
      if (ticket !== loadingTicket) return;
      paintCtx.drawImage(paint, 0, 0, SIDE, SIDE);
    }
    render();
    ready = true;
    $("saveStatus").textContent = record.paint ? "Saved" : "Ready";
    await setSetting("last:" + family + ":" + profile, record.id);
  } catch {
    if (ticket === loadingTicket) {
      art = null;
      notify("That picture couldn’t open. Try another.");
      view("library");
    }
  } finally {
    if (ticket === loadingTicket) studioLoading(false);
  }
}
async function newPage(p) {
  const id = crypto.randomUUID();
  await openArt({ id, key: artKey(family, profile, id), family, profile, pageId: p.id, title: p.title, paint: "", customBase: null, etag: null, updatedAt: Date.now(), revision: crypto.randomUUID(), pending: false });
}
async function choosePage(page) {
  const targetFamily = family, targetProfile = profile;
  const previous = (await listArt(targetFamily, targetProfile)).find((a) => a.pageId === page.id);
  if (targetFamily !== family || targetProfile !== profile) return;
  if (!previous) return newPage(page);
  libraryChoice = { page, previous, family: targetFamily, profile: targetProfile };
  $("resumePicture").src = previous.thumbnail;
  $("newPicture").src = pageThumbnail(page);
  $("resumeDialog").showModal();
}
$("resumeSaved").onclick = async () => {
  const choice = libraryChoice;
  $("resumeDialog").close();
  if (choice?.family === family && choice.profile === profile) {
    try {
      await openArt(await getArt(choice.previous.key));
    } catch {
      notify("Couldn’t open that picture.");
    }
  }
};
$("resumeNew").onclick = () => {
  const choice = libraryChoice;
  $("resumeDialog").close();
  if (choice?.family === family && choice.profile === profile) newPage(choice.page).catch(() => {
  });
};
$("closeResume").onclick = () => $("resumeDialog").close();
async function renderContinue() {
  const targetFamily = family, targetProfile = profile;
  const id = await getSetting("last:" + targetFamily + ":" + targetProfile);
  let record = id && await getArt(artKey(targetFamily, targetProfile, id));
  if(!record||record.deleted){const latest=(await listArt(targetFamily,targetProfile)).find(a=>a.hasBase||pageById(a.pageId));if(latest)record=await getArt(latest.key);}
  if (targetFamily !== family || targetProfile !== profile) return;
  $("continueArea").hidden = !record || record.deleted || !record.customBase && !pageById(record.pageId);
  if (record && !record.deleted) {
    $("continuePicture").src = record.thumbnail;
    $("continueBtn").onclick = () => getArt(record.key).then(openArt).catch(() => {
    });
  }
}
function markTheme() {
  document.querySelectorAll("#themes button").forEach((b) => {
    const selected2 = b.dataset.theme === theme;
    b.classList.toggle("active", selected2);
    b.setAttribute("aria-pressed", String(selected2));
  });
}
async function selectProfile(name) {
  if (!PROFILES.includes(name)) return;
  try {
    await saveLocal();
    profile = name;
    theme = "All";
    markTheme();
    $("profileName").textContent = name;
    $("profileAvatar").textContent = avatars[name];
    $("switchBtn").setAttribute("aria-label", "Change player. Current player: " + name);
    $("galleryHeading").textContent = "My pictures";
    $("welcome").hidden = true;
    $("app").hidden = false;
    $("switchBtn").hidden = false;
    view("library");
    renderLibrary();
    renderContinue();
    flush();
  } catch {
    notify("Can’t switch yet. Ask a grown-up.");
  }
}
profileButtons.forEach((b) => {
  b.disabled = true;
  b.onclick = () => selectProfile(b.dataset.profile);
});
$("switchBtn").onclick = async () => {
  try {
    await saveLocal();
    ++loadingTicket;
    pausePuzzle();
    profile = "";
    art = null;
    ready = false;
    puzzleReady = false;
    ++galleryTicket;
    $("welcome").hidden = false;
    $("app").hidden = true;
    $("switchBtn").hidden = true;
    document.body.dataset.view = "welcome";
    focusView("welcome");
  } catch {
  }
};
function renderLibrary() {
  const filtered = PAGES.filter((p) => theme === "All" || p.theme === theme);
  $("pageLibrary").replaceChildren();
  for (const p of filtered) {
    const b = document.createElement("button");
    b.className = "page-card";
    b.setAttribute("aria-label", "Color " + p.title);
    const img = document.createElement("img");
    img.src = pageThumbnail(p);
    img.alt = p.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = () => {
      if (img.src !== new URL(p.image, location.href).href) img.src = p.image;
    };
    b.append(img);
    b.onclick = async () => {
      b.disabled = true;
      try {
        await choosePage(p);
      } catch {
      } finally {
        b.disabled = false;
      }
    };
    $("pageLibrary").append(b);
  }
}
THEMES.forEach((t) => {
  const b = document.createElement("button"), symbol = document.createElement("span"), label = document.createElement("span");
  const [picture, word] = themePictures[t];
  symbol.className = "theme-icon";
  symbol.textContent = picture;
  symbol.setAttribute("aria-hidden", "true");
  label.textContent = word;
  b.append(symbol, label);
  b.dataset.theme = t;
  b.setAttribute("aria-label", t === "All" ? "All pictures" : t + " pictures");
  b.onclick = () => {
    theme = t;
    markTheme();
    renderLibrary();
  };
  $("themes").append(b);
});
markTheme();
function setTool(t) {
  tool = t;
  ["fill", "brush", "watercolor", "crayon", "eraser"].forEach((v) => {
    $(v + "Tool").classList.toggle("selected", v === t);
    $(v + "Tool").setAttribute("aria-pressed", String(v === t));
  });
  $("brushSize").hidden = t === "fill";
  canvas.dataset.tool = t;
}
let rememberedColor = null;
function setColor(c, close = true) {
  color = c;
  const recent = $("recentColor");
  $("palette").append(recent);
  const peach = $("palette").querySelector('[data-color="#f6c4a0"]');
  if (peach) peach.hidden = false;
  const custom = !mainColors.some(([value]) => value === c);
  recent.hidden = !rememberedColor && !custom;
  if (custom) {
    rememberedColor = c;
    recent.dataset.color = c;
    recent.style.setProperty("--c", c);
    const rgb = c.slice(1).match(/../g).map((v) => parseInt(v, 16));
    recent.style.setProperty("--mark", rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 170 ? "#263746" : "#fff");
    recent.setAttribute("aria-label", "Current color " + c);

  }
  document.querySelectorAll(".swatch").forEach((b) => {
    const selected2 = b.dataset.color === c;
    b.classList.toggle("selected", selected2);
    b.setAttribute("aria-pressed", String(selected2));
  });
  if (custom) $("customColor").value = c;
  if (tool === "eraser") setTool("fill");
  if (close && $("artMenu").open) $("artMenu").close();
}
function swatch(c, name, parent) {
  const b = document.createElement("button");
  b.className = "swatch";
  b.style.setProperty("--c", c);
  const rgb = c.slice(1).match(/../g).map((v) => parseInt(v, 16));
  b.style.setProperty("--mark", rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 170 ? "#263746" : "#fff");
  b.dataset.color = c;
  b.setAttribute("aria-label", name);
  b.append(icon("check"));
  bindColorPress(b, parent !== "shadePalette");
  $(parent).append(b);
}
function openShades(button) {
  const c = button.dataset.color;
  const rgb = c.slice(1).match(/../g).map(h => parseInt(h, 16));
  $("shadePalette").replaceChildren();
  const shades = [...new Set([-0.65, -0.4, -0.2, 0, 0.25, 0.5, 0.75].map(amount =>
    "#" + rgb.map(v => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount).toString(16).padStart(2, "0")).join("")))];
  shades.forEach((value, i) => swatch(value, "Shade " + (i + 1) + " " + value, "shadePalette"));
  document.querySelectorAll(".swatch").forEach(b => {
    b.classList.toggle("selected", b.dataset.color === color);
    b.setAttribute("aria-pressed", String(b.dataset.color === color));
  });
  $("shadeDialog").showModal();
}
function bindColorPress(b, shades = true) {
  let timer, start, held = false;
  const cancel = () => { clearTimeout(timer); timer = null; start = null; };
  b.onclick = () => {
    if (held) { held = false; return; }
    setColor(b.dataset.color);
    if ($("shadeDialog").open) $("shadeDialog").close();
  };
  if (!shades) return;
  b.setAttribute("aria-haspopup", "dialog");
  b.title = "Hold for shades";
  b.onpointerdown = e => {
    cancel();
    if (e.isPrimary === false || (e.button !== undefined && e.button !== 0)) return;
    held = false;
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { cancel(); held = true; openShades(b); }, 500);
  };
  b.onpointermove = e => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  };
  b.onpointerup = cancel;
  b.onpointercancel = () => { cancel(); held = false; };
  b.onpointerleave = cancel;
  b.oncontextmenu = e => { e.preventDefault(); cancel(); held = true; if (!$("shadeDialog").open) openShades(b); };
  b.onkeydown = e => {
    if (e.key === "ArrowDown") { e.preventDefault(); openShades(b); }
  };
}
$("closeShades").onclick = () => $("shadeDialog").close();
bindColorPress($("recentColor"));
mainColors.forEach(([c, n]) => swatch(c, n, "palette"));
extraColors.forEach(([c, n]) => swatch(c, n, "extraPalette"));
setColor(color, false);
$("customColor").oninput = (e) => setColor(e.target.value, false);
["fill", "brush", "watercolor", "crayon", "eraser"].forEach((t) => $(t + "Tool").onclick = () => setTool(t));
const brushSizes = [{ value: 18, name: "small", dot: 12 }, { value: 36, name: "medium", dot: 22 }, { value: 52, name: "medium-large", dot: 27 }, { value: 70, name: "large", dot: 32 }];
let brushIndex = 1;
$("brushSize").onclick = () => {
  brushIndex = (brushIndex + 1) % brushSizes.length;
  const b = brushSizes[brushIndex];
  brushSize = b.value;
  $("brushDot").style.setProperty("--dot", b.dot + "px");
  $("brushSize").setAttribute("aria-label", "Brush size: " + b.name);
};
$("studioMore").onclick = () => {
  if (ready) $("artMenu").showModal();
};
$("closeArtMenu").onclick = () => $("artMenu").close();
function point(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(SIDE - 1, Math.floor((e.clientX - r.left) * SIDE / r.width))), y: Math.max(0, Math.min(SIDE - 1, Math.floor((e.clientY - r.top) * SIDE / r.height))) };
}
let texture = null, textureSeed = 0;
function stroke(p) {
  if (texture) {
    paintCtx.putImageData(textureSegment(texture, last, p), 0, 0);
    last = p;
    return;
  }
  paintCtx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  paintCtx.strokeStyle = color;
  paintCtx.lineWidth = brushSize;
  paintCtx.lineCap = "round";
  paintCtx.lineJoin = "round";
  paintCtx.beginPath();
  paintCtx.moveTo(last.x, last.y);
  paintCtx.lineTo(p.x, p.y);
  paintCtx.stroke();
  paintCtx.globalCompositeOperation = "source-over";
  last = p;
}
canvas.onpointerdown = (e) => {
  if (!ready || e.isPrimary === false) return;
  e.preventDefault();
  const p = point(e);
  if (tool === "fill") {
    const im = paintCtx.getImageData(0, 0, SIDE, SIDE), rgb = color.slice(1).match(/../g).map((h) => parseInt(h, 16));
    checkpoint();
    if (floodFill(baseCtx.getImageData(0, 0, SIDE, SIDE).data, im.data, SIDE, SIDE, p.x, p.y, rgb)) {
      paintCtx.putImageData(im, 0, 0);
      render();
      changed();
    } else {
      undo.pop();
      updateHistory();
    }
    return;
  }
  checkpoint();
  drawing = true;
  texture = tool === "watercolor" || tool === "crayon" ? beginTexture(paintCtx.getImageData(0, 0, SIDE, SIDE), tool, color, brushSize, ++textureSeed) : null;
  last = p;
  canvas.setPointerCapture(e.pointerId);
  stroke({ x: p.x + 0.01, y: p.y });
  render();
  changed();
};
canvas.onpointermove = (e) => {
  if (drawing && e.isPrimary !== false) {
    for (const event of e.getCoalescedEvents?.() || [e]) stroke(point(event));
    render();
    changed();
  }
};
function stopDrawing() {
  if (drawing) {
    drawing = false;
    texture = null;
    saveLocal().catch(() => {
    });
  }
}
canvas.onpointerup = stopDrawing;
canvas.onpointercancel = stopDrawing;
canvas.onlostpointercapture = stopDrawing;
$("undo").onclick = () => {
  if (!ready || !undo.length) return;
  redo.push(paintCtx.getImageData(0, 0, SIDE, SIDE));
  paintCtx.putImageData(undo.pop(), 0, 0);
  render();
  changed();
  updateHistory();
};
$("redo").onclick = () => {
  if (!ready || !redo.length) return;
  undo.push(paintCtx.getImageData(0, 0, SIDE, SIDE));
  paintCtx.putImageData(redo.pop(), 0, 0);
  render();
  changed();
  updateHistory();
};
$("artTitle").onchange = () => {
  if (art) {
    art.title = $("artTitle").value.trim() || pageById(art.pageId)?.title || "My picture";
    $("artTitle").value = art.title;
    changed();
  }
};
$("save").onclick = async () => {
  if (!ready || !art) return;
  const button = $("save");
  button.disabled = true;
  try {
    if (!art.paint) dirty = true;
    await saveLocal();
    $("finishedPicture").src = canvas.toDataURL("image/png");
    $("finishedDialog").showModal();
    finishedShareFile = null;
    canvas.toBlob?.((blob) => {
      if (blob) finishedShareFile = new File([blob], "Color-Club.png", { type: "image/png" });
    }, "image/png");
    flush();
  } catch {
  } finally {
    button.disabled = false;
  }
};
$("closeFinished").onclick = $("finishedColor").onclick = () => $("finishedDialog").close();
$("finishedPuzzle").onclick = () => {
  $("finishedDialog").close();
  startPuzzle();
};
$("finishedShare").onclick = async () => {
  const file = finishedShareFile;
  if (!file) {
    notify("Picture is getting ready. Try again.");
    return;
  }
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "My Color Club picture" });
    else downloadBlob(file, file.name);
  } catch (e) {
    if (e.name !== "AbortError") notify("Couldn’t share. Use Download in Grown-ups.");
  }
};
$("retrySave").onclick = () => saveLocal().then(() => flush()).catch(() => {
});
$("finishedGallery").onclick = () => {
  $("finishedDialog").close();
  gallery().catch(() => {
  });
};
function openReset(mode) {
  resetMode = mode;
  $("artMenu").close();
  $("resetHeading").textContent = mode === "colors" ? "Erase all your colors?" : "Mix the puzzle again?";
  $("confirmReset").textContent = mode === "colors" ? "Yes, erase" : "Yes, mix";
  $("resetDialog").showModal();
}
$("clear").onclick = () => {
  if (ready) openReset("colors");
};
$("cancelReset").onclick = () => $("resetDialog").close();
$("confirmReset").onclick = () => {
  $("resetDialog").close();
  if (resetMode === "puzzle") {
    createPuzzle();
    return;
  }
  if (!ready) return;
  checkpoint();
  paintCtx.clearRect(0, 0, SIDE, SIDE);
  render();
  changed();
};
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e4);
}
$("download").onclick = () => {
  if (ready) canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, profile + "-" + art.title.replace(/[^a-z0-9]/gi, "-") + ".png");
  }, "image/png");
};
$("exportArt").onclick = () => {
  if (!ready) return;
  const file = { format: "little-color-club", version: 2, art: { id: art.id, profile: art.profile, title: art.title, pageId: art.pageId, paint: paintCanvas.toDataURL(), thumbnail: thumbnail(), customBase: art.customBase, updatedAt: Date.now() } };
  downloadBlob(new Blob([JSON.stringify(file)], { type: "application/json" }), profile + "-artwork.colorclub");
};
$("upload").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!profile) {
    notify("Pick a player before adding a picture.");
    return;
  }
  const targetProfile = profile, targetFamily = family;
  try {
    if (file.size > 2e7) throw new Error("Please choose an image smaller than 20 MB.");
    const url = URL.createObjectURL(file);
    let image;
    try {
      image = await decode(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    if (profile !== targetProfile || family !== targetFamily) return;
    const c = layer();
    fitImage(c.getContext("2d"), image);
    const customBase = c.toDataURL("image/jpeg", 0.88), id = crypto.randomUUID();
    $("parentDialog").close();
    await openArt({ id, key: artKey(family, profile, id), family, profile, pageId: "custom", title: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "My own page", paint: "", customBase, etag: null, updatedAt: Date.now(), revision: crypto.randomUUID(), pending: false });
    if (!ready) return;
    dirty = true;
    await saveLocal();
    flush();
  } catch (err) {
    notify(err.message === "Please choose an image smaller than 20 MB." ? err.message : "Couldn’t open that picture.");
  }
};
$("importArt").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!profile) {
    notify("Pick a player before opening a file.");
    return;
  }
  const targetProfile = profile, targetFamily = family;
  try {
    if (file.size > 12e6) throw new Error();
    const data = JSON.parse(await file.text());
    if (profile !== targetProfile || family !== targetFamily) return;
    if (data.format !== "little-color-club" || data.version !== 2 || !validateArtwork(data.art, { local: true }) || !data.art.customBase && !pageById(data.art.pageId)) throw new Error();
    const id = crypto.randomUUID();
    $("parentDialog").close();
    await openArt({ ...data.art, id, key: artKey(family, profile, id), profile, family, etag: null, revision: crypto.randomUUID(), pending: true });
    if (!ready) return;
    dirty = true;
    await saveLocal();
    flush();
  } catch {
    notify("Couldn’t open that editable file.");
  }
};
async function gallery() {
  await saveLocal();
  view("gallery");
  const ticket = ++galleryTicket, currentProfile = profile, currentFamily = family;
  const loading = document.createElement("div");
  loading.className = "loading-shelf";
  loading.textContent = "Opening…";
  $("galleryItems").replaceChildren(loading);
  try {
    const arts = (await mergeGallery(currentProfile)).sort((a, b) => b.updatedAt - a.updatedAt);
    if (ticket !== galleryTicket || $("gallery").hidden || profile !== currentProfile) return;
    $("galleryItems").replaceChildren();
    if (!arts.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.append(icon("pictures"));
      const b = document.createElement("button");
      b.className = "primary";
      buttonContents(b, "palette", "Pick a picture");
      b.onclick = goLibrary;
      empty.append(b);
      $("galleryItems").append(empty);
    }
    for (const a of arts) {
      const card = document.createElement("div");
      card.className = "gallery-card";
      const picture = document.createElement("button");
      picture.className = "gallery-picture";
      picture.setAttribute("aria-label", "Color " + a.title);
      const img = document.createElement("img");
      img.src = a.thumbnail;
      img.alt = a.title;
      img.loading = "lazy";
      picture.append(img);
      const actions = document.createElement("div");
      actions.className = "gallery-buttons";
      const coloring = document.createElement("button"), puzzle = document.createElement("button");
      buttonContents(coloring, "palette", "Color");
      buttonContents(puzzle, "puzzle", "Puzzle");
      const open = async (play) => {
        picture.disabled = coloring.disabled = puzzle.disabled = true;
        try {
          const record = a.remote ? await loadRemote(currentProfile, a.id, currentFamily) : await getArt(a.key);
          if (profile !== currentProfile || family !== currentFamily) return;
          await openArt(record);
          if (play && ready) startPuzzle();
        } catch {
          notify("Connect to open this picture.");
        } finally {
          picture.disabled = coloring.disabled = puzzle.disabled = false;
        }
      };
      const available = a.hasBase || a.pageId === "custom" || pageById(a.pageId);
      picture.onclick = coloring.onclick = () => available ? open(false) : notify("This picture’s original page is unavailable. Ask a grown-up.");
      puzzle.onclick = () => available ? open(true) : notify("This picture’s original page is unavailable. Ask a grown-up.");
      actions.append(coloring, puzzle);
      card.append(picture, actions);
      if (galleryManaging) {
        const manage = document.createElement("div");
        manage.className = "gallery-buttons";
        const rename = document.createElement("button"), remove = document.createElement("button");
        rename.textContent = "Rename";
        remove.textContent = "Delete";
        rename.onclick = () => {
          managedArt = a;
          $("galleryTitle").value = a.title;
          $("renameDialog").showModal();
        };
        remove.onclick = () => {
          managedArt = a;
          $("deletePreview").src = a.thumbnail;
          $("deleteDialog").showModal();
        };
        manage.append(rename, remove);
        card.append(manage);
      }
      $("galleryItems").append(card);
    }
  } catch {
    if (ticket !== galleryTicket) return;
    const retry = document.createElement("button");
    retry.className = "primary";
    buttonContents(retry, "mix", "Try again");
    retry.onclick = () => gallery().catch(() => {
    });
    $("galleryItems").replaceChildren(retry);
    notify("Your pictures couldn’t open. Try again.");
  }
}
async function goLibrary() {
  try {
    await saveLocal();
    if (!ready) {
      ++loadingTicket;
      art = null;
      studioLoading(false);
    }
    ++galleryTicket;
    view("library");
    renderContinue();
  } catch {
  }
}
$("galleryTab").onclick = () => gallery().catch(() => {
});
$("libraryTab").onclick = goLibrary;
$("backLibrary").onclick = goLibrary;
function stylePiece(b, i) {
  b.style.backgroundImage = 'url("' + puzzleImage + '")';
  b.style.setProperty("--bgsize", grid.cols * 100 + "% " + grid.rows * 100 + "%");
  b.style.setProperty("--pos", i % grid.cols * 100 / (grid.cols - 1) + "% " + Math.floor(i / grid.cols) * 100 / (grid.rows - 1) + "%");
  b.style.setProperty("--ratio", grid.rows / grid.cols);
}
function updateTimer() {
  $("timer").textContent = formatTime(clock.elapsed);
  $("pauseTimer").disabled = clock.complete || !clock.running && !paused;
  const state = paused ? "play" : "pause";
  if ($("pauseTimer").dataset.state !== state) {
    buttonContents($("pauseTimer"), state, paused ? "Play" : "Pause");
    $("pauseTimer").dataset.state = state;
  }
}
function cancelDrags() {
  dragCleanups.forEach((cleanup) => cleanup());
  clearDropHighlight();
}
function clearDropHighlight() {
  document.querySelectorAll(".drop-target").forEach((b) => b.classList.remove("drop-target"));
}
function dropSlot(x, y) {
  return puzzleSlotAtPoint($("board").getBoundingClientRect(), grid, x, y);
}
function createPuzzle() {
  if (!ready) return;
  cancelDrags();
  dragCleanups = [];
  puzzleImage = canvas.toDataURL("image/png");
  grid = puzzleGrid(difficulty);
  placed = /* @__PURE__ */ new Set();
  selected = null;
  clock.reset();
  paused = false;
  puzzleReady = true;
  $("pauseOverlay").hidden = true;
  $("puzzle").classList.remove("paused");
  updateTimer();
  $("board").replaceChildren();
  $("tray").replaceChildren();
  $("board").style.gridTemplateColumns = "repeat(" + grid.cols + ",1fr)";
  $("board").style.gridTemplateRows = "repeat(" + grid.rows + ",1fr)";
  $("board").parentElement.style.setProperty("--board-min", grid.cols * 56 + (grid.cols - 1) * 2 + 12 + "px");
  $("reference").src = puzzleImage;
  $("reference").hidden = true;
  $("hint").setAttribute("aria-pressed", "false");
  $("hint").classList.remove("selected");
  for (let i = 0; i < grid.count; i++) {
    const b = document.createElement("button");
    b.className = "slot";
    b.textContent = "";
    b.setAttribute("aria-label", "Puzzle spot " + (i + 1) + ", row " + (Math.floor(i / grid.cols) + 1) + ", column " + (i % grid.cols + 1));
    b.onclick = () => place(i, b);
    $("board").append(b);
  }
  for (const i of shuffled(Array.from({ length: grid.count }, (_, i2) => i2))) {
    const b = document.createElement("button");
    b.className = "piece";
    b.dataset.piece = i;
    stylePiece(b, i);
    b.setAttribute("aria-label", "Select puzzle piece " + (i + 1));
    b.setAttribute("aria-pressed", "false");
    const choose = () => {
      if (paused || clock.complete) return;
      clock.start();
      updateTimer();
      selected = i;
      document.querySelectorAll(".piece").forEach((p) => {
        p.classList.toggle("chosen", p === b);
        p.setAttribute("aria-pressed", String(p === b));
      });
      $("puzzleStatus").textContent = "Pick a spot";
    };
    b.onclick = choose;
    dragCleanups.push(bindPuzzleDrag(b, {
      canStart: () => !paused && !clock.complete && document.body.dataset.view === "puzzle",
      select: choose,
      makeGhost: () => {
        const ghost = document.createElement("div");
        ghost.className = "piece drag-ghost";
        stylePiece(ghost, i);
        ghost.setAttribute("aria-hidden", "true");
        return ghost;
      },
      highlight: (x, y) => {
        clearDropHighlight();
        const index = dropSlot(x, y);
        if (index !== null && !placed.has(index)) $("board").children[index].classList.add("drop-target");
      },
      clearHighlight: clearDropHighlight,
      onDrop: (x, y) => {
        const index = dropSlot(x, y);
        if (index !== null) place(index, $("board").children[index]);
        else $("puzzleStatus").textContent = "Pick a spot";
      }
    }));
    $("tray").append(b);
  }
  $("puzzleStatus").textContent = "Pick a piece";
}
function place(i, b) {
  if (paused || selected === null || placed.has(i)) return;
  if (selected !== i) {
    notify("Try another spot");
    return;
  }
  const moveFocus = keyboardNavigation;
  placed.add(i);
  stylePiece(b, i);
  b.className = "slot placed";
  b.textContent = "";
  b.disabled = true;
  document.querySelector('[data-piece="' + i + '"]').remove();
  selected = null;
  if (placed.size === grid.count) {
    clock.finish();
    updateTimer();
    $("reference").hidden = true;
    $("puzzleStatus").textContent = "You did it!";
    $("completeTime").textContent = formatTime(clock.elapsed);
    $("completeDialog").showModal();
  } else {
    $("puzzleStatus").textContent = placed.size + " / " + grid.count;
    if (moveFocus) $("tray").querySelector(".piece")?.focus({ preventScroll: true });
  }
}
function pausePuzzle() {
  cancelDrags();
  if (!puzzleReady || clock.complete) return;
  const started = clock.running;
  if (started) clock.pause();
  if (started || clock.elapsed > 0) {
    paused = true;
    $("pauseOverlay").hidden = false;
    $("puzzle").classList.add("paused");
    updateTimer();
  }
}
function resumePuzzle() {
  if (!puzzleReady || clock.complete) return;
  paused = false;
  $("pauseOverlay").hidden = true;
  $("puzzle").classList.remove("paused");
  clock.start();
  updateTimer();
}
async function startPuzzle() {
  if (!ready || !art) return;
  try {
    if (!art.paint) dirty = true;
    await saveLocal();
    $("artMenu").close();
    $("puzzleSetup").showModal();
  } catch {
  }
}
for (const count of [9, 16, 24, 36]) {
  const b = document.createElement("button");
  b.className = "puzzle-size";
  b.setAttribute("aria-label", count + " piece puzzle");
  const { rows, cols } = puzzleGrid(count), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 62 62");
  svg.setAttribute("aria-hidden", "true");
  const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  frame.setAttribute("x", "1");
  frame.setAttribute("y", "1");
  frame.setAttribute("width", "60");
  frame.setAttribute("height", "60");
  frame.setAttribute("rx", "3");
  svg.append(frame);
  for (let col = 1; col < cols; col++) {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "path");
    l.setAttribute("d", "M" + (1 + col * 60 / cols) + " 1v60");
    svg.append(l);
  }
  for (let row = 1; row < rows; row++) {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "path");
    l.setAttribute("d", "M1 " + (1 + row * 60 / rows) + "h60");
    svg.append(l);
  }
  const label = document.createElement("span");
  label.textContent = count;
  b.append(svg, label);
  b.onclick = () => {
    difficulty = count;
    $("puzzleSetup").close();
    createPuzzle();
    view("puzzle");
  };
  $("puzzleSizes").append(b);
}
$("makePuzzle").onclick = startPuzzle;
$("closePuzzleSetup").onclick = () => $("puzzleSetup").close();
$("back").onclick = () => view("studio");
$("shuffle").onclick = () => {
  if (placed.size || clock.elapsed > 0) openReset("puzzle");
  else createPuzzle();
};
$("hint").onclick = () => {
  $("reference").hidden = !$("reference").hidden;
  const shown = !$("reference").hidden;
  $("hint").setAttribute("aria-pressed", String(shown));
  $("hint").classList.toggle("selected", shown);
};
$("pauseTimer").onclick = () => paused ? resumePuzzle() : pausePuzzle();
$("resume").onclick = resumePuzzle;
$("playAgain").onclick = () => {
  $("completeDialog").close();
  createPuzzle();
};
$("completeColor").onclick = () => {
  $("completeDialog").close();
  view("studio");
};
$("completeGallery").onclick = () => {
  $("completeDialog").close();
  gallery().catch(() => {
  });
};
setInterval(() => {
  if (clock.running) updateTimer();
}, 250);
setInterval(() => {
  if (profile && navigator.onLine) flush();
}, 3e4);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopDrawing();
    pausePuzzle();
    saveLocal().catch(() => {
    });
  } else if (profile) flush();
});
window.addEventListener("pagehide", () => {
  saveLocal().catch(() => {
  });
  pausePuzzle();
});
function openParent() {
  $("familyCodeArea").hidden = true;
  $("familyCode").value = "";
  $("pairCode").value = "";
  $("parentArtActions").hidden = !ready;
  $("manageGallery").disabled = !profile;
  refreshSyncDetails();
  $("upload").disabled = !profile;
  $("importArt").disabled = !profile;
  $("parentDialog").showModal();
}
$("parentBtn").onclick = openParent;
$("studioParent").onclick = () => {
  $("artMenu").close();
  openParent();
};
$("closeParent").onclick = () => $("parentDialog").close();
$("showCode").onclick = async () => {
  if (!family) return;
  const button = $("showCode");
  button.disabled = true;
  try {
    $("familyCode").value = await ensureFamilyPassphrase();
    $("familyCodeArea").hidden = false;
  } catch {
    notify("Connect to the internet to get your family phrase.");
  } finally {
    button.disabled = false;
  }
};
$("copyCode").onclick = async () => {
  try {
    const phrase = familyPassphrase || await ensureFamilyPassphrase();
    await navigator.clipboard.writeText(phrase);
    notify("Family phrase copied");
  } catch {
    $("familyCode").select();
    notify("Select and copy your family phrase.");
  }
};
$("pair").onclick = async () => {
  const b = $("pair");
  b.disabled = true;
  $("pairStatus").textContent = "Connecting…";
  try {
    await saveLocal();
    await flush();
    await pairFamily($("pairCode").value);
    ++loadingTicket;
    ++galleryTicket;
    pausePuzzle();
    art = null;
    ready = false;
    puzzleReady = false;
    profile = "";
    $("welcome").hidden = false;
    $("app").hidden = true;
    $("switchBtn").hidden = true;
    document.body.dataset.view = "welcome";
    $("parentDialog").close();
    focusView("welcome");
    notify("Connected. Pick your name.");
  } catch (e) {
    $("pairStatus").textContent = e.message || "Couldn’t connect. Check the three words and internet connection.";
  } finally {
    b.disabled = false;
  }
};
async function boot() {
  try {
    await initFamily(syncStatus, (oldId, fork, deleted) => {
      if (art?.id === oldId && art.family === fork.family) {
        if (deleted) {
          ready = false;
          art = null;
          dirty = false;
          view("library");
          notify("This picture was deleted on another device.");
          return;
        }
        art = { ...art, id: fork.id, key: fork.key, etag: null, title: fork.title };
        $("artTitle").value = fork.title;
      }
      notify("Both versions are saved.");
    });
    renderLibrary();
    flush();
    profileButtons.forEach((b) => b.disabled = false);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {
      });
      navigator.storage?.persist?.().catch(() => {
      });
    }
  } catch {
    syncStatus("Local storage unavailable");
    notify("Can’t save here. Ask a grown-up.");
    profileButtons.forEach((b) => b.disabled = true);
  }
}
boot();
let managedArt = null;
$("manageGallery").onclick = () => {
  galleryManaging = true;
  $("parentDialog").close();
  gallery().catch(() => {
  });
};
$("closeRename").onclick = () => $("renameDialog").close();
$("saveRename").onclick = async () => {
  const chosen = managedArt;
  if (!chosen) return;
  const b = $("saveRename");
  b.disabled = true;
  try {
    const current = chosen.remote ? await loadRemote(chosen.profile, chosen.id, chosen.family) : await getArt(chosen.key);
    if (!current || current.deleted) throw new Error();
    await putArt({ ...current, title: $("galleryTitle").value.trim() || "My picture", updatedAt: Date.now(), revision: crypto.randomUUID(), pending: true });
    $("renameDialog").close();
    await gallery();
    flush();
  } catch {
    notify("Couldn’t rename. Try again.");
  } finally {
    b.disabled = false;
  }
};
$("cancelDelete").onclick = () => $("deleteDialog").close();
$("confirmDelete").onclick = async () => {
  const chosen = managedArt;
  if (!chosen) return;
  const b = $("confirmDelete");
  b.disabled = true;
  try {
    const current = chosen.remote ? await loadRemote(chosen.profile, chosen.id, chosen.family) : await getArt(chosen.key);
    await deleteArt(current || chosen);
    if (art?.id === chosen.id) {
      art = null;
      ready = false;
      dirty = false;
    }
    $("deleteDialog").close();
    await gallery();
    flush();
  } catch {
    notify("Couldn’t delete. Try again.");
  } finally {
    b.disabled = false;
  }
};
$("finishManaging").onclick = () => {
  galleryManaging = false;
  gallery().catch(() => {
  });
};
async function refreshSyncDetails() {
  const problems = await syncProblems();
  $("syncDetails").replaceChildren();
  for (const a of problems.slice(0, 10)) {
    const p = document.createElement("p");
    p.textContent = a.title + ": " + a.syncError;
    $("syncDetails").append(p);
  }
  const previous = await previousFamilyPhrase();
  $("previousFamilyArea").hidden = !previous;
  $("previousFamilyPhrase").textContent = previous;
}
$("retrySync").onclick = async () => {
  const b = $("retrySync");
  b.disabled = true;
  try {
    await saveLocal();
    await retrySync();
    await refreshSyncDetails();
  } finally {
    b.disabled = false;
  }
};
