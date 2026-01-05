# Complete Build Instructions for Housing.com Chatbot UI

## Overview
This document contains the complete code and instructions to build an exact replica of the Housing.com conversational chatbot interface. The UI includes:
- Mobile-optimized chat interface with ChatGPT-style message stacking
- Infinite scrolling pill marquee animation
- Property card carousel with horizontal scrolling
- Price trend cards with sparklines
- Intent detection and slot-filling conversation flow
- Keyboard-aware header and input positioning
- Bottom sheet onboarding flow

## File Structure
```
project/
├── index.html          (Complete HTML structure)
├── styles.css          (Complete CSS styles)
├── script.js           (Complete JavaScript functionality)
├── images/
│   └── property/       (8 interior images: interior1.jpg through interior8.jpg)
├── chat-bot.png        (Chat bot icon)
├── face.png            (Face overlay for chat bot)
├── bg.jpg              (Background image for bottom sheet)
├── avatar.png          (User avatar)
├── buy-icon.png        (Buy property icon)
├── plot.png            (Plot property icon)
└── recents.png         (Recent searches icon)
```

## Critical Requirements

### 1. Mobile-First Design
- **Desktop blocker**: Show message "This experience is optimized for mobile devices only" on screens > 768px
- **Viewport**: Use `100dvh` for proper mobile viewport handling
- **Touch optimizations**: All interactive elements must have `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent`

### 2. Chat Layout (ChatGPT-Style)
- Messages stack from top, scroll behind sticky header
- Header is 40% opacity, positioned absolute at top
- Input bar is sticky at bottom, moves above keyboard
- Messages use `scroll-margin-top` to appear under header when scrolled
- Large padding-bottom (50vh) below last message for breathing room

### 3. Header Transparency
- Background: `rgba(247, 242, 236, 0.4)` (40% opacity)
- NO gradient overlays or ::after pseudo-elements
- Buttons remain 100% opaque with backdrop blur
- Header uses `position: absolute` with `transform: translate3d(0, var(--vv-top), 0)` for iOS keyboard handling

### 4. Pills Marquee Animation
- Infinite horizontal scroll using `transform: translate3d()`
- Two rows of pills, duplicated for seamless loop
- Edge fade gradients on left/right edges
- Manual drag support with `pointer` events
- Auto-resume after 800-1200ms of no interaction
- Uses `requestAnimationFrame` for smooth 60fps animation

### 5. Intent Detection & Routing
- **Price Trend Intent**: Detects "price trend", "rates", "appreciation", "psf", etc.
  - NEVER asks follow-ups for known localities
  - Shows trend card immediately even if city unknown
  - Displays "(city not confirmed)" if city can't be inferred
- **Core Housing Intent**: Detects rent/buy/BHK/city/budget queries
  - Strict slot-filling: one question at a time
  - Never repeats questions already answered
  - Only shows property cards after required slots filled
- **Greeting Intent**: Detects hi/hello/how are you
  - Always redirects to housing search
- **Non-Housing**: Polite redirect back to housing

### 6. Property Cards
- Horizontal scrollable carousel
- Cards are 78% width, max 320px
- Left padding: 16px, extends to right edge (negative margin)
- Images from local `images/property/` directory
- No image repetition within a single set
- Modern design: rounded corners, soft shadows, clean typography

### 7. Trend Cards
- Minimal design matching chat theme
- Shows locality photo, title, direction pill, sparkline SVG, stats
- Always shows even if city unknown (labels as "city not confirmed")
- Never triggers property card flow

### 8. Keyboard Handling
- Uses `window.visualViewport` API for accurate keyboard height
- Header stays at top: `top: 0` always
- Composer moves instantly: `bottom: var(--kb)px` when keyboard open
- No transitions during keyboard events (`.kb-instant` class)
- Handles iOS safe area insets

### 9. Send ↔ Stop Toggle
- Button switches to Stop icon when bot is responding
- Clicking Stop cancels typewriter animation
- Finalizes message in current state
- Returns to Send state after completion or stop

### 10. Typography & Fonts
- Bot messages: SF Pro font family (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text'`)
- UI elements: Inter, Rubik, Poppins, Space Grotesk
- Hero title: Playfair Display

## Implementation Steps

### Step 1: Create File Structure
Create all files and directories as listed above.

### Step 2: Copy HTML
Copy the complete `index.html` content (provided in next section).

### Step 3: Copy CSS
Copy the complete `styles.css` content (provided in next section).

### Step 4: Copy JavaScript
Copy the complete `script.js` content (provided in next section).

### Step 5: Add Images
- Download 8 aesthetic interior images and place in `images/property/` directory
- Add chat-bot.png, face.png, bg.jpg, avatar.png, buy-icon.png, plot.png, recents.png to root

### Step 6: Test on Mobile Devices
- Test on iOS Safari/Chrome
- Test on Android Chrome
- Verify:
  - Header transparency and positioning
  - Keyboard handling (no jumps)
  - Pills marquee smoothness
  - Property card scrolling
  - Trend card display
  - Intent routing (no property cards for trends)

## Key CSS Variables
```css
--chat-bg: #F7F2EC
--chat-bg-rgb: 247, 242, 236
--header-h: 68px (updated by JS)
--composer-h: 80px (updated by JS)
--kb: 0px (keyboard height, updated by visualViewport)
--vv-top: 0px (iOS visualViewport offsetTop)
```

## Key JavaScript Functions
- `handleSend()`: Main message handler, routes to trend or housing intent
- `isTrendQuery()`: Detects price trend queries
- `handleTrendIntent()`: Handles trend queries separately
- `handleHousingIntent()`: Handles property search queries
- `generateBotResponse()`: Generates bot response with text/chips/cards/trendCard
- `renderBotTurn()`: Strict rendering contract (text → chips → carousel → trendCard)
- `extractParams()`: Extracts slots from user input
- `detectIntent()`: Classifies user intent
- `inferCityFromLocality()`: Maps locality to city
- `generateTrendData()`: Creates mock trend data
- `renderTrendCard()`: Generates trend card HTML
- `createPropertyCard()`: Creates property card element
- `pinLatestMessageUnderHeader()`: Scrolls message under header (ChatGPT-style)

## Critical Constraints
1. **Never show property cards for trend queries** - Check `isTrendQuery()` FIRST in routing
2. **Never ask follow-ups for known localities** - Use hardcoded locality→city map
3. **Never repeat questions** - Check `chatState` and `pendingQuestion` before asking
4. **Never show cards before slots filled** - Check `readyToShowResults` flag
5. **Header must be 40% opacity** - Use flat `rgba()` color, no gradients
6. **Pills must auto-resume** - Use failsafe timers and multiple event handlers
7. **Keyboard must not cause jumps** - Use `visualViewport` and instant mode

## Testing Checklist
- [ ] Header is 40% transparent, no weird block below
- [ ] "price trend in Rohini" shows trend card, no property cards
- [ ] "3bhk in delhi" shows property cards after slot-filling
- [ ] Pills marquee scrolls smoothly, auto-resumes after drag
- [ ] Keyboard open/close doesn't cause header/input jumps
- [ ] Messages stack from top, scroll behind header
- [ ] Property cards scroll horizontally, clipped at right edge
- [ ] Trend cards show even for unknown localities
- [ ] Send button toggles to Stop during bot response
- [ ] No duplicate questions asked
- [ ] Images don't repeat within a property set

---

**Next Section**: Complete code files follow...

