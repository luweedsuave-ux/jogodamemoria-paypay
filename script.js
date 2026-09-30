const items = [
  { name: "morcego", image: "./Assets/card-1.png" },
  { name: "sapo-flor", image: "./Assets/card-2.png" },
  { name: "xadrez", image: "./Assets/card-4.png" },
  { name: "praia", image: "./Assets/card-5.png" },
  { name: "lago", image: "./Assets/card-7.png" },
  { name: "gogreen", image: "./Assets/card-8.png" }
];

const MAX_MOVES = 12;
const PREVIEW_SECONDS = 10;

const gameContainer = document.getElementById("game-container");
const boardArea = document.getElementById("board-area");
const moves = document.getElementById("moves-count");
const timeValue = document.getElementById("time");
const pairsValue = document.getElementById("pairs-count");
const restartButton = document.getElementById("restart");
const playAgainButton = document.getElementById("play-again");
const resultOverlay = document.getElementById("result-overlay");
const resultTitle = document.getElementById("result-title");
const result = document.getElementById("result");
const roundMessage = document.getElementById("round-message");
const previewCountdown = document.getElementById("preview-countdown");

let cards = [];
let interval = null;
let previewInterval = null;
let previewTimeout = null;
let firstCard = null;
let secondCard = null;
let lockBoard = true;
let gameActive = false;
let seconds = 0;
let minutes = 0;
let movesCount = 0;
let pairsFound = 0;


function fitBoard() {
  if (!boardArea || !gameContainer) return;

  const width = boardArea.clientWidth;
  const height = boardArea.clientHeight;
  if (!width || !height) return;

  // 3 colunas x 4 linhas. Mantém cada carta perfeitamente quadrada.
  const gap = Math.max(5, Math.min(10, width * 0.012));
  const byWidth = (width - gap * 2) / 3;
  const byHeight = (height - gap * 3) / 4;
  const cardSize = Math.max(1, Math.floor(Math.min(byWidth, byHeight)));

  gameContainer.style.setProperty("--board-gap", `${gap}px`);
  gameContainer.style.setProperty("--card-size", `${cardSize}px`);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function updateStats() {
  const remaining = Math.max(0, MAX_MOVES - movesCount);
  moves.innerHTML = `<span class="stat-label">Jogadas restantes:</span><strong class="stat-value">${remaining}</strong>`;
  pairsValue.innerHTML = `<span class="stat-label">Pares:</span><strong class="stat-value">${pairsFound}/${items.length}</strong>`;
}

function updateTime() {
  timeValue.innerHTML = `<span class="stat-label">Tempo:</span><strong class="stat-value">${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}</strong>`;
}

function timeGenerator() {
  seconds += 1;
  if (seconds >= 60) {
    minutes += 1;
    seconds = 0;
  }
  updateTime();
}

function movesCounter() {
  movesCount += 1;
  updateStats();
}

function resetTurn() {
  firstCard = null;
  secondCard = null;
  lockBoard = false;
}

function setCardsDisabled(disabled) {
  cards.forEach(card => {
    card.disabled = disabled || card.classList.contains("matched");
  });
}

function endRound(type) {
  gameActive = false;
  lockBoard = true;
  clearInterval(interval);
  clearInterval(previewInterval);
  clearTimeout(previewTimeout);
  setCardsDisabled(true);

  if (type === "win") {
    resultTitle.textContent = "Você encontrou todos os pares!";
    result.innerHTML = `<strong>Mandou bem!</strong><br>Você concluiu em ${movesCount} jogadas e ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.`;
  } else {
    resultTitle.textContent = "Fim das jogadas";
    result.innerHTML = `Você usou as <strong>${MAX_MOVES} jogadas</strong> e encontrou ${pairsFound} de ${items.length} pares.<br>Tente memorizar melhor as posições na próxima rodada.`;
  }

  resultOverlay.classList.remove("hide");
}

function resolveMove() {
  if (pairsFound === items.length) {
    window.setTimeout(() => endRound("win"), 420);
    return;
  }

  if (movesCount >= MAX_MOVES) {
    window.setTimeout(() => endRound("lose"), 420);
  }
}

function handleCardClick(card) {
  if (!gameActive || lockBoard || card.classList.contains("matched") || card === firstCard) return;

  card.classList.add("flipped");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  lockBoard = true;
  movesCounter();

  if (firstCard.dataset.cardValue === secondCard.dataset.cardValue) {
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    firstCard.disabled = true;
    secondCard.disabled = true;
    pairsFound += 1;
    updateStats();

    window.setTimeout(() => {
      resetTurn();
      resolveMove();
    }, 260);
  } else {
    window.setTimeout(() => {
      firstCard?.classList.remove("flipped");
      secondCard?.classList.remove("flipped");
      resetTurn();
      resolveMove();
    }, 850);
  }
}

function createBoard() {
  const deck = shuffle([...items, ...items]);
  gameContainer.innerHTML = "";

  deck.forEach((item, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card-container preview";
    card.dataset.cardValue = item.name;
    card.setAttribute("aria-label", `Carta ${index + 1}`);
    card.disabled = true;

    card.innerHTML = `
      <span class="card-inner">
        <span class="card-before" aria-hidden="true">
          <img src="./Assets/paypay-card-logo.png" alt="" draggable="false" />
        </span>
        <span class="card-after">
          <img src="${item.image}" alt="Arte Pay-Pay" draggable="false" />
        </span>
      </span>
    `;

    card.addEventListener("click", () => handleCardClick(card));
    gameContainer.appendChild(card);
  });

  cards = [...document.querySelectorAll(".card-container")];
}

function beginPreview() {
  let remaining = PREVIEW_SECONDS;
  roundMessage.classList.remove("ready");
  roundMessage.firstElementChild.textContent = "Memorize as cartas";
  previewCountdown.textContent = remaining;
  setCardsDisabled(true);

  previewInterval = setInterval(() => {
    remaining -= 1;
    previewCountdown.textContent = Math.max(remaining, 0);
  }, 1000);

  previewTimeout = setTimeout(() => {
    clearInterval(previewInterval);
    cards.forEach(card => card.classList.remove("preview"));
    roundMessage.classList.add("ready");
    roundMessage.firstElementChild.textContent = "Valendo! Encontre os 6 pares";

    // Wait for the flip animation to finish before accepting taps/clicks.
    setTimeout(() => {
      lockBoard = false;
      gameActive = true;
      setCardsDisabled(false);
      interval = setInterval(timeGenerator, 1000);
    }, 520);
  }, PREVIEW_SECONDS * 1000);
}

function startRound() {
  clearInterval(interval);
  clearInterval(previewInterval);
  clearTimeout(previewTimeout);
  resultOverlay.classList.add("hide");

  seconds = 0;
  minutes = 0;
  movesCount = 0;
  pairsFound = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = true;
  gameActive = false;

  updateStats();
  updateTime();
  createBoard();
  requestAnimationFrame(() => {
    fitBoard();
    beginPreview();
  });
}

restartButton.addEventListener("click", startRound);
playAgainButton.addEventListener("click", startRound);

window.addEventListener("resize", fitBoard);

if ("ResizeObserver" in window && boardArea) {
  const boardResizeObserver = new ResizeObserver(fitBoard);
  boardResizeObserver.observe(boardArea);
}

document.addEventListener("DOMContentLoaded", startRound);
