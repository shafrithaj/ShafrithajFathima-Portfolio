/* ============================================================
   script.js — Klondike Solitaire (Complete Game Logic)
   Pure Vanilla JavaScript — No frameworks, no libraries.
   ============================================================

   TABLE OF CONTENTS
   1.  Constants & Configuration
   2.  Game State
   3.  Card Data & Deck Generation
   4.  DOM Helpers
   5.  Card Element Factory (renders SVG cards in HTML)
   6.  Pile / Layout Helpers
   7.  Game Initialisation
   8.  Stock & Waste Logic
   9.  Move Validation
   10. Drag-and-Drop (mouse + touch)
   11. Drop Handling
   12. Auto-flip Hidden Cards
   13. Undo System
   14. Hint System
   15. Score System
   16. Timer
   17. Win Detection & Animation
   18. Sound Effects (Web Audio API — no files needed)
   19. Event Listeners & Startup
   ============================================================ */


/* ============================================================
   1. CONSTANTS & CONFIGURATION
   ============================================================ */

const SUITS    = ['♠', '♥', '♦', '♣'];              // Spade, Heart, Diamond, Club
const RANKS    = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS   = ['♥', '♦'];                       // Hearts and Diamonds are red
const BLACK_SUITS = ['♠', '♣'];                       // Spades and Clubs are black

// How far each face-up / face-down card is offset vertically in a tableau pile
const FACEDOWN_OFFSET = 18;   // px — tight overlap for hidden cards
const FACEUP_OFFSET   = 28;   // px — slightly more room to read the cards

// Score values (classic Windows Solitaire scoring)
const SCORE = {
  WASTE_TO_TABLEAU:    5,
  WASTE_TO_FOUNDATION: 10,
  TABLEAU_TO_FOUNDATION: 10,
  TURN_OVER_CARD:      5,
  FOUNDATION_TO_TABLEAU: -15,
  RECYCLE_WASTE:       -100   // only if score > 0
};


/* ============================================================
   2. GAME STATE
   All mutable game data lives in this one object so it is
   easy to snapshot for the undo system.
   ============================================================ */

/** @type {GameState} */
let state = {};

/**
 * A snapshot of game state used by the undo system.
 * We keep a stack of previous states.
 * @type {Array<string>}   JSON-serialised snapshots
 */
const undoStack = [];
const MAX_UNDO  = 50;

/**
 * Creates a deep copy of the current state (for undo).
 * @returns {string}  JSON string
 */
function snapshotState() {
  return JSON.stringify({
    stock:       state.stock,
    waste:       state.waste,
    foundation:  state.foundation,
    tableau:     state.tableau,
    moveCount:   state.moveCount,
    score:       state.score,
    seconds:     state.seconds
  });
}

/**
 * Restores state from a JSON snapshot.
 * @param {string} snap
 */
function restoreState(snap) {
  const s = JSON.parse(snap);
  state.stock      = s.stock;
  state.waste      = s.waste;
  state.foundation = s.foundation;
  state.tableau    = s.tableau;
  state.moveCount  = s.moveCount;
  state.score      = s.score;
  state.seconds    = s.seconds;
}


/* ============================================================
   3. CARD DATA & DECK GENERATION
   ============================================================ */

/**
 * A card object.
 * @typedef {{ suit: string, rank: string, faceUp: boolean, id: string }} Card
 */

/**
 * Builds and returns a shuffled 52-card deck.
 * @returns {Card[]}
 */
function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        faceUp: false,
        id: rank + suit   // e.g. "A♠", "10♥"
      });
    }
  }
  return shuffle(deck);
}

/**
 * Fisher-Yates in-place shuffle.
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Returns rank index 0–12 (A=0 … K=12) */
function rankIndex(rank) {
  return RANKS.indexOf(rank);
}

/** Returns true if suit is red */
function isRed(suit) {
  return RED_SUITS.includes(suit);
}


/* ============================================================
   4. DOM HELPERS
   ============================================================ */

const $ = id => document.getElementById(id);

/** Returns the DOM element for the Nth tableau column */
function tableauEl(n) { return $(`tableau-${n}`); }

/** Returns the DOM element for the Nth foundation pile */
function foundationEl(n) { return $(`foundation-${n}`); }


/* ============================================================
   5. CARD ELEMENT FACTORY
   We draw every card entirely in HTML + CSS — no image files
   needed. Each card is a <div> with two faces.
   ============================================================ */

/**
 * Maps a suit character to its HTML entity / symbol.
 * We keep the raw Unicode because it looks best.
 */
const SUIT_SYMBOL = {
  '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣'
};

/**
 * Creates and returns a DOM element representing one card.
 * @param {Card} card
 * @returns {HTMLElement}
 */
function createCardElement(card) {
  const el = document.createElement('div');
  el.classList.add('card');
  el.dataset.id   = card.id;
  el.dataset.suit = card.suit;
  el.dataset.rank = card.rank;

  // Colour class
  el.classList.add(isRed(card.suit) ? 'red' : 'black');

  // ---- BACK face ----
  const back = document.createElement('div');
  back.classList.add('card-back');
  el.appendChild(back);

  // ---- FRONT face ----
  const face = document.createElement('div');
  face.classList.add('card-face');

  // Top-left corner (rank + suit stacked)
  const topCorner = document.createElement('div');
  topCorner.classList.add('card-corner-top');
  topCorner.innerHTML = `<span class="corner-rank">${card.rank}</span><span class="corner-suit">${card.suit}</span>`;

  // Bottom-right corner (same, rotated via CSS)
  const botCorner = document.createElement('div');
  botCorner.classList.add('card-corner-bottom');
  botCorner.innerHTML = `<span class="corner-rank">${card.rank}</span><span class="corner-suit">${card.suit}</span>`;

  // Centre large suit pip
  const center = document.createElement('div');
  center.classList.add('card-center');
  center.textContent = card.suit;

  face.appendChild(topCorner);
  face.appendChild(center);
  face.appendChild(botCorner);
  el.appendChild(face);

  // Set initial face direction
  if (card.faceUp) {
    el.classList.add('face-up');
  }

  return el;
}


/* ============================================================
   6. PILE / LAYOUT HELPERS
   Cards are absolutely positioned inside their pile container.
   We recalculate positions every time the state changes.
   ============================================================ */

/**
 * Clears all card elements from every pile slot in the DOM.
 */
function clearAllCardElements() {
  document.querySelectorAll('.card').forEach(el => el.remove());
}

/**
 * Full re-render: reads game state and creates/positions
 * every card element in the DOM.
 */
function render() {
  clearAllCardElements();

  // --- STOCK ---
  const stockEl = $('stock');
  if (state.stock.length === 0) {
    stockEl.classList.add('empty');
  } else {
    stockEl.classList.remove('empty');
    // Only render the top card visually (as a face-down pile)
    const topCard = state.stock[state.stock.length - 1];
    const cardEl  = createCardElement({ ...topCard, faceUp: false });
    cardEl.style.top  = '0px';
    cardEl.style.left = '0px';
    // Show a count badge if there are multiple cards
    if (state.stock.length > 1) {
      const badge = document.createElement('span');
      badge.style.cssText = `
        position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);
        color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:10px;
        pointer-events:none;z-index:10;font-family:sans-serif;
      `;
      badge.textContent = state.stock.length;
      cardEl.appendChild(badge);
    }
    stockEl.appendChild(cardEl);
  }

  // --- WASTE ---
  const wasteEl = $('waste');
  if (state.waste.length > 0) {
    const topWaste = state.waste[state.waste.length - 1];
    const cardEl   = createCardElement({ ...topWaste, faceUp: true });
    cardEl.style.top  = '0px';
    cardEl.style.left = '0px';
    wasteEl.appendChild(cardEl);
  }

  // --- FOUNDATIONS ---
  for (let i = 0; i < 4; i++) {
    const pile = state.foundation[i];
    const el   = foundationEl(i);
    if (pile.length > 0) {
      const top    = pile[pile.length - 1];
      const cardEl = createCardElement({ ...top, faceUp: true });
      cardEl.style.top  = '0px';
      cardEl.style.left = '0px';
      el.appendChild(cardEl);
    }
  }

  // --- TABLEAU ---
  for (let col = 0; col < 7; col++) {
    const pile   = state.tableau[col];
    const colEl  = tableauEl(col);

    // Compute stacking offsets
    let yOffset  = 0;
    let faceDownCount = pile.filter(c => !c.faceUp).length;

    pile.forEach((card, idx) => {
      const cardEl = createCardElement(card);
      cardEl.style.top  = `${yOffset}px`;
      cardEl.style.left = '0px';
      colEl.appendChild(cardEl);

      // Advance offset for next card
      if (card.faceUp) {
        yOffset += FACEUP_OFFSET;
      } else {
        yOffset += FACEDOWN_OFFSET;
      }
    });

    // Update the column's min-height so the slot expands
    const minH = Math.max(
      parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--card-height')),
      yOffset + parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--card-height'))
    );
    colEl.style.height = `${minH}px`;
  }

  // Update stat displays
  $('move-counter').textContent  = state.moveCount;
  $('score-display').textContent = Math.max(0, state.score);

  // Apply flip animations to any cards just turned over
  animateFlippedCards();
}


/* ============================================================
   7. GAME INITIALISATION
   ============================================================ */

/**
 * Starts a fresh game: shuffles a new deck, deals to tableau,
 * resets all state, clears undo history, resets timer.
 */
function newGame() {
  // Stop any running timer
  stopTimer();

  // Build fresh state
  const deck = buildDeck();

  // Deal to tableau: column i gets i+1 cards, last is face-up
  const tableau = [];
  let deckIdx   = 0;
  for (let col = 0; col < 7; col++) {
    const pile = [];
    for (let row = 0; row <= col; row++) {
      const card    = { ...deck[deckIdx++] };
      card.faceUp   = (row === col); // Only top card face-up
      pile.push(card);
    }
    tableau.push(pile);
  }

  // Remaining cards go to stock
  const stock = deck.slice(deckIdx).map(c => ({ ...c, faceUp: false }));

  state = {
    stock,
    waste:      [],
    foundation: [[], [], [], []],
    tableau,
    moveCount:  0,
    score:      0,
    seconds:    0
  };

  // Clear undo history
  undoStack.length = 0;

  // Hide win overlay
  $('win-overlay').classList.add('hidden');

  render();
  startTimer();
}

/**
 * Restarts the SAME game (resets move count & timer but
 * same initial deal — not stored, so we just start a new one).
 * For a true restart we would need to store the original seed.
 * Here we treat "Restart" as deal a new game.
 */
function restartGame() {
  newGame();
}


/* ============================================================
   8. STOCK & WASTE LOGIC
   ============================================================ */

/**
 * Called when the player clicks the stock pile.
 * Draws one card to the waste, or recycles waste if stock empty.
 */
function clickStock() {
  if (state.stock.length === 0) {
    // Recycle: flip waste back into stock
    if (state.waste.length === 0) return; // Nothing to do
    saveUndoSnapshot();
    state.stock = state.waste.reverse().map(c => ({ ...c, faceUp: false }));
    state.waste = [];
    // Penalty for recycling (only if score would go below 0, cap at 0)
    state.score = Math.max(0, state.score + SCORE.RECYCLE_WASTE);
    playSound('flip');
  } else {
    // Draw one card
    saveUndoSnapshot();
    const card   = state.stock.pop();
    card.faceUp  = true;
    state.waste.push(card);
    state.moveCount++;
    playSound('flip');
  }
  render();
}


/* ============================================================
   9. MOVE VALIDATION
   ============================================================ */

/**
 * Returns true if `card` can be placed on top of the given
 * TABLEAU pile (alternating colours, descending rank).
 * @param {Card}   card  - Card being moved
 * @param {Card[]} pile  - Destination tableau pile
 */
function canPlaceOnTableau(card, pile) {
  if (pile.length === 0) {
    // Only Kings can go on an empty column
    return card.rank === 'K';
  }
  const topCard = pile[pile.length - 1];
  if (!topCard.faceUp) return false; // Can't place on hidden card
  const colorOK = isRed(card.suit) !== isRed(topCard.suit);  // Alternating colours
  const rankOK  = rankIndex(card.rank) === rankIndex(topCard.rank) - 1; // Descending
  return colorOK && rankOK;
}

/**
 * Returns true if `card` can be placed on top of the given
 * FOUNDATION pile (same suit, ascending rank starting from Ace).
 * @param {Card}   card  - Card being moved
 * @param {Card[]} pile  - Destination foundation pile
 */
function canPlaceOnFoundation(card, pile) {
  if (pile.length === 0) {
    return card.rank === 'A'; // Foundation must start with Ace
  }
  const topCard = pile[pile.length - 1];
  const suitOK  = card.suit  === topCard.suit;                         // Same suit
  const rankOK  = rankIndex(card.rank) === rankIndex(topCard.rank) + 1; // Ascending
  return suitOK && rankOK;
}

/**
 * Tries to auto-move a card to a foundation pile.
 * Returns the foundation index if successful, -1 otherwise.
 * Used for double-click shortcut.
 * @param {Card} card
 * @returns {number}
 */
function findFoundationTarget(card) {
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, state.foundation[i])) {
      return i;
    }
  }
  return -1;
}


/* ============================================================
   10. DRAG AND DROP (Mouse + Touch)
   ============================================================ */

// Drag session data
let drag = null;
/*
  drag = {
    cards:      Card[]     — the card(s) being dragged
    sourceType: string     — 'stock' | 'waste' | 'foundation' | 'tableau'
    sourceIdx:  number     — pile index (for tableau/foundation)
    ghostEl:    HTMLElement — visual clone following the cursor
    offsetX:    number
    offsetY:    number
  }
*/

/**
 * Starts a drag session.
 * @param {MouseEvent|TouchEvent} e
 * @param {Card[]} cards      - Cards being dragged (one or more)
 * @param {string} sourceType
 * @param {number} sourceIdx
 */
function startDrag(e, cards, sourceType, sourceIdx) {
  if (!cards || cards.length === 0) return;

  // Build ghost element (visual drag image)
  const ghost = $('drag-ghost');
  ghost.innerHTML = '';
  ghost.style.display = 'block';

  cards.forEach(card => {
    const el = createCardElement({ ...card, faceUp: true });
    ghost.appendChild(el);
  });

  // Mouse position relative to the first card
  const point    = getPoint(e);
  const firstCardEl = document.querySelector(`.card[data-id="${CSS.escape(cards[0].id)}"]`);
  let offsetX = 20, offsetY = 20;
  if (firstCardEl) {
    const rect = firstCardEl.getBoundingClientRect();
    offsetX    = point.x - rect.left;
    offsetY    = point.y - rect.top;
  }

  drag = { cards, sourceType, sourceIdx, ghostEl: ghost, offsetX, offsetY };

  moveGhost(point.x, point.y);
  highlightDropTargets(cards[0]);
}

/**
 * Positions the ghost element at (x, y) with the drag offsets.
 */
function moveGhost(x, y) {
  if (!drag) return;
  drag.ghostEl.style.transform =
    `translate(${x - drag.offsetX}px, ${y - drag.offsetY}px)`;
}

/**
 * Ends the drag session, attempting to drop the cards.
 */
function endDrag(e) {
  if (!drag) return;

  clearDropTargetHighlights();

  const point  = getPoint(e);
  const target = findDropTarget(point.x, point.y);

  if (target) {
    attemptDrop(target);
  }

  // Hide ghost
  drag.ghostEl.style.display = 'none';
  drag.ghostEl.innerHTML     = '';
  drag = null;
}

/**
 * Cross-browser helper to extract { x, y } from mouse or touch event.
 */
function getPoint(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length > 0) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

/**
 * Finds the pile element the user is hovering over.
 * Returns { type, idx } or null.
 */
function findDropTarget(x, y) {
  // Hide ghost temporarily so elementFromPoint ignores it
  drag.ghostEl.style.display = 'none';
  const el = document.elementFromPoint(x, y);
  drag.ghostEl.style.display = 'block';

  if (!el) return null;

  // Walk up the DOM to find a pile slot or a card inside one
  let node = el;
  while (node && node !== document.body) {
    // Foundation
    for (let i = 0; i < 4; i++) {
      if (node === foundationEl(i) || foundationEl(i).contains(node)) {
        return { type: 'foundation', idx: i };
      }
    }
    // Tableau
    for (let i = 0; i < 7; i++) {
      if (node === tableauEl(i) || tableauEl(i).contains(node)) {
        return { type: 'tableau', idx: i };
      }
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Highlights valid drop targets for the dragged card.
 */
function highlightDropTargets(card) {
  // Foundations
  for (let i = 0; i < 4; i++) {
    if (canPlaceOnFoundation(card, state.foundation[i])) {
      foundationEl(i).classList.add('drop-target');
    }
  }
  // Tableau
  for (let i = 0; i < 7; i++) {
    if (canPlaceOnTableau(card, state.tableau[i])) {
      tableauEl(i).classList.add('drop-target');
    }
  }
}

function clearDropTargetHighlights() {
  document.querySelectorAll('.drop-target').forEach(el =>
    el.classList.remove('drop-target'));
}

/**
 * Handles card mousedown / touchstart to initiate a drag.
 */
function onCardPointerDown(e, cardEl) {
  // Only left-button or touch
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();

  const cardId     = cardEl.dataset.id;
  const sourceInfo = findCardSource(cardId);
  if (!sourceInfo) return;

  const { type, idx, cards } = sourceInfo;
  if (!cards[0].faceUp) return; // Can't drag face-down cards

  startDrag(e, cards, type, idx);
}

/**
 * Locates where a card (by id) lives in the current state.
 * Returns { type, idx, cards } where cards is an array starting
 * from the found card (for tableau stacks) or just [card].
 */
function findCardSource(cardId) {
  // Waste
  if (state.waste.length > 0) {
    const top = state.waste[state.waste.length - 1];
    if (top.id === cardId) {
      return { type: 'waste', idx: -1, cards: [top] };
    }
  }
  // Foundation
  for (let i = 0; i < 4; i++) {
    const pile = state.foundation[i];
    if (pile.length > 0 && pile[pile.length - 1].id === cardId) {
      return { type: 'foundation', idx: i, cards: [pile[pile.length - 1]] };
    }
  }
  // Tableau — may drag a sub-stack
  for (let col = 0; col < 7; col++) {
    const pile = state.tableau[col];
    for (let row = 0; row < pile.length; row++) {
      if (pile[row].id === cardId) {
        // Collect this card and all below it (the sub-stack)
        const cards = pile.slice(row);
        // Only draggable if all cards in the sub-stack are face-up
        if (cards.some(c => !c.faceUp)) return null;
        return { type: 'tableau', idx: col, cards };
      }
    }
  }
  return null;
}


/* ============================================================
   11. DROP HANDLING
   ============================================================ */

/**
 * Attempts to drop the dragged card stack onto a target pile.
 * @param {{ type: string, idx: number }} target
 */
function attemptDrop(target) {
  if (!drag) return;

  const { cards, sourceType, sourceIdx } = drag;
  const topCard = cards[0]; // The card being placed on the pile

  let valid = false;

  if (target.type === 'foundation') {
    // Only single cards can go to foundation
    if (cards.length === 1) {
      valid = canPlaceOnFoundation(topCard, state.foundation[target.idx]);
    }
  } else if (target.type === 'tableau') {
    valid = canPlaceOnTableau(topCard, state.tableau[target.idx]);
    // Prevent dropping a stack onto itself
    if (sourceType === 'tableau' && sourceIdx === target.idx) valid = false;
  }

  if (!valid) {
    playSound('invalid'); // Soft thud for invalid move
    return;
  }

  // ---- Perform the move ----
  saveUndoSnapshot();

  // Remove cards from source
  if (sourceType === 'waste') {
    state.waste.pop();
  } else if (sourceType === 'foundation') {
    state.foundation[sourceIdx].pop();
  } else if (sourceType === 'tableau') {
    // Remove the sub-stack from the source tableau column
    state.tableau[sourceIdx].splice(
      state.tableau[sourceIdx].length - cards.length
    );
  }

  // Add cards to destination
  if (target.type === 'foundation') {
    state.foundation[target.idx].push(...cards);
    // Score
    if (sourceType === 'waste') state.score += SCORE.WASTE_TO_FOUNDATION;
    else if (sourceType === 'tableau') state.score += SCORE.TABLEAU_TO_FOUNDATION;
  } else if (target.type === 'tableau') {
    state.tableau[target.idx].push(...cards);
    // Score
    if (sourceType === 'waste') state.score += SCORE.WASTE_TO_TABLEAU;
    else if (sourceType === 'foundation') state.score += SCORE.FOUNDATION_TO_TABLEAU;
  }

  state.moveCount++;
  autoFlipTableau();
  playSound('move');
  render();
  checkWin();
}

/**
 * Called on double-click: tries to auto-move card to foundation.
 */
function onCardDoubleClick(cardEl) {
  const cardId     = cardEl.dataset.id;
  const sourceInfo = findCardSource(cardId);
  if (!sourceInfo) return;

  const { type, idx, cards } = sourceInfo;
  if (cards.length !== 1) return; // Can't auto-move stacks
  if (!cards[0].faceUp) return;

  const card   = cards[0];
  const fndIdx = findFoundationTarget(card);
  if (fndIdx === -1) return;

  // Valid auto-move to foundation
  saveUndoSnapshot();

  // Remove from source
  if (type === 'waste') {
    state.waste.pop();
  } else if (type === 'foundation') {
    state.foundation[idx].pop();
  } else if (type === 'tableau') {
    state.tableau[idx].pop();
  }

  state.foundation[fndIdx].push(card);

  // Score
  if (type === 'waste')    state.score += SCORE.WASTE_TO_FOUNDATION;
  if (type === 'tableau')  state.score += SCORE.TABLEAU_TO_FOUNDATION;

  state.moveCount++;
  autoFlipTableau();
  playSound('move');
  render();
  checkWin();
}


/* ============================================================
   12. AUTO-FLIP HIDDEN CARDS
   After every move, check each tableau column and flip the
   top card face-up if it is face-down.
   ============================================================ */

function autoFlipTableau() {
  for (let col = 0; col < 7; col++) {
    const pile = state.tableau[col];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      if (!top.faceUp) {
        top.faceUp = true;
        state.score += SCORE.TURN_OVER_CARD;
        // We'll add the flip animation after render via a flag
        top._justFlipped = true;
      }
    }
  }
}

/**
 * After render(), adds the CSS flip animation to any card
 * that was just turned over.
 */
function animateFlippedCards() {
  for (let col = 0; col < 7; col++) {
    const pile = state.tableau[col];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      if (top._justFlipped) {
        delete top._justFlipped;
        const cardEl = tableauEl(col).querySelector(`.card[data-id="${CSS.escape(top.id)}"]`);
        if (cardEl) {
          cardEl.classList.add('flipping');
          cardEl.addEventListener('animationend', () =>
            cardEl.classList.remove('flipping'), { once: true });
        }
        playSound('flip');
      }
    }
  }
}


/* ============================================================
   13. UNDO SYSTEM
   ============================================================ */

function saveUndoSnapshot() {
  undoStack.push(snapshotState());
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift(); // Drop oldest
  }
}

function undoMove() {
  if (undoStack.length === 0) return;
  const snap = undoStack.pop();
  restoreState(snap);
  render();
  playSound('flip');
}


/* ============================================================
   14. HINT SYSTEM
   Finds the first valid move and highlights the source card.
   ============================================================ */

function showHint() {
  // Remove any previous hint highlights
  document.querySelectorAll('.hint-source').forEach(el =>
    el.classList.remove('hint-source'));

  const hint = findHint();
  if (!hint) {
    // Flash the stock pile to suggest drawing
    const stockEl = $('stock');
    stockEl.style.boxShadow = '0 0 0 3px #f4a261, 0 4px 16px rgba(244,162,97,0.6)';
    setTimeout(() => stockEl.style.boxShadow = '', 2000);
    return;
  }

  const cardEl = document.querySelector(`.card[data-id="${CSS.escape(hint.cardId)}"]`);
  if (cardEl) {
    cardEl.classList.add('hint-source');
    // Auto-remove after 3 flashes (animation is 0.8s × 3 = 2.4s)
    setTimeout(() => cardEl.classList.remove('hint-source'), 2500);
  }
}

/**
 * Finds the first valid move in the current state.
 * Priority: waste→foundation > tableau→foundation > tableau→tableau
 * @returns {{ cardId: string } | null}
 */
function findHint() {
  // 1. Can the top waste card go to a foundation?
  if (state.waste.length > 0) {
    const w = state.waste[state.waste.length - 1];
    if (findFoundationTarget(w) !== -1) return { cardId: w.id };
  }

  // 2. Can any face-up tableau card go to a foundation?
  for (let col = 0; col < 7; col++) {
    const pile = state.tableau[col];
    if (pile.length > 0) {
      const top = pile[pile.length - 1];
      if (top.faceUp && findFoundationTarget(top) !== -1) {
        return { cardId: top.id };
      }
    }
  }

  // 3. Can the waste card go to a tableau?
  if (state.waste.length > 0) {
    const w = state.waste[state.waste.length - 1];
    for (let col = 0; col < 7; col++) {
      if (canPlaceOnTableau(w, state.tableau[col])) {
        return { cardId: w.id };
      }
    }
  }

  // 4. Can any tableau face-up card move to another tableau column?
  for (let srcCol = 0; srcCol < 7; srcCol++) {
    const srcPile = state.tableau[srcCol];
    // Find the first face-up card in this column
    for (let row = 0; row < srcPile.length; row++) {
      if (!srcPile[row].faceUp) continue;
      const card = srcPile[row];
      for (let dstCol = 0; dstCol < 7; dstCol++) {
        if (srcCol === dstCol) continue;
        if (canPlaceOnTableau(card, state.tableau[dstCol])) {
          // Avoid suggesting pointless King moves to empty columns
          // (unless it uncovers a hidden card)
          const wouldUncover = row > 0 && !srcPile[row - 1].faceUp;
          const destEmpty    = state.tableau[dstCol].length === 0;
          if (destEmpty && !wouldUncover) continue;
          return { cardId: card.id };
        }
      }
    }
  }

  // 5. Foundation to tableau (rare, but valid)
  for (let fi = 0; fi < 4; fi++) {
    const fpile = state.foundation[fi];
    if (fpile.length === 0) continue;
    const top = fpile[fpile.length - 1];
    for (let col = 0; col < 7; col++) {
      if (canPlaceOnTableau(top, state.tableau[col])) {
        return { cardId: top.id };
      }
    }
  }

  return null; // No moves found
}


/* ============================================================
   15. SCORE SYSTEM
   (Scores are updated inline; render() displays them.)
   ============================================================ */
// (No separate functions needed — scoring happens during moves.)


/* ============================================================
   16. TIMER
   ============================================================ */

let timerInterval = null;

function startTimer() {
  stopTimer();
  state.seconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    state.seconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const s = String(state.seconds % 60).padStart(2, '0');
  $('timer-display').textContent = `${m}:${s}`;
}


/* ============================================================
   17. WIN DETECTION & ANIMATION
   ============================================================ */

/**
 * Checks if all 52 cards are on the foundations.
 */
function checkWin() {
  const total = state.foundation.reduce((sum, pile) => sum + pile.length, 0);
  if (total === 52) {
    stopTimer();
    showWinScreen();
  }
}

function showWinScreen() {
  playSound('win');

  const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
  const s = String(state.seconds % 60).padStart(2, '0');
  $('win-stats').textContent =
    `Time: ${m}:${s}  ·  Moves: ${state.moveCount}  ·  Score: ${Math.max(0, state.score)}`;

  $('win-overlay').classList.remove('hidden');
  spawnConfetti();
}

/**
 * Creates falling suit-symbol confetti.
 */
function spawnConfetti() {
  const container = $('confetti-container');
  container.innerHTML = '';
  const symbols  = ['♠', '♥', '♦', '♣', '★', '✦'];
  const colors   = ['#f4a261','#e76f51','#52b788','#a8dadc','#fff','#ffd166'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.classList.add('confetti-piece');
    piece.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    piece.style.left     = `${Math.random() * 100}%`;
    piece.style.color    = colors[Math.floor(Math.random() * colors.length)];
    piece.style.fontSize = `${1 + Math.random() * 1.5}rem`;
    const dur = 2 + Math.random() * 3;
    const del = Math.random() * 2;
    piece.style.animationDuration = `${dur}s`;
    piece.style.animationDelay    = `${del}s`;
    container.appendChild(piece);
  }
}


/* ============================================================
   18. SOUND EFFECTS (Web Audio API — no external files)
   All sounds are synthesised programmatically so no .mp3
   files are required. The assets/sounds folder is included
   in the project structure for completeness / future use.
   ============================================================ */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null; // Audio not supported
    }
  }
  return audioCtx;
}

/**
 * Plays a short synthesised sound.
 * @param {'move'|'flip'|'win'|'invalid'} type
 */
function playSound(type) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser policy)
  if (ctx.state === 'suspended') ctx.resume();

  switch (type) {
    case 'move':    playTone(ctx, 440, 0.08, 'triangle', 0.15); break;
    case 'flip':    playTone(ctx, 330, 0.06, 'sine',     0.1);  break;
    case 'win':     playWinFanfare(ctx); break;
    case 'invalid': playTone(ctx, 180, 0.12, 'sawtooth', 0.12); break;
  }
}

function playTone(ctx, freq, volume, type, duration) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playWinFanfare(ctx) {
  // Simple ascending arpeggio
  const notes = [261.6, 329.6, 392, 523.3];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(ctx, freq, 0.15, 'triangle', 0.4), i * 120);
  });
}


/* ============================================================
   19. EVENT LISTENERS & STARTUP
   ============================================================ */

/**
 * Attaches all event listeners to the game board.
 * Uses event delegation on the board for efficiency.
 */
function attachEventListeners() {

  // ---- Stock pile click ----
  $('stock').addEventListener('click', clickStock);

  // ---- Toolbar buttons ----
  $('btn-new-game').addEventListener('click',  newGame);
  $('btn-restart').addEventListener('click',   restartGame);
  $('btn-undo').addEventListener('click',      undoMove);
  $('btn-hint').addEventListener('click',      showHint);
  $('btn-win-new').addEventListener('click',   newGame);
  $('btn-win-restart').addEventListener('click', restartGame);

  // ---- Mouse drag on game board ----
  document.addEventListener('mousemove', e => {
    if (drag) moveGhost(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', e => {
    if (drag) endDrag(e);
  });

  // ---- Touch drag ----
  document.addEventListener('touchmove', e => {
    if (drag) {
      e.preventDefault(); // Prevent page scroll while dragging
      const t = e.touches[0];
      moveGhost(t.clientX, t.clientY);
    }
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (drag) endDrag(e);
  });

  // ---- Event delegation for card interactions ----
  // We listen on the whole game board to catch all card events.
  const board = $('game-board');

  // Mousedown on a card → start drag
  board.addEventListener('mousedown', e => {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    // Ignore stock pile cards (those are clicked, not dragged)
    if ($('stock').contains(cardEl)) return;
    onCardPointerDown(e, cardEl);
  });

  // Touchstart on a card → start drag
  board.addEventListener('touchstart', e => {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    if ($('stock').contains(cardEl)) return;
    onCardPointerDown(e, cardEl);
  }, { passive: false });

  // Double-click on a card → auto-move to foundation
  board.addEventListener('dblclick', e => {
    const cardEl = e.target.closest('.card');
    if (!cardEl) return;
    onCardDoubleClick(cardEl);
  });

  // Click on waste pile's top card → nothing special (drag handles it)
  // Click on waste area stock already handled above.

  // ---- Keyboard shortcuts ----
  document.addEventListener('keydown', e => {
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) undoMove();
    if (e.key === 'h' || e.key === 'H') showHint();
    if (e.key === 'n' || e.key === 'N') newGame();
  });
}

// animateFlippedCards() is called at the end of render() directly.

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', () => {
  attachEventListeners();
  newGame();
});


/* ============================================================
   BONUS: Upgrade card rendering to use SVG asset files
   when they are available (they always are in this project).
   This replaces the CSS-only approach with actual SVG images
   for a more polished look.
   ============================================================ */

/**
 * Maps card data to its SVG asset filename.
 * e.g. { rank: 'A', suit: '♠' } → 'AS.svg'
 */
function cardToFilename(rank, suit) {
  const suitMap = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
  return `assets/cards/${rank}${suitMap[suit]}.svg`;
}

/**
 * Override createCardElement to use SVG image assets for card faces
 * and the SVG back for card backs.
 * This is called after the original function definition so it replaces it.
 */
(function() {
  // Store original just in case
  const _orig = createCardElement;

  // Re-define globally
  window.createCardElement = function(card) {
    const el = document.createElement('div');
    el.classList.add('card');
    el.dataset.id   = card.id;
    el.dataset.suit = card.suit;
    el.dataset.rank = card.rank;
    el.classList.add(isRed(card.suit) ? 'red' : 'black');

    // Use SVG image for the card back
    const back = document.createElement('div');
    back.classList.add('card-back');
    const backImg = document.createElement('img');
    backImg.src    = 'assets/cards/back.svg';
    backImg.alt    = 'Card back';
    backImg.style.cssText = 'width:100%;height:100%;border-radius:7px;display:block;';
    backImg.onerror = () => { backImg.style.display='none'; }; // Fallback to CSS
    back.appendChild(backImg);
    el.appendChild(back);

    // Use SVG image for the card face
    const face = document.createElement('div');
    face.classList.add('card-face');
    const faceImg = document.createElement('img');
    faceImg.src   = cardToFilename(card.rank, card.suit);
    faceImg.alt   = `${card.rank} of ${card.suit}`;
    faceImg.style.cssText = 'width:100%;height:100%;border-radius:7px;display:block;';
    faceImg.onerror = function() {
      // Fallback: render as CSS if SVG missing
      faceImg.style.display = 'none';
      face.appendChild(buildCSSCardFace(card));
    };
    face.appendChild(faceImg);
    el.appendChild(face);

    if (card.faceUp) el.classList.add('face-up');
    return el;
  };

  // Expose globally so all call sites use the new version
  // (In non-module JS, window assignment makes it global.)
})();

/**
 * Builds a pure-CSS card face as fallback if SVG fails to load.
 * @param {Card} card
 * @returns {HTMLElement}
 */
function buildCSSCardFace(card) {
  const color = isRed(card.suit) ? '#c0392b' : '#1a1a1a';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:relative;width:100%;height:100%;background:#fff;
    border-radius:7px;border:1.5px solid #ddd;overflow:hidden;
  `;

  const topCorner = document.createElement('div');
  topCorner.classList.add('card-corner-top');
  topCorner.innerHTML = `<span>${card.rank}</span><span>${card.suit}</span>`;

  const center = document.createElement('div');
  center.classList.add('card-center');
  center.textContent = card.suit;

  const botCorner = document.createElement('div');
  botCorner.classList.add('card-corner-bottom');
  botCorner.innerHTML = `<span>${card.rank}</span><span>${card.suit}</span>`;

  wrapper.appendChild(topCorner);
  wrapper.appendChild(center);
  wrapper.appendChild(botCorner);
  return wrapper;
}
