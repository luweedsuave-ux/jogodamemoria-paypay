const items = [
  { name: "morcego", image: "./Assets/card-1.png" },
  { name: "sapo-flor", image: "./Assets/card-2.png" },
  { name: "xadrez", image: "./Assets/card-4.png" },
  { name: "praia", image: "./Assets/card-5.png" },
  { name: "lago", image: "./Assets/card-7.png" },
  { name: "gogreen", image: "./Assets/card-8.png" }
];

const PREVIEW_SECONDS = 3;
const ROUND_MS = 15_000;
const FLIP_READY_DELAY_MS = 520;
const HIGHSCORE_LIMIT = 10;
const HIGHSCORE_STORAGE_KEY = "paypay_memory_highscores_v1";

const gameContainer = document.getElementById("game-container");
const boardArea = document.getElementById("board-area");
const timeValue = document.getElementById("time");
const pairsValue = document.getElementById("pairs-count");
const restartButton = document.getElementById("restart");
const roundMessage = document.getElementById("round-message");
const previewCountdown = document.getElementById("preview-countdown");
const startOverlay = document.getElementById("start-overlay");
const resultOverlay = document.getElementById("result-overlay");
const startGameButton = document.getElementById("start-game");
const playAgainButton = document.getElementById("play-again");
const resultTitle = document.getElementById("result-title");
const resultText = document.getElementById("result-text");
const scoreForm = document.getElementById("score-form");
const playerNameInput = document.getElementById("player-name");
const highscoresBody = document.getElementById("highscores-body");
const emptyHighscores = document.getElementById("empty-highscores");

let cards = [];
let previewInterval = null;
let previewTimeout = null;
let gameAnimationFrame = null;
let firstCard = null;
let secondCard = null;
let lockBoard = true;
let gameActive = false;
let roundFinished = false;
let pairsFound = 0;
let roundStartTime = null;
let elapsedMs = 0;
let pendingScoreMs = null;
let scoreSaved = false;
let roundToken = 0;

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

function formatTime(ms) {
  const safeMs = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const milliseconds = safeMs % 1_000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function updatePairs() {
  pairsValue.innerHTML = `<span class="stat-label">Pares encontrados:</span><strong class="stat-value">${pairsFound}/${items.length}</strong>`;
}

function updateTime(remainingMs = ROUND_MS) {
  timeValue.innerHTML = `<span class="stat-label">Tempo restante:</span><strong class="stat-value">${formatTime(remainingMs)}</strong>`;
}

function resetTurn() {
  firstCard = null;
  secondCard = null;
  if (gameActive && !roundFinished) lockBoard = false;
}

function setCardsDisabled(disabled) {
  cards.forEach(card => {
    card.disabled = disabled || card.classList.contains("matched");
  });
}

function clearRoundTimers() {
  clearInterval(previewInterval);
  clearTimeout(previewTimeout);
  if (gameAnimationFrame !== null) {
    cancelAnimationFrame(gameAnimationFrame);
    gameAnimationFrame = null;
  }
}

function getHighscores() {
  try {
    const stored = JSON.parse(localStorage.getItem(HIGHSCORE_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];

    return stored
      .filter(entry => entry && Number.isFinite(entry.timeMs) && typeof entry.name === "string")
      .map(entry => ({
        name: entry.name.trim().slice(0, 16) || "Jogador",
        timeMs: Math.max(0, Math.round(entry.timeMs)),
        createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : 0
      }))
      .sort((a, b) => a.timeMs - b.timeMs || a.createdAt - b.createdAt)
      .slice(0, HIGHSCORE_LIMIT);
  } catch {
    return [];
  }
}

function saveHighscores(scores) {
  localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(scores.slice(0, HIGHSCORE_LIMIT)));
}

function qualifiesForHighscore(timeMs) {
  const scores = getHighscores();
  if (scores.length < HIGHSCORE_LIMIT) return true;
  return timeMs < scores[scores.length - 1].timeMs;
}

function renderHighscores() {
  const scores = getHighscores();
  highscoresBody.innerHTML = "";

  if (!scores.length) {
    emptyHighscores.classList.remove("hide");
    document.querySelector(".highscores-table-wrap")?.classList.add("hide");
    return;
  }

  emptyHighscores.classList.add("hide");
  document.querySelector(".highscores-table-wrap")?.classList.remove("hide");

  scores.forEach((entry, index) => {
    const row = document.createElement("tr");

    const positionCell = document.createElement("td");
    positionCell.textContent = String(index + 1);

    const nameCell = document.createElement("td");
    nameCell.textContent = entry.name;

    const timeCell = document.createElement("td");
    timeCell.textContent = formatTime(entry.timeMs);

    row.append(positionCell, nameCell, timeCell);
    highscoresBody.appendChild(row);
  });
}

function showScoreForm(timeMs) {
  pendingScoreMs = timeMs;
  scoreSaved = false;
  playerNameInput.value = "";
  scoreForm.classList.remove("hide");
  window.setTimeout(() => playerNameInput.focus(), 120);
}

function hideScoreForm() {
  scoreForm.classList.add("hide");
  pendingScoreMs = null;
}

function finishRound(completed = pairsFound === items.length, completionMs = null) {
  if (roundFinished) return;

  roundFinished = true;
  gameActive = false;
  lockBoard = true;
  clearRoundTimers();
  setCardsDisabled(true);

  if (completed && roundStartTime !== null) {
    elapsedMs = Math.min(ROUND_MS, completionMs ?? (performance.now() - roundStartTime));
    updateTime(Math.max(0, ROUND_MS - elapsedMs));
    resultTitle.textContent = "Parabéns!";
    resultText.textContent = `Você encontrou os 6 pares em ${formatTime(elapsedMs)}.`;

    if (qualifiesForHighscore(elapsedMs)) {
      showScoreForm(elapsedMs);
    } else {
      hideScoreForm();
    }
  } else {
    resultTitle.textContent = "Tempo esgotado!";
    const pairWord = pairsFound === 1 ? "par" : "pares";
    resultText.textContent = `Você acertou ${pairsFound} ${pairWord}. Complete os 6 pares para entrar no ranking.`;
    hideScoreForm();
  }

  renderHighscores();
  resultOverlay.classList.remove("hide");
}

function gameTimerLoop(now) {
  if (!gameActive || roundFinished || roundStartTime === null) return;

  elapsedMs = now - roundStartTime;
  const remainingMs = Math.max(0, ROUND_MS - elapsedMs);
  updateTime(remainingMs);

  if (remainingMs <= 0) {
    updateTime(0);
    finishRound(false);
    return;
  }

  gameAnimationFrame = requestAnimationFrame(gameTimerLoop);
}

function startGameTimer() {
  elapsedMs = 0;
  roundStartTime = performance.now();
  updateTime(ROUND_MS);
  gameAnimationFrame = requestAnimationFrame(gameTimerLoop);
}

function handleCardClick(card) {
  if (!gameActive || roundFinished || lockBoard || card.classList.contains("matched") || card === firstCard) return;

  card.classList.add("flipped");

  if (!firstCard) {
    firstCard = card;
    return;
  }

  secondCard = card;
  lockBoard = true;
  const tokenAtClick = roundToken;

  if (firstCard.dataset.cardValue === secondCard.dataset.cardValue) {
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    firstCard.disabled = true;
    secondCard.disabled = true;
    pairsFound += 1;
    updatePairs();

    if (pairsFound === items.length) {
      const completionMs = roundStartTime === null ? ROUND_MS : performance.now() - roundStartTime;

      if (completionMs <= ROUND_MS) {
        finishRound(true, completionMs);
      } else {
        finishRound(false);
      }
      return;
    }

    window.setTimeout(() => {
      if (tokenAtClick !== roundToken) return;
      resetTurn();
    }, 180);
  } else {
    window.setTimeout(() => {
      if (tokenAtClick !== roundToken) return;
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
  const tokenAtStart = roundToken;
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
    if (tokenAtStart !== roundToken) return;

    clearInterval(previewInterval);
    cards.forEach(card => card.classList.remove("preview"));
    roundMessage.classList.add("ready");
    roundMessage.firstElementChild.textContent = "Valendo! Você tem 15 segundos";
    previewCountdown.style.display = "none";

    window.setTimeout(() => {
      if (tokenAtStart !== roundToken) return;
      lockBoard = false;
      gameActive = true;
      setCardsDisabled(false);
      startGameTimer();
    }, FLIP_READY_DELAY_MS);
  }, PREVIEW_SECONDS * 1000);
}

function startRound() {
  roundToken += 1;
  clearRoundTimers();
  resultOverlay.classList.add("hide");
  hideScoreForm();

  pairsFound = 0;
  firstCard = null;
  secondCard = null;
  lockBoard = true;
  gameActive = false;
  roundFinished = false;
  roundStartTime = null;
  elapsedMs = 0;
  scoreSaved = false;

  updatePairs();
  updateTime(ROUND_MS);
  createBoard();

  requestAnimationFrame(() => {
    fitBoard();
    beginPreview();
  });
}

function openStartMenu() {
  roundToken += 1;
  clearRoundTimers();
  gameActive = false;
  roundFinished = false;
  lockBoard = true;
  startOverlay.classList.remove("hide");
  resultOverlay.classList.add("hide");
  updateTime(ROUND_MS);
}

scoreForm.addEventListener("submit", event => {
  event.preventDefault();
  if (pendingScoreMs === null || scoreSaved) return;

  const name = playerNameInput.value.trim().replace(/\s+/g, " ").slice(0, 16);
  if (!name) {
    playerNameInput.focus();
    return;
  }

  const scores = getHighscores();

  // Reconfere no momento de salvar caso a tabela tenha mudado.
  if (scores.length >= HIGHSCORE_LIMIT && pendingScoreMs >= scores[scores.length - 1].timeMs) {
    hideScoreForm();
    renderHighscores();
    return;
  }

  scores.push({
    name,
    timeMs: Math.round(pendingScoreMs),
    createdAt: Date.now()
  });

  scores.sort((a, b) => a.timeMs - b.timeMs || a.createdAt - b.createdAt);
  saveHighscores(scores);
  scoreSaved = true;
  hideScoreForm();
  renderHighscores();
});

startGameButton.addEventListener("click", () => {
  startOverlay.classList.add("hide");
  startRound();
});

playAgainButton.addEventListener("click", startRound);
restartButton.addEventListener("click", startRound);
window.addEventListener("resize", fitBoard);

if ("ResizeObserver" in window && boardArea) {
  const boardResizeObserver = new ResizeObserver(fitBoard);
  boardResizeObserver.observe(boardArea);
}

document.addEventListener("DOMContentLoaded", () => {
  updatePairs();
  updateTime(ROUND_MS);
  renderHighscores();
  openStartMenu();
});
