# ♠ Klondike Solitaire

A complete, fully playable classic Klondike Solitaire game built with pure HTML, CSS, and Vanilla JavaScript. No frameworks, no libraries, no server required.

---

## 🚀 How to Play

1. **Open `index.html`** in any modern web browser.
2. The game starts immediately — no setup needed.

---

## 📁 Project Structure

```
solitaire-game/
│
├── index.html              ← Open this to play
│
├── css/
│   └── style.css           ← All styles (green felt, cards, animations)
│
├── js/
│   └── script.js           ← Complete game logic (no libraries)
│
├── assets/
│   ├── cards/
│   │   ├── AS.svg          ← Ace of Spades (all 52 cards as SVG)
│   │   ├── 2H.svg          ← 2 of Hearts
│   │   ├── ...             ← (53 files total including back.svg)
│   │   └── back.svg        ← Card back design
│   │
│   └── sounds/
│       ├── move.mp3        ← Placeholder (sounds use Web Audio API)
│       ├── flip.mp3        ← Placeholder
│       └── win.mp3         ← Placeholder
│
└── README.md               ← This file
```

---

## 🎮 Game Rules

### Objective
Move all 52 cards to the 4 **Foundation** piles (top-right), sorted by suit from Ace to King.

### Tableau (7 columns)
- Cards are stacked in **descending order**, **alternating colours** (red/black).
- Only a **King** (or a stack starting with a King) can be placed on an empty column.
- Move a **single card** or an entire **valid face-up stack** between columns.
- Hidden (face-down) cards are **automatically flipped** when uncovered.

### Stock & Waste
- Click the **stock pile** (top-left) to draw one card to the waste pile.
- When the stock is empty, click it again to **recycle** the waste back into stock.
- Only the **top waste card** can be played.

### Foundation
- Must start with an **Ace** of each suit.
- Build upward **by suit**: A → 2 → 3 → … → K.
- **Double-click** any valid card to auto-send it to a foundation pile.

---

## 🕹️ Controls

| Action | How |
|--------|-----|
| Draw from stock | Click the face-down pile |
| Move a card | Drag and drop |
| Move a stack | Drag the bottom card of the stack |
| Auto-move to foundation | Double-click a card |
| Undo | Click **↩ Undo** or press `Ctrl+Z` |
| Hint | Click **💡 Hint** or press `H` |
| New Game | Click **＋ New Game** or press `N` |

---

## ✨ Features

- ✅ Full Klondike Solitaire rules
- ✅ Drag-and-drop with visual ghost (mouse & touch)
- ✅ Double-click to auto-move to foundation
- ✅ Card flip animations
- ✅ Valid drop target highlighting
- ✅ Undo (up to 50 moves)
- ✅ Hint system (highlights a valid move)
- ✅ Move counter, score, and timer
- ✅ Win detection with confetti animation
- ✅ Sound effects (Web Audio API — no files needed)
- ✅ Responsive layout (scales on mobile/tablet)
- ✅ Keyboard shortcuts

---

## 🃏 Card Assets

All 53 card images (52 cards + 1 back) are **SVG files** generated from scratch:
- Clean, readable pip layouts for numbered cards (A–10)
- Large letter + suit for face cards (J, Q, K)
- Classic red/black colouring
- No external dependencies — everything renders locally

---

## 🔊 Sound Effects

Sounds are synthesised at runtime using the **Web Audio API** — no `.mp3` files are loaded. The `assets/sounds/` folder exists for project completeness and future customisation.

To add custom sounds, edit the `playSound()` function in `js/script.js` and load your own audio files.

---

## 🛠️ Technical Notes

- **Zero dependencies** — pure HTML5, CSS3, and ES6+ JavaScript
- **No build step** — open `index.html` directly
- **Event delegation** used for efficient card event handling
- **Undo stack** stores up to 50 JSON state snapshots
- **Web Audio API** for synthesised card sounds
- Tested in Chrome, Firefox, Safari, and Edge

---

## 📄 License

Free to use and modify for personal and educational purposes.
