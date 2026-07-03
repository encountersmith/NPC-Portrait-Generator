const config = window.APP_CONFIG;
const screens = {
  splash: document.getElementById("splash"),
  gallery: document.getElementById("gallery"),
  editor: document.getElementById("editor"),
};
const canvas = document.getElementById("portraitCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const portraitGrid = document.getElementById("portraitGrid");
const colourControls = document.getElementById("colourControls");
const editorTitle = document.getElementById("editorTitle");
const editorSubtitle = document.getElementById("editorSubtitle");
const characterNameInput = document.getElementById("characterNameInput");

let currentSetId = null;
let loaded = {};
let controls = {};
let galleryPreviewColours = {};
let galleryCardMap = {};

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[name].classList.add("active");

  if (name === "gallery") {
    refreshGalleryPreviews();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function loadSet(setId) {
  if (loaded[setId]) return loaded[setId];
  const set = config.sets[setId];
  const images = {};
  for (const [layer, src] of Object.entries(set.layers)) {
    images[layer] = await loadImage(src);
  }
  images.lineOverlay = await loadImage(set.lineOverlay);
  loaded[setId] = images;
  return images;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = n => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function randomHex() {
  const h = Math.floor(Math.random() * 360);
  const s = 45 + Math.random() * 50;
  const l = 28 + Math.random() * 48;
  return hslToHex(h, s, l);
}

function makeTintedLayer(img, colour) {
  const off = document.createElement("canvas");
  off.width = img.width;
  off.height = img.height;
  const octx = off.getContext("2d");

  // This avoids getImageData(), which can fail when testing the app from local files.
  // The image is drawn, multiplied by the chosen colour to preserve shading,
  // then clipped back to the original layer alpha.
  octx.drawImage(img, 0, 0);

  octx.globalCompositeOperation = "multiply";
  octx.fillStyle = colour;
  octx.fillRect(0, 0, off.width, off.height);

  octx.globalCompositeOperation = "destination-in";
  octx.drawImage(img, 0, 0);

  octx.globalCompositeOperation = "source-over";
  return off;
}

function renderToContext(targetCtx) {
  const set = config.sets[currentSetId];
  const images = loaded[currentSetId];

  targetCtx.clearRect(0, 0, canvas.width, canvas.height);

  for (const layer of set.drawOrder) {
    const image = images[layer];
    if (!image || !controls[layer]) continue;
    const rendered = makeTintedLayer(image, controls[layer].value);
    const pos = set.positions[layer];
    targetCtx.drawImage(rendered, pos.x, pos.y);
  }

  if (images.lineOverlay) {
    targetCtx.drawImage(images.lineOverlay, 0, 0);
  }
}

function draw() {
  renderToContext(ctx);
}

function makePresetButton(name, colour, input) {
  const button = document.createElement("button");
  button.className = "preset";
  button.type = "button";
  button.innerHTML = `<span class="swatch" style="background:${colour}"></span>${name}`;
  button.addEventListener("click", () => {
    input.value = colour;
    draw();
  });
  return button;
}

function buildControls() {
  const set = config.sets[currentSetId];
  colourControls.innerHTML = "";
  controls = {};

  for (const layer of set.controlOrder) {
    const group = config.layerPresetGroup[layer] || "clothing";
    const presets = config.presets[group] || config.presets.clothing;

    const block = document.createElement("div");
    block.className = "control-block";

    const headerButton = document.createElement("button");
    headerButton.className = "control-toggle";
    headerButton.type = "button";
    headerButton.setAttribute("aria-expanded", "true");

    const title = document.createElement("span");
    title.className = "control-title";
    title.textContent = config.layerLabels[layer] || layer;

    const toggleIcon = document.createElement("span");
    toggleIcon.className = "control-toggle-icon";
    toggleIcon.textContent = "−";

    headerButton.appendChild(title);
    headerButton.appendChild(toggleIcon);

    const sectionBody = document.createElement("div");
    sectionBody.className = "control-section-body";

    headerButton.addEventListener("click", () => {
      const isCollapsed = block.classList.toggle("collapsed");
      headerButton.setAttribute("aria-expanded", String(!isCollapsed));
      toggleIcon.textContent = isCollapsed ? "+" : "−";
    });

    const input = document.createElement("input");
    input.type = "color";
    input.value = config.defaults[layer] || "#ffffff";
    input.addEventListener("input", draw);

    const presetGrid = document.createElement("div");
    presetGrid.className = "preset-grid";

    presets.forEach(([name, value]) => {
      const button = document.createElement("button");
      button.className = "preset";
      button.type = "button";
      button.innerHTML = `<span class="swatch" style="background:${value}"></span>${name}`;
      button.addEventListener("click", () => {
        input.value = value;
        draw();
      });
      presetGrid.appendChild(button);
    });

    const customWrap = document.createElement("label");
    customWrap.className = "custom-colour-row";
    customWrap.appendChild(input);

    sectionBody.appendChild(presetGrid);
    sectionBody.appendChild(customWrap);

    block.appendChild(headerButton);
    block.appendChild(sectionBody);
    colourControls.appendChild(block);
    controls[layer] = input;
  }
}

function resetColours() {
  const set = config.sets[currentSetId];
  for (const layer of set.controlOrder) {
    controls[layer].value = config.defaults[layer] || "#ffffff";
  }
  draw();
}

function randomColours() {
  const set = config.sets[currentSetId];
  for (const layer of set.controlOrder) {
    const group = config.layerPresetGroup[layer] || "clothing";
    const presets = config.presets[group] || config.presets.clothing;
    controls[layer].value = presets[Math.floor(Math.random() * presets.length)][1];
  }
  draw();
}

function ultraRandomColours() {
  const set = config.sets[currentSetId];
  for (const layer of set.controlOrder) {
    controls[layer].value = randomHex();
  }
  draw();
}

function getRandomPresetColour(layer) {
  const group = config.layerPresetGroup[layer] || "clothing";
  const presets = config.presets[group] || config.presets.clothing;
  return presets[Math.floor(Math.random() * presets.length)][1];
}

function getPreviewPresetColour(layer) {
  const group = config.layerPresetGroup[layer] || "clothing";
  const presets = config.presets[group] || config.presets.clothing;
  const bannedWords = ["purple", "red", "green", "blue"];

  const filtered = presets.filter(([name]) => {
    const lower = String(name).toLowerCase();
    return !bannedWords.some(word => lower.includes(word));
  });

  const source = filtered.length ? filtered : presets;
  return source[Math.floor(Math.random() * source.length)][1];
}

function createRandomPreviewState(setId) {
  const set = config.sets[setId];
  const state = {};
  for (const layer of set.controlOrder) {
    state[layer] = getPreviewPresetColour(layer);
  }
  return state;
}

function applyColourState(colourState) {
  const set = config.sets[currentSetId];
  for (const layer of set.controlOrder) {
    controls[layer].value = (colourState && colourState[layer]) || config.defaults[layer] || "#ffffff";
  }
  draw();
}

function renderPreviewToCanvas(setId, colourState, previewCanvas) {
  const set = config.sets[setId];
  const images = loaded[setId];
  const previewCtx = previewCanvas.getContext("2d");

  previewCanvas.width = set.canvas.width;
  previewCanvas.height = set.canvas.height;
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  for (const layer of set.drawOrder) {
    const image = images[layer];
    if (!image) continue;
    const colour = (colourState && colourState[layer]) || config.defaults[layer] || "#ffffff";
    const rendered = makeTintedLayer(image, colour);
    const pos = set.positions[layer];
    previewCtx.drawImage(rendered, pos.x, pos.y);
  }

  if (images.lineOverlay) {
    previewCtx.drawImage(images.lineOverlay, 0, 0);
  }
}

async function refreshGalleryPreviews() {
  for (const set of Object.values(config.sets)) {
    const card = galleryCardMap[set.id];
    if (!card) continue;

    try {
      card.button.classList.add("loading-preview");
      await loadSet(set.id);
      const state = createRandomPreviewState(set.id);
      galleryPreviewColours[set.id] = state;
      renderPreviewToCanvas(set.id, state, card.canvas);
      card.button.classList.remove("loading-preview");
    } catch (error) {
      console.error(error);
      card.button.classList.remove("loading-preview");
    }
  }
}

async function openEditor(setId, initialColours = null) {
  currentSetId = setId;
  const set = config.sets[setId];

  editorTitle.textContent = set.label;
  editorSubtitle.textContent = "";
  characterNameInput.value = "";

  showScreen("editor");

  try {
    await loadSet(setId);
    buildControls();
    applyColourState(initialColours || galleryPreviewColours[setId] || null);
  } catch (error) {
    console.error(error);
    colourControls.innerHTML = `
      <div class="control-block">
        <h3>Image failed to load</h3>
        <p style="color: var(--muted); line-height: 1.4;">
          Make sure the whole folder was extracted before opening index.html.
          For best results, run it through a local server or host it online.
        </p>
      </div>
    `;
  }
}

async function downloadPng() {
  if (!currentSetId || !loaded[currentSetId]) return;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  renderToContext(exportCtx);

  const setLabel = config.sets[currentSetId].label;
  const enteredName = (characterNameInput && characterNameInput.value ? characterNameInput.value : "").trim();
  const characterName = enteredName || "Unnamed Character";

  // Keep the exact readable format: [character name] - Dwarf Knight.png
  const cleanPart = value => value
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const safeCharacterName = cleanPart(characterName) || "Unnamed Character";
  const safeSetLabel = cleanPart(setLabel) || "Dwarf Portrait";
  const filename = `${safeCharacterName} - ${safeSetLabel}.png`;

  try {
    const blob = await new Promise((resolve, reject) => {
      exportCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas export returned no image."));
      }, "image/png");
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error(error);

    // Fallback for older browsers.
    const link = document.createElement("a");
    link.download = filename;
    link.href = exportCanvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

function buildGallery() {
  portraitGrid.innerHTML = "";
  galleryCardMap = {};

  for (const set of Object.values(config.sets)) {
    const button = document.createElement("button");
    button.className = "portrait-card loading-preview";
    button.type = "button";
    button.innerHTML = `
      <div class="portrait-preview-wrap">
        <canvas class="portrait-preview" width="1254" height="1254" aria-label="${set.label} preview"></canvas>
      </div>
      <div class="portrait-card-content">
        <div class="card-title-row">
          <h2>${set.label}</h2>
          <span class="mini-rune">✦</span>
        </div>
      </div>
    `;

    const previewCanvas = button.querySelector(".portrait-preview");
    galleryCardMap[set.id] = { button, canvas: previewCanvas };

    button.addEventListener("click", () => {
      const chosenState = galleryPreviewColours[set.id] ? { ...galleryPreviewColours[set.id] } : null;
      openEditor(set.id, chosenState);
    });

    portraitGrid.appendChild(button);
  }
}

document.getElementById("startButton").addEventListener("click", () => showScreen("gallery"));
document.getElementById("backButton").addEventListener("click", () => showScreen("gallery"));
document.getElementById("resetButton").addEventListener("click", resetColours);
document.getElementById("randomButton").addEventListener("click", randomColours);
document.getElementById("ultraRandomButton").addEventListener("click", ultraRandomColours);
document.getElementById("downloadButton").addEventListener("click", downloadPng);

buildGallery();

if (screens.gallery.classList.contains("active")) {
  refreshGalleryPreviews();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
