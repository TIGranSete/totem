// ---------- Config ----------
const PAIRS = [
  { code: "USD-BRL", key: "USDBRL", label: "USD/BRL", flag: "US$" },
  { code: "EUR-BRL", key: "EURBRL", label: "EUR/BRL", flag: "€" },
  { code: "GBP-BRL", key: "GBPBRL", label: "GBP/BRL", flag: "£" },
];

const COMMODITIES = [
  { slug: "soja", label: "SOJA" },
  { slug: "milho", label: "MILHO" },
  { slug: "algodao", label: "ALGODÃO" },
];
const COMMODITIES_REFRESH_MS = 30 * 60 * 1000;

const REFRESH_MS = 45000;
const MAX_INTRADAY_POINTS = 80;
const API_LAST = "https://economia.awesomeapi.com.br/last/" + PAIRS.map(p => p.code).join(",");

// per-pair state
const state = {};
PAIRS.forEach(p => {
  state[p.key] = { intraday: [], daily: null, mode: "historico" };
});

// ---------- Clock ----------
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

function tickClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("clock-time").textContent = `${hh}:${mm}:${ss}`;
  document.getElementById("clock-date").textContent =
    `${WEEKDAYS[now.getDay()]}., ${String(now.getDate()).padStart(2,"0")} DE ${MONTHS[now.getMonth()]} DE ${now.getFullYear()}`;
}
tickClock();
setInterval(tickClock, 1000);

// ---------- Card DOM ----------
function buildCardSkeleton(pair) {
  const el = document.createElement("div");
  el.className = "card";
  el.id = `card-${pair.key}`;
  el.innerHTML = `
    <div class="card-stats">
      <div class="stat"><div class="label">COMPRA</div><div class="value stat-bid">--</div></div>
      <div class="stat"><div class="label">VENDA</div><div class="value stat-ask">--</div></div>
      <div class="stat"><div class="label">MÁXIMO</div><div class="value stat-high">--</div></div>
      <div class="stat"><div class="label">MÍNIMO</div><div class="value stat-low">--</div></div>
      <div class="stat variacao"><div class="label">VARIAÇÃO</div><div class="value stat-var">--</div></div>
    </div>
    <div class="card-main">
      <div>
        <div class="pair-name">${pair.label}</div>
        <div class="pair-value stat-price">R$ --</div>
      </div>
    </div>
    <svg class="chart" viewBox="0 0 400 130" preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-${pair.key}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4CAF50" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#4CAF50" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="area" fill="url(#grad-${pair.key})" d=""></path>
      <path class="line" fill="none" stroke="#4CAF50" stroke-width="2" d=""></path>
    </svg>
    <div class="card-foot">
      <div class="mode-toggle">
        <button class="mode-btn" data-mode="intraday">INTRADAY</button>
        <button class="mode-btn active" data-mode="historico">HISTÓRICO</button>
      </div>
      <div class="live-ref"><span class="dot"></span><span class="live-ref-text">LIVE REF: --:--</span></div>
    </div>
  `;
  el.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => setCardMode(pair, btn.dataset.mode));
  });
  return el;
}

function setCardMode(pair, mode) {
  state[pair.key].mode = mode;
  const card = document.getElementById(`card-${pair.key}`);
  card.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  if (mode === "historico" && !state[pair.key].daily) {
    fetchDaily(pair);
  } else {
    renderChart(pair);
  }
}

const cardsContainer = document.getElementById("cards");
PAIRS.forEach(p => cardsContainer.appendChild(buildCardSkeleton(p)));

// ---------- Commodity cards ----------
function buildCommodityCardSkeleton(c) {
  const el = document.createElement("div");
  el.className = "commodity-card";
  el.id = `card-${c.slug}`;
  el.innerHTML = `
    <div class="pair-name">${c.label} · --</div>
    <div class="pair-value commodity-value">--</div>
    <div class="commodity-foot">
      <span class="ticker-badge commodity-var">--</span>
      <span class="commodity-date">--</span>
    </div>
  `;
  return el;
}

const commodityCardsContainer = document.getElementById("commodity-cards");
COMMODITIES.forEach(c => commodityCardsContainer.appendChild(buildCommodityCardSkeleton(c)));

// ---------- Ticker ----------
function renderTicker(data) {
  const ticker = document.getElementById("ticker-currencies");
  ticker.innerHTML = "";
  PAIRS.forEach(p => {
    const d = data[p.key];
    if (!d) return;
    const up = parseFloat(d.pctChange) >= 0;
    const item = document.createElement("div");
    item.className = "ticker-item";
    item.innerHTML = `
      <span class="name">${p.label}</span>
      <span class="price">R$ ${formatPrice(d.bid, p.key)}</span>
      <span class="ticker-badge ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(parseFloat(d.pctChange)).toFixed(2)}%</span>
    `;
    ticker.appendChild(item);
  });
}

function renderCommodityTicker(data) {
  const ticker = document.getElementById("ticker-commodities");
  ticker.innerHTML = "";
  COMMODITIES.forEach(c => {
    const d = data[c.slug];
    if (!d) return;
    const up = !d.variation.trim().startsWith("-");
    const item = document.createElement("div");
    item.className = "ticker-item";
    item.innerHTML = `
      <span class="name">${d.label}</span>
      <span class="price">${d.value}</span>
      <span class="ticker-badge ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${d.variation.replace("-", "")}</span>
    `;
    ticker.appendChild(item);
  });
}

// ---------- Formatting ----------
function formatPrice(value, key) {
  const n = parseFloat(value);
  if (isNaN(n)) return "--";
  const digits = n < 1 ? 5 : 2;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// ---------- Chart rendering ----------
function buildPath(points) {
  if (points.length < 2) return { line: "", area: "" };
  const w = 400, h = 130, pad = 6;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = (max - min) || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y];
  });
  const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
  const area = line + ` L${coords[coords.length - 1][0].toFixed(1)},${h - pad} L${coords[0][0].toFixed(1)},${h - pad} Z`;
  return { line, area };
}

function renderChart(pair) {
  const card = document.getElementById(`card-${pair.key}`);
  const s = state[pair.key];
  const points = s.mode === "intraday"
    ? s.intraday.map(pt => pt.bid)
    : (s.daily || []).map(pt => parseFloat(pt.bid)).reverse();
  const { line, area } = buildPath(points);
  card.querySelector("path.line").setAttribute("d", line);
  card.querySelector("path.area").setAttribute("d", area);
}

// ---------- Data fetching ----------
async function fetchLast() {
  try {
    const res = await fetch(API_LAST);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    applyLast(data);
  } catch (err) {
    console.error("Erro ao buscar cotações:", err);
  }
}

function applyLast(data) {
  const now = new Date();
  const refTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  document.getElementById("last-update-ref").textContent = `REF: ${refTime}:${String(now.getSeconds()).padStart(2,"0")}`;

  PAIRS.forEach(p => {
    const d = data[p.key];
    if (!d) return;
    const s = state[p.key];
    const bid = parseFloat(d.bid);

    s.intraday.push({ t: now, bid });
    if (s.intraday.length > MAX_INTRADAY_POINTS) s.intraday.shift();

    const card = document.getElementById(`card-${p.key}`);
    const up = parseFloat(d.pctChange) >= 0;
    card.querySelector(".stat-bid").textContent = formatPrice(d.bid, p.key);
    card.querySelector(".stat-ask").textContent = formatPrice(d.ask, p.key);
    card.querySelector(".stat-high").textContent = formatPrice(d.high, p.key);
    card.querySelector(".stat-low").textContent = formatPrice(d.low, p.key);
    const varEl = card.querySelector(".stat-var");
    varEl.textContent = `${up ? "↑" : "↓"} ${Math.abs(parseFloat(d.pctChange)).toFixed(2)}%`;
    varEl.classList.toggle("up", up);
    varEl.classList.toggle("down", !up);
    card.querySelector(".stat-price").textContent = `R$ ${formatPrice(d.bid, p.key)}`;
    card.querySelector(".live-ref-text").textContent = `LIVE REF: ${refTime}`;

    if (s.mode === "intraday") renderChart(p);
  });

  renderTicker(data);
}

async function fetchDaily(pair) {
  try {
    const res = await fetch(`https://economia.awesomeapi.com.br/json/daily/${pair.code}/30`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    state[pair.key].daily = data;
    if (state[pair.key].mode === "historico") renderChart(pair);
  } catch (err) {
    console.error(`Erro ao buscar histórico de ${pair.code}:`, err);
  }
}

async function fetchCommodities() {
  try {
    const res = await fetch("/api/commodities");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    applyCommodities(data);
  } catch (err) {
    console.error("Erro ao buscar commodities agrícolas:", err);
  }
}

function applyCommodities(data) {
  const now = new Date();
  const refTime = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  document.getElementById("commodities-update-ref").textContent = `REF: ${refTime}`;

  COMMODITIES.forEach(c => {
    const d = data[c.slug];
    const card = document.getElementById(`card-${c.slug}`);
    if (!d) {
      card.querySelector(".pair-name").textContent = `${c.label} · INDISPONÍVEL`;
      return;
    }
    const up = !d.variation.trim().startsWith("-");
    card.querySelector(".pair-name").textContent = `${c.label} · ${d.unit}`;
    card.querySelector(".commodity-value").textContent = `${d.prefix || ""}${d.value}`;
    const varEl = card.querySelector(".commodity-var");
    varEl.textContent = `${up ? "▲" : "▼"} ${d.variation.replace("-", "")}`;
    varEl.classList.toggle("up", up);
    varEl.classList.toggle("down", !up);
    card.querySelector(".commodity-date").textContent = `${d.source} · ${d.date}`;
  });

  renderCommodityTicker(data);
}

document.getElementById("year").textContent = new Date().getFullYear();

// ---------- Idle video (attract mode) ----------
const IDLE_MS = 1 * 60 * 1000;
const idleOverlay = document.getElementById("idle-video");
const idleVideoEl = document.getElementById("idle-video-el");
let idleTimer = null;

function positionIdleOverlay() {
  const tickerBottom = document.querySelector(".ticker-wrap").getBoundingClientRect().bottom;
  idleOverlay.style.top = Math.max(tickerBottom, 0) + "px";
}

async function enterIdleVideo() {
  idleVideoEl.currentTime = 0;
  idleVideoEl.muted = false;
  try {
    await idleVideoEl.play();
  } catch (err) {
    idleVideoEl.muted = true;
    try {
      await idleVideoEl.play();
    } catch (e) {
      console.error("Não foi possível iniciar o vídeo:", e);
      resetIdleTimer();
      return;
    }
  }
  positionIdleOverlay();
  idleOverlay.classList.add("show");
  document.body.classList.add("video-playing");
}

function exitIdleVideo() {
  document.body.classList.remove("video-playing");
  if (!idleOverlay.classList.contains("show")) return;
  idleOverlay.classList.remove("show");
  idleVideoEl.pause();
}

function resetIdleTimer() {
  exitIdleVideo();
  clearTimeout(idleTimer);
  idleTimer = setTimeout(enterIdleVideo, IDLE_MS);
}

idleVideoEl.addEventListener("ended", resetIdleTimer);
idleVideoEl.addEventListener("error", () => {
  console.warn('Vídeo não encontrado. Coloque o arquivo "video.mp4" na pasta do projeto.');
  resetIdleTimer();
});
window.addEventListener("resize", () => {
  if (idleOverlay.classList.contains("show")) positionIdleOverlay();
});

["click", "touchstart", "mousemove", "keydown"].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});
resetIdleTimer();

// ---------- Boot ----------
fetchLast();
setInterval(fetchLast, REFRESH_MS);
PAIRS.forEach(p => fetchDaily(p));

fetchCommodities();
setInterval(fetchCommodities, COMMODITIES_REFRESH_MS);
