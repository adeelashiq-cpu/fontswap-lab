# FontSwap Lab v0.2

A personal-use Chrome extension for detecting, inspecting, and temporarily swapping webpage fonts.

## Install / upgrade

1. Extract this folder.
2. Open `chrome://extensions`.
3. If v1 is already loaded, remove it or point Chrome to this v2 folder.
4. Turn on **Developer mode**.
5. Click **Load unpacked**.
6. Select the `fontswap-lab-v2` folder.
7. Open a normal website and refresh it once.

## New in v2

- Search/type replacement fonts.
- Built-in list of popular Google Fonts.
- Google Font loading on the webpage when you swap.
- Active swap indicator.
- Optional “Remember on this site” setting.
- Reapplies saved font mappings on the same domain.
- On-page hover inspector.
- Click text to lock an element.
- Shows font family, size, weight, line-height and color.
- Swap only the selected element from the on-page inspector.
- Shadow DOM inspector UI to reduce style conflicts with websites.

## Notes

- Some websites with strict Content Security Policy may block remote Google Fonts. System fonts will still work.
- Chrome internal pages (`chrome://...`) cannot be inspected.
- Cross-origin iframe content is not scanned yet.
- Exact glyph-level fallback detection is not attempted.
- “Remember on this site” stores only font mapping preferences in Chrome local extension storage.
