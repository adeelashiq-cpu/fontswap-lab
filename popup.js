const REPLACEMENT_FONTS = [
  "system-ui", "Arial", "Helvetica", "Verdana", "Trebuchet MS", "Tahoma",
  "Georgia", "Times New Roman", "Courier New",
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Nunito", "Manrope", "DM Sans", "Work Sans", "Source Sans 3",
  "Raleway", "Merriweather", "Playfair Display", "Oswald", "Rubik",
  "Ubuntu", "Fira Sans", "Mulish", "Karla", "Libre Franklin",
  "Bebas Neue", "Space Grotesk", "Plus Jakarta Sans", "Outfit",
  "Urbanist", "Archivo", "Barlow", "Cabin", "PT Sans", "PT Serif"
];

const fontList = document.getElementById("fontList");
const fontCount = document.getElementById("fontCount");
const swapCount = document.getElementById("swapCount");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const rescanBtn = document.getElementById("rescanBtn");
const inspectBtn = document.getElementById("inspectBtn");
const rememberToggle = document.getElementById("rememberToggle");
const fontOptions = document.getElementById("fontOptions");

for (const font of REPLACEMENT_FONTS) {
  const option = document.createElement("option");
  option.value = font;
  fontOptions.appendChild(option);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToPage(message) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("No active browser tab found.");
  return chrome.tabs.sendMessage(tab.id, message);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderFonts(fonts, activeSwaps = {}) {
  fontList.innerHTML = "";
  fontCount.textContent = fonts.length;
  const activeCount = Object.keys(activeSwaps).length;
  swapCount.textContent = `${activeCount} active swap${activeCount === 1 ? "" : "s"}`;

  if (!fonts.length) {
    statusEl.textContent = "Scan complete.";
    fontList.innerHTML = `<div class="empty">No readable text fonts were detected on this page.</div>`;
    return;
  }

  statusEl.textContent = "Type a system or Google Font name, then click Swap.";

  for (const item of fonts) {
    const currentSwap = activeSwaps[item.font] || "";
    const card = document.createElement("article");
    card.className = `font-card${currentSwap ? " active" : ""}`;

    card.innerHTML = `
      <div class="font-card-top">
        <div class="font-name" title="${escapeHtml(item.font)}">${escapeHtml(item.font)}</div>
        <div class="usage">${item.count} element${item.count === 1 ? "" : "s"}</div>
      </div>
      <div class="controls">
        <input class="font-input" list="fontOptions" placeholder="e.g. Manrope" value="${escapeHtml(currentSwap)}" />
        <button class="swap-btn" type="button">Swap</button>
      </div>
      ${currentSwap ? `<div class="swap-label">Currently swapped to <strong>${escapeHtml(currentSwap)}</strong></div>` : ""}
    `;

    const input = card.querySelector(".font-input");
    const button = card.querySelector(".swap-btn");

    button.addEventListener("click", async () => {
      const replacement = input.value.trim();
      if (!replacement) {
        input.focus();
        return;
      }

      button.disabled = true;
      button.textContent = "…";

      try {
        const result = await sendToPage({
          type: "SWAP_FONT",
          sourceFont: item.font,
          replacementFont: replacement
        });
        button.textContent = result?.changed ? `✓ ${result.changed}` : "✓";
        setTimeout(scan, 550);
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

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") button.click();
    });

    fontList.appendChild(card);
  }
}

async function scan() {
  statusEl.textContent = "Scanning current page…";
  fontList.innerHTML = "";
  fontCount.textContent = "0";

  try {
    const result = await sendToPage({ type: "GET_STATE" });
    rememberToggle.checked = Boolean(result?.remember);
    renderFonts(result?.fonts || [], result?.activeSwaps || {});
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
  } catch {
    statusEl.textContent = "Could not reset this page.";
  }
});

inspectBtn.addEventListener("click", async () => {
  try {
    await sendToPage({ type: "START_INSPECTOR" });
    window.close();
  } catch {
    statusEl.textContent = "Inspector could not start on this page.";
  }
});

rememberToggle.addEventListener("change", async () => {
  try {
    await sendToPage({
      type: "SET_REMEMBER",
      enabled: rememberToggle.checked
    });
  } catch {
    rememberToggle.checked = false;
    statusEl.textContent = "Could not save this site's preference.";
  }
});

rescanBtn.addEventListener("click", scan);
scan();
