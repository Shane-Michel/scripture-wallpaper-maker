const PIXABAY_KEY = "53480329-e7a753209abe9055845aed7e2";
const canvas = document.getElementById("wallpaperCanvas");
const ctx = canvas.getContext("2d");

const state = {
  layers: [],
  overlay: { enabled: true, color: "#000000", opacity: 0.45 },
  border: { enabled: true, color: "#ffdd55", width: 14, inset: 18 },
  background: { img: null, url: null },
};

let activeLayerId = null;
let dragState = null;

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function wrapLines(text, maxWidth, font) {
  ctx.save();
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

function createTextLayer({ text, name, fontSize, align, color, x, y, width, type }) {
  return {
    id: uid(),
    type: type || "text",
    name: name || "Text",
    text: text || "New text",
    fontSize: fontSize || 38,
    fontFamily: "Segoe UI",
    fontWeight: "700",
    color: color || "#ffdd55",
    align: align || "center",
    boxWidth: width || canvas.width - 200,
    x: x || 80,
    y: y || 260,
    opacity: 1
  };
}

function createLogoLayer(img) {
  const baseWidth = 220;
  const ratio = img.height ? img.width / img.height : 1;
  return {
    id: uid(),
    type: "logo",
    name: "Logo",
    image: img,
    width: baseWidth,
    height: baseWidth / ratio,
    ratio,
    x: canvas.width - baseWidth - 60,
    y: canvas.height - baseWidth / ratio - 80,
    opacity: 0.9
  };
}

async function fetchVerse(reference) {
  const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
  if (!res.ok) throw new Error("Verse not found");
  return res.json();
}

async function fetchBackground() {
  const url = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=nature+landscape+light&image_type=photo&orientation=vertical&per_page=50`;
  const res = await fetch(url);
  const data = await res.json();
  const hits = data.hits || [];
  if (!hits.length) throw new Error("No images found");
  return hits[Math.floor(Math.random() * hits.length)].largeImageURL;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function getReferenceFromKeyword(keyword) {
  keyword = keyword.toLowerCase();
  if (!keywordMap[keyword]) return null;
  const arr = keywordMap[keyword];
  return arr[Math.floor(Math.random() * arr.length)];
}

function drawBackground() {
  if (state.background.img) {
    const img = state.background.img;
    const ratio = Math.max(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  } else {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#1b2635");
    grad.addColorStop(1, "#0e141c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawOverlay() {
  if (!state.overlay.enabled) return;
  ctx.fillStyle = hexToRgba(state.overlay.color, state.overlay.opacity);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function measureTextLayer(layer) {
  const font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
  const lines = wrapLines(layer.text || " ", layer.boxWidth, font);
  const lineHeight = Math.round(layer.fontSize * 1.35);
  return { lines, lineHeight, height: Math.max(lineHeight, lines.length * lineHeight) };
}

function drawTextLayer(layer) {
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.fillStyle = layer.color;
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 10;
  const font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
  const { lines, lineHeight, height } = measureTextLayer(layer);
  ctx.font = font;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "top";

  const anchorX = layer.align === "center"
    ? layer.x + layer.boxWidth / 2
    : layer.align === "right"
    ? layer.x + layer.boxWidth
    : layer.x;

  lines.forEach((line, i) => ctx.fillText(line, anchorX, layer.y + i * lineHeight));

  ctx.restore();
  layer.bounds = { x: layer.x, y: layer.y, width: layer.boxWidth, height };
}

function drawLogoLayer(layer) {
  if (!layer.image) return;
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  ctx.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height);
  ctx.restore();
  layer.bounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
}

function drawBorder() {
  if (!state.border.enabled || state.border.width <= 0) return;
  ctx.save();
  ctx.strokeStyle = state.border.color;
  ctx.lineWidth = state.border.width;
  const offset = state.border.inset;
  ctx.strokeRect(
    offset,
    offset,
    canvas.width - offset * 2,
    canvas.height - offset * 2
  );
  ctx.restore();
}

function drawSelection(layer) {
  if (!layer?.bounds) return;
  const { x, y, width, height } = layer.bounds;
  ctx.save();
  ctx.strokeStyle = "#7cd0ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
  const size = 12;
  ctx.fillStyle = "#7cd0ff";
  ctx.strokeStyle = "#0d1117";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x + width - size / 2, y + height - size / 2, size, size);
  ctx.strokeRect(x + width - size / 2, y + height - size / 2, size, size);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawOverlay();

  state.layers.forEach(layer => {
    if (layer.type === "logo") {
      drawLogoLayer(layer);
    } else {
      drawTextLayer(layer);
    }
  });

  drawBorder();
  const active = state.layers.find(l => l.id === activeLayerId);
  drawSelection(active);
}

function hitTestHandles(bounds, x, y) {
  if (!bounds) return null;
  const handleX = bounds.x + bounds.width;
  const handleY = bounds.y + bounds.height;
  const distance = Math.hypot(x - handleX, y - handleY);
  if (distance < 16) return "se";
  return null;
}

function pickLayer(x, y) {
  for (let i = state.layers.length - 1; i >= 0; i--) {
    const layer = state.layers[i];
    const b = layer.bounds;
    if (!b) continue;
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      const handle = hitTestHandles(b, x, y);
      return { layer, handle };
    }
  }
  return null;
}

function canvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY,
  };
}

function startDrag(evt) {
  const { x, y } = canvasPoint(evt);
  const hit = pickLayer(x, y);
  if (!hit) return;

  activeLayerId = hit.layer.id;
  updateLayerList();
  renderInspector();

  dragState = {
    mode: hit.handle ? "resize" : "move",
    startX: x,
    startY: y,
    layerStart: { ...hit.layer }
  };
  canvas.setPointerCapture(evt.pointerId);
}

function onDrag(evt) {
  if (!dragState) return;
  const { x, y } = canvasPoint(evt);
  const dx = x - dragState.startX;
  const dy = y - dragState.startY;
  const layer = state.layers.find(l => l.id === activeLayerId);
  if (!layer) return;

  if (dragState.mode === "move") {
    layer.x = clamp(dragState.layerStart.x + dx, 10, canvas.width - 40);
    layer.y = clamp(dragState.layerStart.y + dy, 10, canvas.height - 40);
  } else if (dragState.mode === "resize") {
    if (layer.type === "logo") {
      const newWidth = clamp(dragState.layerStart.width + dx, 60, canvas.width - layer.x - 10);
      layer.width = newWidth;
      layer.height = newWidth / layer.ratio;
    } else {
      const scale = clamp((dragState.layerStart.boxWidth + dx) / dragState.layerStart.boxWidth, 0.35, 3);
      layer.boxWidth = clamp(dragState.layerStart.boxWidth * scale, 120, canvas.width - 80);
      layer.fontSize = clamp(Math.round(dragState.layerStart.fontSize * scale), 14, 110);
    }
  }
  render();
  renderInspector();
}

function endDrag(evt) {
  if (dragState) {
    canvas.releasePointerCapture(evt.pointerId);
  }
  dragState = null;
}

async function generateWallpaper() {
  const input = document.getElementById("reference").value.trim();
  const align = document.getElementById("align").value;
  const baseFont = parseInt(document.getElementById("fontSize").value, 10);
  if (!input) return alert("Enter a verse or keyword.");

  let reference = input;
  if (!input.includes(":") && input.split(" ").length === 1) {
    const match = await getReferenceFromKeyword(input);
    if (!match) return alert("No verses found for this keyword.");
    reference = match;
  }

  let verseData;
  try {
    verseData = await fetchVerse(reference);
  } catch (err) {
    return alert("Verse not found.");
  }

  let bgUrl;
  try {
    bgUrl = await fetchBackground();
    state.background.img = await loadImage(bgUrl);
    state.background.url = bgUrl;
  } catch (err) {
    console.warn("Background fetch failed", err);
  }

  const verseText = (verseData.text || "").trim();
  const verseRef = verseData.reference || reference;

  // Reset layers and add verse + reference
  state.layers = [];
  const mainText = createTextLayer({
    name: "Verse",
    text: verseText,
    fontSize: baseFont,
    align,
    x: 90,
    y: 320,
    width: canvas.width - 180
  });
  const refText = createTextLayer({
    name: "Reference",
    text: verseRef,
    fontSize: 28,
    align: "center",
    color: "#ffffff",
    x: canvas.width / 2 - 200,
    y: canvas.height - 200,
    width: 400
  });

  state.layers.push(mainText, refText);
  activeLayerId = mainText.id;
  updateLayerList();
  renderInspector();
  render();
}

function addTextBlock() {
  const layer = createTextLayer({
    name: "Text Block",
    text: "New text block",
    fontSize: 34,
    align: "left",
    x: 80,
    y: 180,
    width: canvas.width - 160
  });
  state.layers.push(layer);
  activeLayerId = layer.id;
  updateLayerList();
  renderInspector();
  render();
}

function addSubtitle() {
  const layer = createTextLayer({
    name: "Subtitle",
    text: "Reflection or prayer...",
    fontSize: 22,
    align: "left",
    color: "#e2e8f0",
    x: 80,
    y: canvas.height - 300,
    width: canvas.width - 160,
    type: "subtitle"
  });
  layer.fontWeight = "600";
  state.layers.push(layer);
  activeLayerId = layer.id;
  updateLayerList();
  renderInspector();
  render();
}

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const img = new Image();
    img.onload = () => {
      const layer = createLogoLayer(img);
      state.layers.push(layer);
      activeLayerId = layer.id;
      updateLayerList();
      renderInspector();
      render();
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function updateLayerList() {
  const list = document.getElementById("layerList");
  if (!state.layers.length) {
    list.innerHTML = '<div class="muted">No layers yet. Generate a verse or add text.</div>';
    return;
  }
  list.innerHTML = "";
  const labels = { text: "Text", subtitle: "Subtitle", logo: "Logo" };

  state.layers.forEach(layer => {
    const btn = document.createElement("div");
    btn.className = "layer-item" + (layer.id === activeLayerId ? " active" : "");
    btn.innerHTML = `<div>${layer.name}</div><small>${labels[layer.type] || "Layer"}</small>`;
    btn.onclick = () => {
      activeLayerId = layer.id;
      renderInspector();
      render();
      updateLayerList();
    };
    list.appendChild(btn);
  });
}

function renderInspector() {
  const inspector = document.getElementById("layerInspector");
  const layer = state.layers.find(l => l.id === activeLayerId);
  if (!layer) {
    inspector.innerHTML = '<div class="muted">Select a layer to edit its properties.</div>';
    return;
  }

  if (layer.type === "logo") {
    inspector.innerHTML = `
      <label>Opacity <input type="range" id="logoOpacity" min="0.1" max="1" step="0.05" value="${layer.opacity}" /></label>
      <button class="secondary small-btn" id="deleteLayer">Delete Logo</button>
    `;
    document.getElementById("logoOpacity").oninput = e => {
      layer.opacity = parseFloat(e.target.value);
      render();
    };
  } else {
    inspector.innerHTML = `
      <label>Text</label>
      <textarea id="layerText">${layer.text}</textarea>
      <label>Font Size <input type="range" id="layerFontSize" min="14" max="110" step="1" value="${layer.fontSize}" /></label>
      <label>Box Width <input type="range" id="layerWidth" min="140" max="${canvas.width - 60}" step="10" value="${layer.boxWidth}" /></label>
      <div class="row">
        <div><label>Color</label><input type="color" id="layerColor" value="${layer.color}"></div>
        <div>
          <label>Align</label>
          <select id="layerAlign">
            <option value="left" ${layer.align === "left" ? "selected" : ""}>Left</option>
            <option value="center" ${layer.align === "center" ? "selected" : ""}>Center</option>
            <option value="right" ${layer.align === "right" ? "selected" : ""}>Right</option>
          </select>
        </div>
      </div>
      <label>Opacity <input type="range" id="layerOpacity" min="0.2" max="1" step="0.05" value="${layer.opacity}" /></label>
      <div class="stack">
        <button class="secondary" id="deleteLayer">Delete</button>
      </div>
    `;

    document.getElementById("layerText").oninput = e => {
      layer.text = e.target.value;
      render();
    };
    document.getElementById("layerFontSize").oninput = e => {
      layer.fontSize = parseInt(e.target.value, 10);
      render();
    };
    document.getElementById("layerWidth").oninput = e => {
      layer.boxWidth = parseInt(e.target.value, 10);
      render();
    };
    document.getElementById("layerColor").oninput = e => {
      layer.color = e.target.value;
      render();
    };
    document.getElementById("layerAlign").onchange = e => {
      layer.align = e.target.value;
      render();
    };
    document.getElementById("layerOpacity").oninput = e => {
      layer.opacity = parseFloat(e.target.value);
      render();
    };
  }

  const deleteBtn = document.getElementById("deleteLayer");
  if (deleteBtn) {
    deleteBtn.onclick = () => {
      state.layers = state.layers.filter(l => l.id !== layer.id);
      activeLayerId = state.layers[state.layers.length - 1]?.id || null;
      updateLayerList();
      renderInspector();
      render();
    };
  }
}

function applyOverlaySettings() {
  state.overlay.enabled = document.getElementById("overlayToggle").checked;
  state.overlay.color = document.getElementById("overlayColor").value;
  state.overlay.opacity = parseFloat(document.getElementById("overlayOpacity").value);
  state.border.enabled = document.getElementById("borderToggle").checked;
  state.border.color = document.getElementById("borderColor").value;
  state.border.width = parseInt(document.getElementById("borderWidth").value, 10);
  render();
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = "scripture-wallpaper.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.getElementById("generateBtn").onclick = generateWallpaper;
document.getElementById("backgroundBtn").onclick = async () => {
  try {
    const bgUrl = await fetchBackground();
    state.background.img = await loadImage(bgUrl);
    state.background.url = bgUrl;
    render();
  } catch (err) {
    alert("Could not load a new background right now.");
  }
};
document.getElementById("downloadBtn").onclick = downloadImage;
document.getElementById("addTextBtn").onclick = addTextBlock;
document.getElementById("addSubtitleBtn").onclick = addSubtitle;
document.getElementById("addLogoBtn").onclick = () => document.getElementById("logoInput").click();
document.getElementById("logoInput").onchange = handleLogoUpload;

["overlayColor", "overlayOpacity", "borderColor", "borderWidth", "overlayToggle", "borderToggle"].forEach(id => {
  document.getElementById(id).addEventListener("input", applyOverlaySettings);
  document.getElementById(id).addEventListener("change", applyOverlaySettings);
});

canvas.addEventListener("pointerdown", startDrag);
canvas.addEventListener("pointermove", onDrag);
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointerleave", endDrag);

// Initial render
updateLayerList();
render();
