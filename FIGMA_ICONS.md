# Export icons from Figma (use these nodes)

Export at **2×** (PNG or SVG) and save to the paths below. The app will use these when present.

## Header (component 881:11443)

| Asset        | Figma node ID           | Save as                    | Size  |
|-------------|--------------------------|----------------------------|-------|
| Back arrow  | `I881:11443;478:2114`    | `assets/header/back-icon.png`  | 40×40 (export 2× → 80px) |
| Info icon   | `I881:11443;830:6211`   | `assets/header/info-icon.png`  | 40×40 (export 2× → 80px) |
| Logo        | `I881:11443;478:2118`   | `assets/header/logo.png`       | 24×24 (export 2× → 48px) |

## Pills (Frame 2147261372 / 883:11507 – pill icon “Component 23”)

| Asset     | Figma node ID        | Save as                     | Size  |
|----------|----------------------|-----------------------------|-------|
| Pill icon| `I883:11509;825:7680` (Component 23) | `assets/pills/pill-icon.svg` | 16×16 |

## How to export in Figma

1. Open the file and select the node (or a parent that contains it).
2. In the right panel, open **Export** (or right‑click → **Export**).
3. Add export setting: **PNG** (or SVG), scale **2×**.
4. Export and save to the path above (create `assets/header/` and `assets/pills/` if needed).

The app uses these paths first; if a file is missing, it falls back to the built‑in SVG/placeholder.
