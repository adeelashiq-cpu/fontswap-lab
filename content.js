const GOOGLE_FONTS = new Set([
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Nunito", "Manrope", "DM Sans", "Work Sans", "Source Sans 3",
  "Raleway", "Merriweather", "Playfair Display", "Oswald", "Rubik",
  "Ubuntu", "Fira Sans", "Mulish", "Karla", "Libre Franklin",
  "Bebas Neue", "Space Grotesk", "Plus Jakarta Sans", "Outfit",
  "Urbanist", "Archivo", "Barlow", "Cabin", "PT Sans", "PT Serif"
]);

const originalFontByElement = new WeakMap();
const originalInlineByElement = new Map();
const activeSwaps = new Map();

let rememberEnabled = false;
let inspector = null;
let inspectorTarget = null;

function cleanFontName(fontFamily) {
  if (!fontFamily) return "";
  const first = fontFamily.split(",")[0].trim();
  return first.replace(/^["']|["']$/g, "");
}

function isUsefulTextElement(element) {
  if (!(element instanceof HTMLElement)) return false;

  const tag = element.tagName;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "META", "LINK"].includes(tag)) return false;
  if (inspector?.host && (element === inspector.host || inspector.host.contains(element))) return false;

  const text = element.innerText?.trim();
  if (!text) return false;

  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;

  return true;
}

function getOriginalFont(element) {
  if (!originalFontByElement.has(element)) {
    originalFontByElement.set(element, cleanFontName(getComputedStyle(element).fontFamily));
  }
  return originalFontByElement.get(element);
}

function scanFonts() {
  const counts = new Map();

  for (const element of document.querySelectorAll("body *")) {
    if (!isUsefulTextElement(element)) continue;
    const font = getOriginalFont(element);
    if (!font) continue;
    counts.set(font, (counts.get(font) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([font, count]) => ({ font, count }))
    .sort((a, b) => b.count - a.count || a.font.localeCompare(b.font));
}

function googleFontHref(family) {
  const name = family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}:wght@400;700&display=swap`;
}

function ensureGoogleFontLoaded(font) {
  if (!GOOGLE_FONTS.has(font)) return;

  const id = `fontswap-google-${font.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = googleFontHref(font);
  link.dataset.fontswap = "true";
  document.head.appendChild(link);
}

function rememberOriginalInline(element) {
  if (originalInlineByElement.has(element)) return;
  originalInlineByElement.set(element, {
    value: element.style.getPropertyValue("font-family"),
    priority: element.style.getPropertyPriority("font-family")
  });
}

function applyFontToElement(element, replacementFont) {
  rememberOriginalInline(element);
  ensureGoogleFontLoaded(replacementFont);
  element.style.setProperty("font-family", `"${replacementFont}"`, "important");
}

function swapFont(sourceFont, replacementFont, shouldPersist = true) {
  let changed = 0;

  for (const element of document.querySelectorAll("body *")) {
    if (!(element instanceof HTMLElement)) continue;
    const originalFont = getOriginalFont(element);
    if (originalFont !== sourceFont) continue;
    applyFontToElement(element, replacementFont);
    changed++;
  }

  activeSwaps.set(sourceFont, replacementFont);

  if (shouldPersist) persistState();
  return changed;
}

function swapSingleElement(element, replacementFont) {
  if (!(element instanceof HTMLElement)) return false;
  applyFontToElement(element, replacementFont);
  return true;
}

function resetFonts() {
  let restored = 0;

  for (const [element, original] of originalInlineByElement.entries()) {
    if (!element.isConnected) continue;

    if (original.value) {
      element.style.setProperty("font-family", original.value, original.priority || "");
    } else {
      element.style.removeProperty("font-family");
    }
    restored++;
  }

  originalInlineByElement.clear();
  activeSwaps.clear();

  document.querySelectorAll('link[data-fontswap="true"]').forEach(link => link.remove());

  persistState();
  return restored;
}

function storageKey() {
  return `fontswap:${location.hostname}`;
}

async function persistState() {
  const key = storageKey();

  if (!rememberEnabled) {
    await chrome.storage.local.remove(key);
    return;
  }

  await chrome.storage.local.set({
    [key]: {
      remember: true,
      swaps: Object.fromEntries(activeSwaps)
    }
  });
}

async function loadSavedState() {
  const key = storageKey();
  const stored = await chrome.storage.local.get(key);
  const state = stored[key];

  if (!state?.remember) return;

  rememberEnabled = true;
  for (const [sourceFont, replacementFont] of Object.entries(state.swaps || {})) {
    swapFont(sourceFont, replacementFont, false);
  }
}

async function setRemember(enabled) {
  rememberEnabled = Boolean(enabled);
  await persistState();
}

function makeInspector() {
  if (inspector) return inspector;

  const host = document.createElement("div");
  host.id = "fontswap-inspector-root";
  host.style.position = "fixed";
  host.style.zIndex = "2147483647";
  host.style.inset = "0 auto auto 0";
  host.style.pointerEvents = "none";

  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .tooltip {
        position: fixed;
        display: none;
        min-width: 210px;
        max-width: 290px;
        padding: 9px 10px;
        border-radius: 9px;
        background: #111318;
        color: white;
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        pointer-events: none;
      }
      .tooltip strong { display: block; margin-bottom: 2px; font-size: 12px; }
      .tooltip span { color: #c9cdd5; }
      .panel {
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: 300px;
        padding: 14px;
        border-radius: 14px;
        background: #fff;
        color: #14161a;
        font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 18px 50px rgba(0,0,0,.28);
        border: 1px solid #dfe3e8;
        pointer-events: auto;
      }
      .head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
      h3 { margin:0; font-size:14px; }
      .muted { color:#6f7480; font-size:10px; margin-top:2px; }
      .close {
        border:0; width:28px; height:28px; border-radius:8px; cursor:pointer;
        background:#f0f1f3; color:#111318; font-weight:800;
      }
      .info {
        margin: 12px 0;
        display:grid;
        grid-template-columns: 86px 1fr;
        gap: 6px 8px;
        padding: 10px;
        border-radius: 10px;
        background:#f6f7f9;
      }
      .info b { color:#6f7480; font-size:10px; text-transform:uppercase; }
      .info span { overflow-wrap:anywhere; }
      select {
        width:100%;
        padding:9px 10px;
        border:1px solid #dfe2e8;
        border-radius:9px;
        background:#fff;
        font:inherit;
      }
      .buttons { display:flex; gap:8px; margin-top:8px; }
      button.action {
        flex:1;
        border:0;
        border-radius:9px;
        padding:9px 10px;
        cursor:pointer;
        font:700 12px system-ui;
      }
      .dark { background:#111318; color:#fff; }
      .light { background:#eef0f3; color:#111318; }
      .hint { margin-top:10px; font-size:10px; color:#7a808b; }
    </style>

    <div class="tooltip" id="tooltip"></div>

    <div class="panel">
      <div class="head">
        <div>
          <h3>Font Inspector</h3>
          <div class="muted">Hover text, then click to lock selection.</div>
        </div>
        <button class="close" id="closeBtn" title="Close inspector">×</button>
      </div>

      <div class="info">
        <b>Font</b><span id="fontValue">Hover text…</span>
        <b>Size</b><span id="sizeValue">—</span>
        <b>Weight</b><span id="weightValue">—</span>
        <b>Line height</b><span id="lineValue">—</span>
        <b>Color</b><span id="colorValue">—</span>
      </div>

      <select id="replacementSelect"></select>

      <div class="buttons">
        <button class="action dark" id="swapElementBtn">Swap selected</button>
        <button class="action light" id="unlockBtn">Unlock</button>
      </div>

      <div class="hint">The selected element is outlined. Refresh the page to remove temporary element-only swaps.</div>
    </div>
  `;

  document.documentElement.appendChild(host);

  const fonts = [
    "system-ui", "Arial", "Helvetica", "Verdana", "Georgia",
    ...GOOGLE_FONTS
  ];

  const select = shadow.getElementById("replacementSelect");
  for (const font of fonts) {
    const option = document.createElement("option");
    option.value = font;
    option.textContent = font;
    select.appendChild(option);
  }

  const api = {
    host,
    shadow,
    tooltip: shadow.getElementById("tooltip"),
    fontValue: shadow.getElementById("fontValue"),
    sizeValue: shadow.getElementById("sizeValue"),
    weightValue: shadow.getElementById("weightValue"),
    lineValue: shadow.getElementById("lineValue"),
    colorValue: shadow.getElementById("colorValue"),
    select
  };

  shadow.getElementById("closeBtn").addEventListener("click", stopInspector);
  shadow.getElementById("unlockBtn").addEventListener("click", () => {
    inspectorTarget = null;
    clearOutline();
  });
  shadow.getElementById("swapElementBtn").addEventListener("click", () => {
    if (!inspectorTarget) return;
    swapSingleElement(inspectorTarget, select.value);
  });

  inspector = api;
  return api;
}

function clearOutline() {
  document.querySelectorAll("[data-fontswap-inspector-outline]").forEach(el => {
    el.style.removeProperty("outline");
    el.style.removeProperty("outline-offset");
    el.removeAttribute("data-fontswap-inspector-outline");
  });
}

function setOutline(element) {
  clearOutline();
  if (!(element instanceof HTMLElement)) return;
  element.dataset.fontswapInspectorOutline = "true";
  element.style.setProperty("outline", "2px solid #7c3aed", "important");
  element.style.setProperty("outline-offset", "2px", "important");
}

function updateInspectorInfo(element) {
  if (!inspector || !(element instanceof HTMLElement)) return;

  const style = getComputedStyle(element);
  inspector.fontValue.textContent = cleanFontName(style.fontFamily) || style.fontFamily;
  inspector.sizeValue.textContent = style.fontSize;
  inspector.weightValue.textContent = style.fontWeight;
  inspector.lineValue.textContent = style.lineHeight;
  inspector.colorValue.textContent = style.color;
}

function inspectorMouseMove(event) {
  if (!inspector || inspectorTarget) return;

  const element = event.target;
  if (!isUsefulTextElement(element)) {
    inspector.tooltip.style.display = "none";
    return;
  }

  updateInspectorInfo(element);

  const style = getComputedStyle(element);
  inspector.tooltip.innerHTML = `
    <strong>${cleanFontName(style.fontFamily) || style.fontFamily}</strong>
    <span>${style.fontSize} · ${style.fontWeight} · ${style.lineHeight}</span>
  `;
  inspector.tooltip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 300)}px`;
  inspector.tooltip.style.top = `${Math.min(event.clientY + 14, window.innerHeight - 80)}px`;
  inspector.tooltip.style.display = "block";
}

function inspectorClick(event) {
  if (!inspector) return;
  const element = event.target;

  if (inspector.host.contains(element)) return;
  if (!isUsefulTextElement(element)) return;

  event.preventDefault();
  event.stopPropagation();

  inspectorTarget = element;
  inspector.tooltip.style.display = "none";
  setOutline(element);
  updateInspectorInfo(element);
}

function startInspector() {
  makeInspector();
  document.addEventListener("mousemove", inspectorMouseMove, true);
  document.addEventListener("click", inspectorClick, true);
}

function stopInspector() {
  document.removeEventListener("mousemove", inspectorMouseMove, true);
  document.removeEventListener("click", inspectorClick, true);
  clearOutline();

  if (inspector?.host?.isConnected) inspector.host.remove();
  inspector = null;
  inspectorTarget = null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return;

  if (message.type === "GET_STATE") {
    sendResponse({
      fonts: scanFonts(),
      activeSwaps: Object.fromEntries(activeSwaps),
      remember: rememberEnabled
    });
    return;
  }

  if (message.type === "SCAN_FONTS") {
    sendResponse({ fonts: scanFonts() });
    return;
  }

  if (message.type === "SWAP_FONT") {
    const changed = swapFont(message.sourceFont, message.replacementFont);
    sendResponse({ changed });
    return;
  }

  if (message.type === "RESET_FONTS") {
    const restored = resetFonts();
    sendResponse({ restored });
    return;
  }

  if (message.type === "SET_REMEMBER") {
    setRemember(message.enabled).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "START_INSPECTOR") {
    startInspector();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "STOP_INSPECTOR") {
    stopInspector();
    sendResponse({ ok: true });
  }
});

loadSavedState();

const observer = new MutationObserver(() => {
  if (!rememberEnabled || !activeSwaps.size) return;

  for (const [sourceFont, replacementFont] of activeSwaps.entries()) {
    for (const element of document.querySelectorAll("body *")) {
      if (!(element instanceof HTMLElement)) continue;
      if (originalInlineByElement.has(element)) continue;
      const originalFont = getOriginalFont(element);
      if (originalFont === sourceFont) applyFontToElement(element, replacementFont);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
