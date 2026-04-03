// We rely on chess.js being loaded globally via index.html <script>
const game = new Chess();

const PIECE_IMAGES = {
  'b_p': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
  'b_n': 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
  'b_b': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
  'b_r': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
  'b_q': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
  'b_k': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg',
  'w_p': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
  'w_n': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
  'w_b': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
  'w_r': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
  'w_q': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
  'w_k': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg'
};

const UI = {
  squaresOverlay: document.getElementById('squares'),
  piecesOverlay: document.getElementById('pieces'),
  highlightsOverlay: document.getElementById('highlights'),
  statusEl: document.getElementById('status-text'),
  historyEl: document.getElementById('history-list'),
  boardEl: document.getElementById('board'),
  btnReset: document.getElementById('btn-reset'),
  btnUndo: document.getElementById('btn-undo'),
};

let orientation = 'w';
let draggedPieceEl = null;

// Helper: square ('e2') to coordinates (file, rank)
// file: 0-7, rank: 0-7 (0 is top row)
function getSquarePos(square) {
  const file = square.charCodeAt(0) - 97; 
  const rank = 8 - parseInt(square[1]);    
  return { file, rank };
}

function getPosSquare(file, rank) {
  return String.fromCharCode(97 + file) + (8 - rank);
}

// Map screen coordinates to board square
function getSquareFromEvent(e) {
  const rect = UI.boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;
  
  // 8x8 grid
  let file = Math.floor((x / rect.width) * 8);
  let rank = Math.floor((y / rect.height) * 8);
  
  if (orientation === 'b') {
    file = 7 - file;
    rank = 7 - rank;
  }
  
  return getPosSquare(file, rank);
}

// ---------------- UI INITIALIZATION ----------------

function initBoard() {
  UI.squaresOverlay.innerHTML = '';
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = document.createElement('div');
      const isDark = (rank + file) % 2 === 1;
      sq.className = `square ${isDark ? 'dark' : 'light'}`;
      UI.squaresOverlay.appendChild(sq);
    }
  }
}

// Create piece dictionary to easily find DOM elements by square
let pieceElements = {};

function createPieceElement(piece, square) {
  const pKey = `${piece.color}_${piece.type}`;
  const el = document.createElement('div');
  el.className = 'piece';
  el.style.backgroundImage = `url(${PIECE_IMAGES[pKey]})`;
  el.dataset.square = square;
  
  const pos = getSquarePos(square);
  const transformFile = orientation === 'w' ? pos.file : 7 - pos.file;
  const transformRank = orientation === 'w' ? pos.rank : 7 - pos.rank;
  
  el.style.transform = `translate(${transformFile * 100}%, ${transformRank * 100}%)`;
  
  // Drag events
  el.addEventListener('mousedown', onPieceMouseDown);
  el.addEventListener('touchstart', onPieceMouseDown, {passive: false});
  
  UI.piecesOverlay.appendChild(el);
  pieceElements[square] = el;
}

// Fully reads game.board() and creates DOM
function renderPiecesFromState() {
  UI.piecesOverlay.innerHTML = '';
  pieceElements = {};
  
  const board = game.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const square = getPosSquare(file, rank);
        createPieceElement(piece, square);
      }
    }
  }
}

// Update game status text
function updateStatus() {
  let status = '';
  let moveColor = game.turn() === 'b' ? 'Black' : 'White';

  if (game.in_checkmate()) {
    status = `Game over, ${moveColor} is in checkmate.`;
  } else if (game.in_draw()) {
    status = 'Game over, drawn position';
  } else {
    status = `${moveColor} to move`;
    if (game.in_check()) {
      status += ', ' + moveColor + ' is in check';
    }
  }
  UI.statusEl.innerHTML = status;
}

function updateHistory() {
  const history = game.history();
  UI.historyEl.innerHTML = '';
  
  for (let i = 0; i < history.length; i += 2) {
    const turnNum = (i / 2) + 1;
    const wMove = history[i];
    const bMove = history[i+1] ? history[i+1] : '';
    
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span class="turn-num">${turnNum}.</span>
      <span class="move">${wMove}</span>
      <span class="move">${bMove}</span>
    `;
    UI.historyEl.appendChild(div);
  }
  UI.historyEl.scrollTop = UI.historyEl.scrollHeight;
}

function drawHighlights(square) {
  UI.highlightsOverlay.innerHTML = '';
  if (!square) return;

  const validMoves = game.moves({ square: square, verbose: true });
  if (validMoves.length === 0) return;

  // Highlight selected
  addHighlightSquare(square, 'selected');

  for (const move of validMoves) {
    const isCapture = move.flags.includes('c') || move.flags.includes('e');
    addHighlightSquare(move.to, isCapture ? 'capture-move' : 'possible-move');
  }
}

function addHighlightSquare(square, className) {
  const pos = getSquarePos(square);
  const el = document.createElement('div');
  el.className = `highlight ${className}`;
  
  const transformFile = orientation === 'w' ? pos.file : 7 - pos.file;
  const transformRank = orientation === 'w' ? pos.rank : 7 - pos.rank;
  
  el.style.left = `${transformFile * 12.5}%`;
  el.style.top = `${transformRank * 12.5}%`;
  
  UI.highlightsOverlay.appendChild(el);
}

// ---------------- INTERACTION LOGIC ----------------
let dragStartSquare = null;

function onPieceMouseDown(e) {
  e.preventDefault();
  if (game.game_over()) return;

  draggedPieceEl = e.target;
  dragStartSquare = draggedPieceEl.dataset.square;
  
  // Can only move own pieces
  const pieceColor = game.get(dragStartSquare).color;
  if (pieceColor !== game.turn()) {
    draggedPieceEl = null;
    return;
  }

  draggedPieceEl.classList.add('dragging');
  drawHighlights(dragStartSquare);

  // Bind move handlers to window to catch fast dragging outside board
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('touchmove', onMouseMove, {passive: false});
  window.addEventListener('touchend', onMouseUp);
  
  // Initial immediate update
  onMouseMove(e);
}

function onMouseMove(e) {
  if (!draggedPieceEl) return;
  e.preventDefault();
  
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  
  const rect = UI.boardEl.getBoundingClientRect();
  const pieceWidth = rect.width / 8;
  const pieceHeight = rect.height / 8;
  
  // Absolute positioning for mouse follow, temporarily override CSS transforms
  const boardX = clientX - rect.left - (pieceWidth / 2);
  const boardY = clientY - rect.top - (pieceHeight / 2);
  
  draggedPieceEl.style.transform = `translate(${boardX}px, ${boardY}px)`;
}

function onMouseUp(e) {
  if (!draggedPieceEl) return;
  
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
  window.removeEventListener('touchmove', onMouseMove);
  window.removeEventListener('touchend', onMouseUp);
  
  draggedPieceEl.classList.remove('dragging');
  
  const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
  const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
  
  const targetSquare = getSquareFromEvent({clientX, clientY});
  
  UI.highlightsOverlay.innerHTML = ''; // clear highlights
  
  let validMove = false;
  if (targetSquare && targetSquare !== dragStartSquare) {
    // Attempt move
    const moves = game.moves({ square: dragStartSquare, verbose: true });
    // Handle Auto-Promotion to Queen for simplicity
    const moveObj = moves.find(m => m.to === targetSquare);
    
    if (moveObj) {
      const moveResult = game.move({
        from: dragStartSquare,
        to: targetSquare,
        promotion: 'q' 
      });
      
      if (moveResult) {
        validMove = true;
        animateMove(dragStartSquare, targetSquare, moveResult);
      }
    }
  }
  
  if (!validMove) {
    // Snap back
    snapPieceToSquare(draggedPieceEl, dragStartSquare);
  }
  
  draggedPieceEl = null;
}

// ---------------- ANIMATION & STATE SYNC ----------------

function snapPieceToSquare(el, square) {
  if (!el) return;
  const pos = getSquarePos(square);
  const transformFile = orientation === 'w' ? pos.file : 7 - pos.file;
  const transformRank = orientation === 'w' ? pos.rank : 7 - pos.rank;
  
  // Using % translations for responsive resizing
  el.style.transform = `translate(${transformFile * 100}%, ${transformRank * 100}%)`;
  el.dataset.square = square;
}

function updatePieceImage(el, pieceStr) {
  el.style.backgroundImage = `url(${PIECE_IMAGES[pieceStr]})`;
}

function animateMove(fromSquare, toSquare, moveResult) {
  const pieceEl = pieceElements[fromSquare];
  
  // Handle capture removal.
  if (moveResult.captured) {
    let captureSquare = toSquare;
    if (moveResult.flags.includes('e')) {
      // En passant: captured pawn is on the same rank as fromSquare
      captureSquare = toSquare.charAt(0) + fromSquare.charAt(1);
    }
    const capturedEl = pieceElements[captureSquare];
    if (capturedEl) {
      // Delay removal for smooth capture look 
      setTimeout(() => capturedEl.remove(), 100); 
    }
    delete pieceElements[captureSquare];
  }
  
  // Move main piece visually
  snapPieceToSquare(pieceEl, toSquare);
  
  // Update internal mapping
  delete pieceElements[fromSquare];
  pieceElements[toSquare] = pieceEl;
  
  // Handle Castling (move the rook)
  if (moveResult.flags.includes('k') || moveResult.flags.includes('q')) {
    let rookFrom, rookTo;
    if (moveResult.flags.includes('k')) { // Kingside
      rookFrom = 'h' + toSquare.charAt(1);
      rookTo = 'f' + toSquare.charAt(1);
    } else { // Queenside
      rookFrom = 'a' + toSquare.charAt(1);
      rookTo = 'd' + toSquare.charAt(1);
    }
    const rookEl = pieceElements[rookFrom];
    snapPieceToSquare(rookEl, rookTo);
    delete pieceElements[rookFrom];
    pieceElements[rookTo] = rookEl;
  }
  
  // Handle promotion display update
  if (moveResult.promotion) {
    const promoColor = game.turn() === 'w' ? 'b' : 'w'; // turn already flipped
    updatePieceImage(pieceEl, `${promoColor}_${moveResult.promotion}`);
  }

  updateStatus();
  updateHistory();
}

// ---------------- GAME CONTROLS ----------------
UI.btnReset.addEventListener('click', () => {
  game.reset();
  renderPiecesFromState();
  updateStatus();
  updateHistory();
});

UI.btnUndo.addEventListener('click', () => {
  const move = game.undo();
  if (move) {
    // Easier to just re-render on undo to avoid reverse logic
    renderPiecesFromState();
    updateStatus();
    updateHistory();
  }
});

// Boot up
initBoard();
renderPiecesFromState();
updateStatus();
