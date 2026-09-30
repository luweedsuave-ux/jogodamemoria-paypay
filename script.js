const items = [
  { name: "morcego", image: "./Assets/card-1.png" },
  { name: "sapo-flor", image: "./Assets/card-2.png" },
  { name: "xadrez", image: "./Assets/card-4.png" },
  { name: "praia", image: "./Assets/card-5.png" },
  { name: "lago", image: "./Assets/card-7.png" },
  { name: "gogreen", image: "./Assets/card-8.png" }
];

const PREVIEW_SECONDS = 5;
const ROUND_SECONDS = 15;
const NEXT_ROUND_DELAY = 1200;

const gameContainer = document.getElementById("game-container");
const boardArea = document.getElementById("board-area");
const timeValue = document.getElementById("time");
const pairsValue = document.getElementById("pairs-count");
const restartButton = document.getElementById("restart");
const roundMessage = document.getElementById("round-message");
const previewCountdown = document.getElementById("preview-countdown");

let cards = [];
let gameInterval = null;
let previewInterval = null;
let previewTimeout = null;
let nextRoundTimeout = null;
let firstCard = null;
let secondCard = null;
let lockBoard = true;
let gameActive = false;
let timeRemaining = ROUND_SECONDS;
let pairsFound = 0;

function fitBoard() {
  if (!boardArea || !gameContainer) return;

  const width = boardArea.clientWidth;
  const height = boardArea.clientHeight;
  if (!width || !height) return;

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

function updatePairs() {
  pairsValue.innerHTML = `<span class="stat-label">Pares encontrados:</span><strong class="stat-value">${pairsFound}/${items.length}</strong>`;
}

function updateTime() {
  timeValue.innerHTML = `<span class="stat-label">Tempo restante:</span><strong class="stat-value">${timeRemaining}</strong>`;
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

function clearRoundTimers() {
  clearInterval(gameInterval);
  clearInterval(previewInterval);
  clearTimeout(previewTimeout);
  clearTimeout(nextRoundTimeout);
}

function scheduleNextRound(message, won = false) {
  if (!gameActive && !won) return;

  gameActive = false;
  lockBoard = true;
  clearInterval(gameInterval);
  setCardsDisabled(true);

  roundMessage.classList.add("ready");
  roundMessage.firstElementChild.textContent = message;
  previewCountdown.style.display = "none";

  nextRoundTimeout = setTimeout(startRound, NEXT_ROUND_DELAY);
}

function finishByTime() {
  timeRemaining = 0;
  updateTime();
  scheduleNextRound(`Tempo esgotado — ${pairsFound}/${items.length} pares`);
}

function startGameTimer() {
  timeRemaining = ROUND_SECONDS;
  updateTime();

  gameInterval = setInterval(() => {
    timeRemaining -= 1;
    updateTime();

    if (timeRemaining <= 0) {
      finishByTime();
    }
  }, 1000);
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

  if (firstCard.dataset.cardValue === secondCard.dataset.cardValue) {
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    firstCard.disabled = true;
    secondCard.disabled = true;
    pairsFound += 1;
    updatePairs();

    if (pairsFound === items.length) {
      clearInterval(gameInterval);
      window.setTimeout(() => scheduleNextRound("Você encontrou os 6 pares!", true), 280);
      return;
    }

    window.setTimeout(resetTurn, 220);
  } else {
    window.setTimeout(() => {
      firstCard?.classList.remove("flipped");
      secondCard?.classList.remove("flipped");
      resetTurn();
    }, 650);
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
  previewCountdown.style.display = "inline-grid";
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
    roundMessage.firstElementChild.textContent = "Valendo! Você tem 15 segundos";
    previewCountdown.style.display = "none";

    setTimeout(() => {
      lockBoard = false;
      gameActive = true;
      setCardsDisabled(false);
      startGameTimer();
    }, 520);
  }, PREVIEW_SECONDS * 1000);
}

function startRound() {
  clearRoundTimers();

  timeRemaining = ROUND_SECONDS;
  pairsFound = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = true;
  gameActive = false;

  updatePairs();
  updateTime();
  createBoard();

  requestAnimationFrame(() => {
    fitBoard();
    beginPreview();
  });
}

restartButton.addEventListener("click", startRound);
window.addEventListener("resize", fitBoard);

if ("ResizeObserver" in window && boardArea) {
  const boardResizeObserver = new ResizeObserver(fitBoard);
  boardResizeObserver.observe(boardArea);
}

document.addEventListener("DOMContentLoaded", startRound);
