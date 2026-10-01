# Osu!rea

Tablet area visualizer for osu! players: pick your tablet, set the active area to the tenth of a millimetre, compare two zones side by side, save favorites in your browser and load pro player presets. Interface in English, French and Spanish, light and dark themes.

Live: <https://osurea.yuzuctus.fr/>

## Features

- 31 tablets (Wacom, Huion, XP-Pen, Gaomon, VEIKK, UGEE, Parblo) and custom dimensions
- Width / height with ratio lock, ratio presets (16:9, 16:10, 4:3, 1:1) or a custom ratio, swap, centre position, corner radius, rotation
- Forgiving fields: comma or point decimals, the allowed range under each field, out-of-range values flagged while typing and explained when adjusted, ↑ ↓ to step (Shift ×10, Alt ÷10), Escape to restore
- The area never leaves the tablet, rotation included
- Drag the area with mouse, pen or touch; once focused, the arrow keys move it (Shift: 10 mm); align it on any edge or corner
- Comparison mode: two zones, the difference between them, and one undo history per zone (buttons, or Ctrl/Cmd + Z, Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y)
- Summary with coverage and a copyable text version
- Favorites stored in `localStorage` (name, comment, rotation included), sortable and editable

## Development

```sh
npm install
npm run dev        # Vite dev server
npm run test:run   # Vitest
npm run lint       # ESLint
npm run build      # production build in dist/
```

Deployed on Cloudflare Pages (`wrangler.jsonc`, headers in `public/_headers`).

## Design: Agrume v3

The interface uses the [Agrume](https://github.com/Yuzuctus/agrume_design) design kit shared by the Yuzuctus sites.

- `src/styles/agrume/` and `src/styles/fonts/` are **verbatim copies** of the kit (`fonts`, `tokens`, `base`, `components`, `app`) and its IBM Plex fonts. Never edit them here: change the kit first, then copy again.
- `src/styles/osurea.css` holds what is specific to Osu!rea (visualizer, tablet picker, sliders, dialogs), with the `os-` prefix.
- Check the copy with the kit's script: `node <agrume_design>/check-parity.mjs src/styles/agrume` (exit code 0 = identical).
