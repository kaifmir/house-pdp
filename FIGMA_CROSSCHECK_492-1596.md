# Figma cross-check: Node 492:1596 "Property 1=First time"

**Figma link:** https://www.figma.com/design/YQJ63HahZKIGLewQqRu5qa/Houzy?node-id=492-1596  
**Frame:** 360×696px, fill `#fafafa`

---

## ✅ Match

| Element | Figma spec | Implementation |
|--------|------------|-----------------|
| **Screen background** | `#fafafa` | `.chat-screen` `#fafafa` ✅ |
| **Hero title** | "Hey, how can I help you today?" Rubik Medium 24px, #434343, line-height 28px, center | `.chat-hero-title` ✅ |
| **Pills** | Gradient #fff→#fafafa, border #e1e2e8, radius 24px, 40px height, Rubik 14px #656565 | `.chat-pill` ✅ |
| **Pill copy** | Row1: 2 BHK fully furnished…, Show properties near me, 3 BHK…, Show trending localities. Row2: Compare localities, Check locality reviews, Show me under construction…, Check locality price trends | All 8 labels in HTML ✅ |
| **Pill icon** | 16×16 (Component 23) inside each pill | `.chat-pill-icon` + 16×16 SVG ✅ |
| **Input** | White #fff, border #e1e2e8, radius 12px, 48px height, placeholder "Ask Houzy" #767676 | `.chat-input` ✅ |
| **Disclaimer** | "Houzy Al may make mistakes…" Rubik 10px #767676, letter-spacing 0.6px, line-height 12px, center | `.chat-disclaimer` ✅ |
| **BETA badge** | #f1ebff bg, 10px, letter-spacing 1.5px, purple (#5e23dc) | `.chat-title-badge` ✅ |
| **Back button** | 40×40, 24px radius, white fill | `.chat-back-btn` ✅ |
| **Houzy title** | Rubik 14px #222222 | `.chat-title` ✅ |
| **Edge fades (chips)** | transparent → #f7f7f7 | `.chips-marquee::before/::after` ✅ |

---

## ⚠️ Minor differences

| Item | Figma | Current | Action |
|------|--------|---------|--------|
| **Houzy logo size** | 24×24 in design | 20×20 in HTML/CSS | Prefer 24×24 to match frame. |
| **Back arrow size** | Inner frame 20×20 in Figma | SVG 24×24 in HTML | Prefer 20×20 for icon. |
| **Pill icon art** | "Component 23" (exact art unknown) | Our 16×16 search (magnifier) SVG | Confirm with design; replace if Component 23 is different. |
| **Status bar** | 40px strip, 80% white, "12:00" Product Sans 14px | Not implemented (browser shows device status) | Optional: add a 40px status bar for pixel-perfect. |
| **Header bar** | Gradient white → #ffffff1a (10%) on 56px strip | Single 40% transparent + ::before gradient | Visually close; could refine to two strips if needed. |

---

## Summary

- **Layout, copy, colors, typography, and pill/input/disclaimer/BETA/back** match the Figma spec.
- **Tweaks recommended:** Houzy logo 24×24, back icon 20×20; confirm pill icon with design; optionally add status bar and refine header strips for pixel-perfect match.
