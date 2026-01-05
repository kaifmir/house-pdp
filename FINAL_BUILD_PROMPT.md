# FINAL BUILD PROMPT - Housing.com Chatbot UI

## For AI Agent: Build Instructions

You are tasked with creating an exact replica of a mobile-first conversational chatbot interface. This is a production-ready implementation with specific requirements.

## Quick Start

1. Create the file structure (see below)
2. Copy the 3 main code files (index.html, styles.css, script.js) - provided in full below
3. Add required images
4. Test on mobile devices

## File Structure

```
project/
├── index.html
├── styles.css
├── script.js
├── images/
│   └── property/
│       ├── interior1.jpg
│       ├── interior2.jpg
│       ├── interior3.jpg
│       ├── interior4.jpg
│       ├── interior5.jpg
│       ├── interior6.jpg
│       ├── interior7.jpg
│       └── interior8.jpg
├── chat-bot.png
├── face.png
├── bg.jpg
├── avatar.png
├── buy-icon.png
├── plot.png
└── recents.png
```

## Critical Implementation Rules

### 1. Header Transparency (MUST BE EXACT)
```css
.chat-top-bar {
    background: rgba(var(--chat-bg-rgb, 247, 242, 236), 0.4) !important;
}
.chat-top-bar::before,
.chat-top-bar::after {
    content: none !important;
    display: none !important;
}
```
- NO gradients
- NO ::after pseudo-elements
- 40% opacity flat color only

### 2. Intent Routing (CRITICAL - NO EXCEPTIONS)
```javascript
// In handleSend() - MUST check trend FIRST
if (isTrendQuery(text)) {
    handleTrendIntent(text);
} else {
    handleHousingIntent(text);
}

// In handleHousingIntent() - MUST check trend again
if (isTrendQuery(userText)) {
    handleTrendIntent(userText);
    return; // Prevents property cards
}

// In renderBotTurn() - MUST guard against property cards for trends
if (trendCard) {
    // Skip property cards entirely
} else if (safeCarousel && safeCarousel.length > 0) {
    // Show property cards
}
```

### 3. Pills Marquee Auto-Resume
- Use `requestAnimationFrame` for smooth animation
- Handle ALL end events: pointerup, pointercancel, lostpointercapture, touchend, touchcancel, blur
- Use failsafe timer: if no movement for 200ms, end drag
- Resume after 800-1200ms of no interaction

### 4. Keyboard Handling
- Use `window.visualViewport` API
- Header: `top: 0` always (never moves)
- Composer: `bottom: var(--kb)px` when keyboard open
- No transitions during keyboard events (`.kb-instant` class)

### 5. ChatGPT-Style Layout
- Messages stack from top
- Use `scroll-margin-top` for header clearance
- Large `padding-bottom: 50vh` below last message
- Messages scroll behind header

## Complete Code Files

The three main files are provided below. Copy them exactly.

---

## FILE 1: index.html

[Copy the complete index.html file - 392 lines]

---

## FILE 2: styles.css

[Copy the complete styles.css file - 2709 lines]

---

## FILE 3: script.js

[Copy the complete script.js file - 4130 lines]

---

## Image Requirements

1. **8 Interior Images**: Download aesthetic interior property photos (Unsplash recommended)
   - Save as: interior1.jpg through interior8.jpg
   - Place in: images/property/
   - Recommended: Modern living rooms, bedrooms, kitchens

2. **Icons**:
   - chat-bot.png: Rotating chat bot icon (130x130px recommended)
   - face.png: Face overlay for chat bot (50x50px, centered on chat-bot.png)
   - bg.jpg: Background image for bottom sheet (any aesthetic property/architecture image)
   - avatar.png: User avatar (32x32px)
   - buy-icon.png: Buy property icon (24x24px)
   - plot.png: Plot property icon (24x24px)
   - recents.png: Recent searches icon (16x16px)

## Testing Checklist

After implementation, verify ALL of these:

- [ ] Header is 40% transparent, no gradient block below
- [ ] "price trend in Rohini" → shows trend card ONLY, no property cards
- [ ] "rates in Rajouri Garden" → shows trend card ONLY
- [ ] "3bhk in delhi" → shows property cards after slot-filling
- [ ] "rent 2bhk under 30k" → shows property cards
- [ ] Pills marquee scrolls smoothly (60fps)
- [ ] Pills auto-resume after manual drag (within 1-2 seconds)
- [ ] Keyboard open: header stays at top, composer moves above keyboard
- [ ] Keyboard close: composer returns instantly, no jumps
- [ ] Messages stack from top, scroll behind header
- [ ] Property cards: horizontal scroll, clipped at right edge
- [ ] Trend cards show for unknown localities with "(city not confirmed)"
- [ ] Send button toggles to Stop icon during bot response
- [ ] Clicking Stop cancels response, finalizes message
- [ ] No duplicate questions asked
- [ ] Images don't repeat within a property set
- [ ] Desktop shows blocker message
- [ ] Mobile viewport uses 100dvh

## Key Functions Reference

- `handleSend()`: Main message handler
- `isTrendQuery()`: Detects price trend queries
- `handleTrendIntent()`: Handles trend queries (NO property cards)
- `handleHousingIntent()`: Handles property search
- `generateBotResponse()`: Generates response with text/chips/cards/trendCard
- `renderBotTurn()`: Strict rendering contract
- `extractParams()`: Extracts slots from input
- `detectIntent()`: Classifies intent
- `inferCityFromLocality()`: Maps locality to city
- `generateTrendData()`: Creates mock trend data
- `renderTrendCard()`: Generates trend card HTML
- `createPropertyCard()`: Creates property card element
- `pinLatestMessageUnderHeader()`: ChatGPT-style scroll

## CSS Variables

```css
--chat-bg: #F7F2EC
--chat-bg-rgb: 247, 242, 236
--header-h: 68px (JS updated)
--composer-h: 80px (JS updated)
--kb: 0px (keyboard height, visualViewport)
--vv-top: 0px (iOS visualViewport offsetTop)
```

## Fonts Required

- Inter (Google Fonts)
- Rubik (Google Fonts)
- Poppins (Google Fonts)
- Space Grotesk (Google Fonts)
- Playfair Display (Google Fonts)
- SF Pro (system font, no import needed)

---

**NEXT STEP**: Copy the three complete code files (index.html, styles.css, script.js) from the sections below.

