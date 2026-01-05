# READY-TO-PASTE PROMPT FOR AI AGENT

Copy and paste this entire prompt to your AI agent:

---

# Build Exact Replica: Housing.com Chatbot UI

I need you to build an exact replica of a mobile-first conversational chatbot interface. Here are the complete requirements and code.

## Project Overview
- Mobile-only chat interface (desktop blocker)
- ChatGPT-style message stacking
- 40% transparent header
- Infinite scrolling pill marquee
- Intent-based conversation flow
- Property card carousel
- Price trend cards
- Keyboard-aware layout

## File Structure to Create

```
project/
├── index.html
├── styles.css
├── script.js
├── images/property/
│   ├── interior1.jpg
│   ├── interior2.jpg
│   ├── interior3.jpg
│   ├── interior4.jpg
│   ├── interior5.jpg
│   ├── interior6.jpg
│   ├── interior7.jpg
│   └── interior8.jpg
├── chat-bot.png
├── face.png
├── bg.jpg
├── avatar.png
├── buy-icon.png
├── plot.png
└── recents.png
```

## Critical Implementation Rules

### 1. Header Must Be 40% Transparent (NO GRADIENTS)
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

### 2. Intent Routing (CRITICAL)
Price trend queries MUST NEVER show property cards. Check trend intent FIRST:

```javascript
// In handleSend()
if (isTrendQuery(text)) {
    handleTrendIntent(text);
} else {
    handleHousingIntent(text);
}

// In handleHousingIntent() - check again
if (isTrendQuery(userText)) {
    handleTrendIntent(userText);
    return; // Prevents property cards
}
```

### 3. Complete Code Files

I will provide the three complete files. Copy them exactly:

[PASTE COMPLETE index.html HERE - 392 lines]
[PASTE COMPLETE styles.css HERE - 2709 lines]  
[PASTE COMPLETE script.js HERE - 4130 lines]

## Image Requirements

1. Download 8 aesthetic interior property images (Unsplash recommended)
   - Save as interior1.jpg through interior8.jpg in images/property/
2. Add icons: chat-bot.png, face.png, bg.jpg, avatar.png, buy-icon.png, plot.png, recents.png

## Testing Requirements

After building, verify:
- Header is 40% transparent, no gradient block
- "price trend in Rohini" → trend card only, NO property cards
- "3bhk in delhi" → property cards after slot-filling
- Pills scroll smoothly, auto-resume after drag
- Keyboard handling: no jumps
- Messages stack from top, scroll behind header
- Property cards: horizontal scroll, clipped at right edge

---

**Now provide the three complete code files in your response.**

