# Complete Build Prompt for Housing.com Chatbot UI

## Instructions for AI Agent

You are tasked with building an exact replica of a mobile-first conversational chatbot interface for Housing.com. This is a complex, production-ready UI with specific requirements that must be followed exactly.

## Critical Requirements Summary

1. **Mobile-only**: Desktop shows blocker message
2. **ChatGPT-style layout**: Messages stack from top, scroll behind 40% transparent header
3. **Infinite pills marquee**: Smooth horizontal scroll with auto-resume
4. **Intent routing**: Price trends NEVER show property cards, housing queries show cards after slot-filling
5. **Keyboard handling**: Uses visualViewport, no jumps, header stays fixed
6. **Send/Stop toggle**: Button switches during bot response
7. **Property cards**: Horizontal carousel, 78% width, local images
8. **Trend cards**: Always show, even for unknown localities

## File Structure to Create

```
project-root/
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

## Step 1: Create index.html

[The complete HTML is provided in the next section - copy it exactly]

## Step 2: Create styles.css

[The complete CSS is provided in the next section - copy it exactly]

## Step 3: Create script.js

[The complete JavaScript is provided in the next section - copy it exactly]

## Step 4: Add Images

- Download 8 aesthetic interior property images (Unsplash or similar)
- Save as interior1.jpg through interior8.jpg in images/property/
- Add chat-bot.png (rotating chat bot icon)
- Add face.png (face overlay for chat bot)
- Add bg.jpg (background for bottom sheet)
- Add avatar.png, buy-icon.png, plot.png, recents.png

## Key Implementation Details

### Header Transparency
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

### Intent Routing Order
```javascript
// In handleSend() - check trend FIRST
if (isTrendQuery(text)) {
    handleTrendIntent(text);
} else {
    handleHousingIntent(text);
}

// In handleHousingIntent() - check trend again
if (isTrendQuery(userText)) {
    handleTrendIntent(userText);
    return; // Critical - prevents property cards
}
```

### Pills Marquee Auto-Resume
```javascript
// Use failsafe timer + multiple event handlers
function endDrag() {
    dragging = false;
    resumeSoon(900); // Resume after 900ms
}
// Handle: pointerup, pointercancel, lostpointercapture, touchend, touchcancel, blur
```

### Keyboard Handling
```javascript
// Use visualViewport for accurate keyboard height
const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
composer.style.bottom = kb ? `${kb}px` : '0px';
header.style.top = '0px'; // Never moves
```

### Property Cards Guard
```javascript
// In renderBotTurn() - never show cards for trends
if (trendCard) {
    // Skip property cards
} else if (safeCarousel && safeCarousel.length > 0) {
    // Show property cards
}
```

## Testing Requirements

After implementation, verify:
1. Header is 40% transparent, no gradient block below
2. "price trend in Rohini" → trend card only, no property cards
3. "3bhk in delhi" → property cards after slot-filling
4. Pills scroll smoothly, auto-resume after manual drag
5. Keyboard open/close: no header/input jumps
6. Messages stack from top, scroll behind header
7. Property cards: horizontal scroll, clipped at right edge
8. Trend cards show for unknown localities with "(city not confirmed)"
9. Send button toggles to Stop during response
10. No duplicate questions asked

---

**IMPORTANT**: The complete code files follow in the next sections. Copy them exactly as provided.

