# Message card structure (for engineers)

This document describes the **structured message card** used when the user asks for locality/area information (e.g. *"Tell me about Richmond Park"*). The layout matches the **Figma Case 1** design so that bot replies use a consistent, sectioned format.

---

## When this format is used

- **Trigger:** User says **"Tell me about [place name]"** (e.g. "Tell me about Richmond Park", "Tell me about Koramangala").
- **Behaviour:** Bot shows a typing indicator, then a single message card with:
  - A main title and byline
  - A location line
  - One or more **sections**, each with a heading (Heading 2) and body content
  - Optional **list** of highlights

---

## DOM structure (Figma Case 1 style)

The card is rendered inside a bot message:

```
.msg.msg-bot
  .bot-message-content
    [Heading 1]        ← Main title (e.g. "📍 Richmond Park")
    [Paragraph]        ← Byline (e.g. "Locality in South West London") — use .bot-reply-muted
    [Paragraph]        ← Location line (e.g. "📍 Richmond Park, London") — use .bot-reply-muted
    <hr>               ← Separator (1px #e5e7eb)
    [Heading 2]        ← Section title (e.g. "Locality Overview")
    [Paragraph]        ← Section body text
    <hr>               ← Optional separator before next section
    [Heading 2]        ← Section title (e.g. "Key highlights")
    <ul>               ← List of items
      <li>...</li>
      ...
    [.feedback-buttons]  ← Thumbs up/down, copy (same as other bot messages)
```

- **Heading 1:** One per card; main title (can include emoji, e.g. 📍).
- **Byline / location:** Plain `<p>`; use class `bot-reply-muted` for secondary colour (#666666).
- **Separators:** `<hr>` between sections; styled as 1px solid #e5e7eb.
- **Heading 2:** Section titles (e.g. "Locality Overview", "Key highlights").
- **Body:** `<p>` for paragraphs; `<ul>` + `<li>` for lists. No extra wrapper divs required for these sections.

---

## CSS classes and typography

| Element        | Class (optional)   | Font / style |
|----------------|---------------------|--------------|
| Heading 1      | — (use `<h1>`)      | Rubik 600, 22px, line-height 33px, color #0a0a0a |
| Heading 2      | — (use `<h2>`)      | Rubik 500, 16px, line-height 24px, color #0a0a0a |
| Paragraph      | — (use `<p>`)       | Rubik 400, 14px, line-height 21px, color #333333 |
| Muted line     | `.bot-reply-muted`  | Rubik 400, 14px, line-height 21px, color #666666 |
| List item      | — (use `<li>`)      | Rubik 500, 14px, line-height 21px, color #0a0a0a |
| Separator      | — (use `<hr>`)      | 1px solid #e5e7eb, margin 16px 0 |

All of these are already defined under `.bot-message-content` in `styles.css`, so using the correct elements (and `.bot-reply-muted` where needed) is enough.

---

## Data shape (for locality cards)

For **"Tell me about [place]"**, the card is driven by a data object per place. Example:

```js
{
  title: 'Richmond Park',                    // Main title
  byline: 'Locality in South West London',   // Subtitle under title
  locationLine: '📍 Richmond Park, London',  // Location line (muted)
  overview: '...',                           // First section body ("Locality Overview")
  highlightsLabel: 'Key highlights',         // Second section heading
  highlights: [                               // Second section list items
    'One of London\'s largest Royal Parks',
    '...'
  ]
}
```

- **title**, **byline**, **locationLine**, **overview** are required for a full card.
- **highlightsLabel** and **highlights** are optional; if `highlights` is non-empty, a second section with that heading and list is shown.

Places are keyed by normalized name (lowercase, single spaces). Unknown places can still get a card with a generic overview and no highlights.

---

## Implementation reference

- **Intent:** "Tell me about X" is detected in `handleUserMessage()` via the regex `/tell me about\s+(.+)/i`. The captured phrase is trimmed and passed to the locality card flow.
- **Rendering:** `showLocalityInfoCard(placeName)` in `script.js` builds the DOM above, pushes the message into `messages`, and appends the node to the chat stack. Typing indicator is shown for 3 seconds before the card appears.
- **Content:** Predefined places are in the `LOCALITY_INFO_CARDS` map in `script.js` (e.g. `richmond park`, `rohini`, `koramangala`). Adding a new place means adding an entry with the same data shape.

---

## Summary for engineers

1. **Structure:** One `<h1>`, optional muted `<p>` byline and location, then alternating `<hr>`, `<h2>`, and content (`<p>` or `<ul>`/`<li>`).
2. **Styling:** Use `.bot-message-content` as wrapper; use `.bot-reply-muted` for byline and location; rely on existing `.bot-message-content h1/h2/p/hr/ul/li` rules.
3. **Trigger:** "Tell me about [place]" → `showLocalityInfoCard(placeName)`.
4. **Data:** One object per place with `title`, `byline`, `locationLine`, `overview`, and optional `highlightsLabel` + `highlights`.

This keeps the message card aligned with the Figma Case 1 layout and makes it easy to add new localities or reuse the same structure for other sectioned bot replies.
