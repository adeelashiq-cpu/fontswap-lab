# FontSwap Lab v0.1

A personal-use Chrome extension that detects fonts used on the current webpage and lets you temporarily replace them.

## Install

1. Extract this folder.
2. Open Chrome.
3. Go to `chrome://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the `fontswap-lab-v1` folder.
7. Open a normal website and refresh it once.
8. Click the extension icon.

## Current V1 features

- Detect primary computed font families used on visible text elements.
- Show approximate element usage counts.
- Temporarily swap one detected font with a preset replacement.
- Reset all swaps.
- Changes disappear after page refresh.

## Current limitations

- Chrome internal pages (`chrome://...`) cannot be inspected.
- This version uses reliable system/browser fonts only.
- Exact glyph-level fallback-font detection is not attempted.
- Cross-origin iframe content is not scanned yet.
- Google Fonts search/loading and hover inspector are planned for the next iteration.
