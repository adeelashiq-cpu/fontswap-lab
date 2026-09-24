const PRESET_FONTS = [
  "system-ui",
  "Arial",
  "Helvetica",
  "Verdana",
  "Trebuchet MS",
  "Tahoma",
  "Georgia",
  "Times New Roman",
  "Courier New"
];

const fontList = document.getElementById("fontList");
const fontCount = document.getElementById("fontCount");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const rescanBtn = document.getElementById("rescanBtn");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToPage(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active browser tab found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function fontOptions(currentFont) {
  const options = [...PRESET_FONTS];
  if (!options.includes(currentFont)) options.unshift(currentFont);

  return options.map(font => {
    const selected = font === currentFont ? "selected" : "";
    return `<option value="${escapeHtml(font)}" ${selected}>${escapeHtml(font)}</option>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFonts(fonts) {
  fontList.innerHTML = "";
  fontCount.textContent = fonts.length;

  if (!fonts.length) {
    statusEl.textContent = "Scan complete.";
    fontList.innerHTML = `<div class="empty">No readable text fonts were detected on this page.</div>`;
    return;
  }

  statusEl.textContent = "Choose a replacement font and click Swap.";

  for (const item of fonts) {
    const card = document.createElement("article");
    card.className = "font-card";

    card.innerHTML = `
      <div class="font-card-top">
        <div class="font-name" title="${escapeHtml(item.font)}">${escapeHtml(item.font)}</div>
        <div class="usage">${item.count} element${item.count === 1 ? "" : "s"}</div>
      </div>
      <div class="controls">
        <select aria-label="Replacement font">
          ${fontOptions(item.font)}
        </select>
        <button class="swap-btn" type="button">Swap</button>
      </div>
    `;

    const select = card.querySelector("select");
    const button = card.querySelector(".swap-btn");

    button.addEventListener("click", async () => {
      const replacement = select.value;
      if (replacement === item.font) return;

      button.disabled = true;
      button.textContent = "…";

      try {
        const result = await sendToPage({
          type: "SWAP_FONT",
          sourceFont: item.font,
          replacementFont: replacement
        });

        button.textContent = result?.changed ? `✓ ${result.changed}` : "✓";
      } catch (error) {
        button.textContent = "Error";
        statusEl.textContent = error.message || "Could not modify this page.";
      } finally {
        setTimeout(() => {
          button.disabled = false;
          button.textContent = "Swap";
        }, 900);
      }
    });

    fontList.appendChild(card);
  }
}

async function scan() {
  statusEl.textContent = "Scanning current page…";
  fontList.innerHTML = "";
  fontCount.textContent = "0";

  try {
    const result = await sendToPage({ type: "SCAN_FONTS" });
    renderFonts(result?.fonts || []);
  } catch (error) {
    statusEl.textContent = "This page cannot be inspected.";
    fontList.innerHTML = `
      <div class="error">
        Chrome blocks extensions on some internal pages such as
        <strong>chrome://</strong>. Open a normal website, refresh it once,
        then try again.
      </div>`;
  }
}

resetBtn.addEventListener("click", async () => {
  try {
    await sendToPage({ type: "RESET_FONTS" });
    statusEl.textContent = "All font swaps were reset.";
    await scan();
  } catch (error) {
    statusEl.textContent = "Could not reset this page.";
  }
});

rescanBtn.addEventListener("click", scan);

scan();
