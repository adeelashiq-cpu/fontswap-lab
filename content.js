const originalFontByElement = new WeakMap();
const originalInlineByElement = new Map();

function cleanFontName(fontFamily) {
  if (!fontFamily) return "";
  const first = fontFamily.split(",")[0].trim();
  return first.replace(/^["']|["']$/g, "");
}

function isUsefulTextElement(element) {
  if (!(element instanceof HTMLElement)) return false;

  const tag = element.tagName;
  if (["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH", "META", "LINK"].includes(tag)) {
    return false;
  }

  const text = element.innerText?.trim();
  if (!text) return false;

  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  return true;
}

function getOriginalFont(element) {
  if (!originalFontByElement.has(element)) {
    const font = cleanFontName(getComputedStyle(element).fontFamily);
    originalFontByElement.set(element, font);
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

function swapFont(sourceFont, replacementFont) {
  let changed = 0;

  for (const element of document.querySelectorAll("body *")) {
    if (!(element instanceof HTMLElement)) continue;

    const originalFont = getOriginalFont(element);
    if (originalFont !== sourceFont) continue;

    if (!originalInlineByElement.has(element)) {
      originalInlineByElement.set(element, {
        value: element.style.getPropertyValue("font-family"),
        priority: element.style.getPropertyPriority("font-family")
      });
    }

    element.style.setProperty("font-family", `"${replacementFont}"`, "important");
    changed++;
  }

  return changed;
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
  return restored;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) return;

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
  }
});
