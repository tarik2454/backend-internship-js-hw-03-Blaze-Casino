const API_URL = window.API_URL;
let accessToken = localStorage.getItem("accessToken");
let refreshToken = localStorage.getItem("refreshToken");
let currentUser = null;
let currentMinesGameId = null;
let isRefreshing = false;
let refreshPromise = null;

function escapeHtml(text) {
  if (typeof text !== "string") {
    return String(text);
  }
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const userInfoEl = document.getElementById("user-info");
userInfoEl.innerHTML = '<div style="padding: 1rem;">Loading...</div>';
const casesGrid = document.getElementById("cases-grid");
const toastEl = document.getElementById("toast");
const logoutBtn = document.getElementById("logout-btn");
const toggleAuthBtn = document.getElementById("toggle-auth");
const authTitle = document.getElementById("auth-title");

const tabCases = document.getElementById("tab-cases");
const tabMines = document.getElementById("tab-mines");
const tabBonus = document.getElementById("tab-bonus");
const tabCrash = document.getElementById("tab-crash");
const tabLeaderboard = document.getElementById("tab-leaderboard");
const tabChat = document.getElementById("tab-chat");
const tabAudit = document.getElementById("tab-audit");
const casesView = document.getElementById("cases-view");
const minesView = document.getElementById("mines-view");
const bonusView = document.getElementById("bonus-view");
const crashView = document.getElementById("crash-view");
const leaderboardView = document.getElementById("leaderboard-view");
const chatView = document.getElementById("chat-view");
const auditView = document.getElementById("audit-view");

const minesAmountInput = document.getElementById("mines-amount");
const minesCountInput = document.getElementById("mines-count");
const minesStartBtn = document.getElementById("mines-start-btn");
const minesCashoutBtn = document.getElementById("mines-cashout-btn");
const minesGrid = document.getElementById("mines-grid");
const minesInfo = document.getElementById("mines-info");
const minesNextMult = document.getElementById("mines-next-mult");
const minesCurrentWin = document.getElementById("mines-current-win");
const minesHistoryTable = document.getElementById("mines-history-table");
const casesHistoryTable = document.getElementById("cases-history-table");

function init() {
  if (accessToken) {
    showMain();
    loadUser();
  } else {
    showAuth();
  }
}

async function login(email, password) {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    showMain();
    await loadUser();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function register(username, email, password) {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const contentType = res.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await res.json();
    } else {
      await res.text();
      throw new Error("Server returned non-JSON response");
    }

    if (!res.ok) throw new Error(data.message || "Registration failed");

    await login(email, password);
  } catch (err) {
    showToast(err.message, true);
  }
}

window.addEventListener("balance:update", (event) => {
  if (event.detail && event.detail.newBalance !== undefined) {
    const newBalance = event.detail.newBalance;
    if (currentUser) {
      currentUser.balance = newBalance;
      window.currentUser = currentUser;
      renderUser();
    } else {
      loadUser();
    }
  } else {
    loadUser();
  }
});

async function refreshTokens() {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to refresh tokens");
      }

      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);

      return accessToken;
    } catch (err) {
      accessToken = null;
      refreshToken = null;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      throw err;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function getAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  if (refreshToken) {
    try {
      await refreshTokens();
      return accessToken;
    } catch (err) {
      return null;
    }
  }

  return null;
}

async function authenticatedFetch(url, options = {}) {
  let token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = {
    ...options.headers,
    Authorization: `Bearer ${token}`,
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401 && refreshToken && !isRefreshing) {
    try {
      await refreshTokens();
      token = accessToken;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        res = await fetch(url, { ...options, headers });
      } else {
        logout();
        throw new Error("Session expired. Please login again.");
      }
    } catch (err) {
      logout();
      throw new Error("Session expired. Please login again.");
    }
  }

  return res;
}

async function loadUser() {
  try {
    const res = await authenticatedFetch(`${API_URL}/users/current`);
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        return;
      }
      throw new Error("Failed to load user");
    }
    currentUser = await res.json();
    window.currentUser = currentUser;
    renderUser();
    loadCases();
    loadCasesHistory();
    checkActiveMinesGame();
  } catch (err) {
    showToast("Failed to load user: " + err.message, true);
    if (
      err.message.includes("Not authenticated") ||
      err.message.includes("Session expired")
    ) {
      logout();
    }
  }
}

async function logout() {
  if (accessToken) {
    try {
      await authenticatedFetch(`${API_URL}/auth/logout`, {
        method: "POST",
      });
    } catch (err) {}
  }

  accessToken = null;
  refreshToken = null;
  currentUser = null;
  window.currentUser = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  showAuth();
}

const tabPlinko = document.getElementById("tab-plinko");
const plinkoView = document.getElementById("plinko-view");

function switchTab(tab) {
  tabCases.classList.remove("active");
  tabCases.classList.add("secondary");
  casesView.classList.add("hidden");

  tabMines.classList.remove("active");
  tabMines.classList.add("secondary");
  minesView.classList.add("hidden");

  if (tabPlinko) {
    tabPlinko.classList.remove("active");
    tabPlinko.classList.add("secondary");
    plinkoView.classList.add("hidden");
  }

  if (tabCrash) {
    tabCrash.classList.remove("active");
    tabCrash.classList.add("secondary");
    crashView.classList.add("hidden");
    document.dispatchEvent(new CustomEvent("crash:hidden"));
  }

  if (tabBonus) {
    tabBonus.classList.remove("active");
    tabBonus.classList.add("secondary");
    bonusView.classList.add("hidden");
  }

  if (tabLeaderboard) {
    tabLeaderboard.classList.remove("active");
    tabLeaderboard.classList.add("secondary");
    leaderboardView.classList.add("hidden");
    document.dispatchEvent(new CustomEvent("leaderboard:hidden"));
  }

  if (tabChat) {
    tabChat.classList.remove("active");
    tabChat.classList.add("secondary");
    chatView.classList.add("hidden");
    document.dispatchEvent(new CustomEvent("chat:hidden"));
  }

  if (tabAudit) {
    tabAudit.classList.remove("active");
    tabAudit.classList.add("secondary");
    auditView.classList.add("hidden");
  }

  if (tab === "cases") {
    tabCases.classList.add("active");
    tabCases.classList.remove("secondary");
    casesView.classList.remove("hidden");
    loadCasesHistory();
  } else if (tab === "mines") {
    tabMines.classList.add("active");
    tabMines.classList.remove("secondary");
    minesView.classList.remove("hidden");
    if (minesGrid.children.length === 0) {
      renderMinesGrid();
    }
    loadMinesHistory();
  } else if (tab === "plinko") {
    if (tabPlinko) {
      tabPlinko.classList.add("active");
      tabPlinko.classList.remove("secondary");
      plinkoView.classList.remove("hidden");
      const event = new Event("plinko:shown");
      document.dispatchEvent(event);
    }
  } else if (tab === "crash") {
    if (tabCrash) {
      tabCrash.classList.add("active");
      tabCrash.classList.remove("secondary");
      crashView.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("crash:shown"));
    }
  } else if (tab === "bonus") {
    if (tabBonus) {
      tabBonus.classList.add("active");
      tabBonus.classList.remove("secondary");
      bonusView.classList.remove("hidden");
      const event = new Event("bonus:shown");
      document.dispatchEvent(event);
    }
  } else if (tab === "leaderboard") {
    if (tabLeaderboard) {
      tabLeaderboard.classList.add("active");
      tabLeaderboard.classList.remove("secondary");
      leaderboardView.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("leaderboard:shown"));
    }
  } else if (tab === "chat") {
    if (tabChat && chatView) {
      tabChat.classList.add("active");
      tabChat.classList.remove("secondary");
      chatView.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("chat:shown"));
    }
  } else if (tab === "audit") {
    if (tabAudit) {
      tabAudit.classList.add("active");
      tabAudit.classList.remove("secondary");
      auditView.classList.remove("hidden");
      document.dispatchEvent(new CustomEvent("audit:shown"));
    }
  }
}

tabCases.addEventListener("click", () => switchTab("cases"));
tabMines.addEventListener("click", () => switchTab("mines"));
if (tabPlinko) tabPlinko.addEventListener("click", () => switchTab("plinko"));
if (tabCrash) tabCrash.addEventListener("click", () => switchTab("crash"));
if (tabBonus) tabBonus.addEventListener("click", () => switchTab("bonus"));
if (tabLeaderboard)
  tabLeaderboard.addEventListener("click", () => switchTab("leaderboard"));
if (tabChat) tabChat.addEventListener("click", () => switchTab("chat"));
if (tabAudit) tabAudit.addEventListener("click", () => switchTab("audit"));

async function loadCases() {
  try {
    const res = await authenticatedFetch(`${API_URL}/cases`);
    if (!res.ok) {
      throw new Error("Failed to load cases");
    }
    const data = await res.json();
    renderCases(data.cases);
  } catch (err) {
    showToast("Failed to load cases: " + err.message, true);
  }
}

async function openCase(id) {
  try {
    const caseRes = await authenticatedFetch(`${API_URL}/cases/${id}`);
    if (!caseRes.ok) throw new Error("Failed to load case details");
    const caseData = await caseRes.json();
    const casePrice = caseData.price;

    if (!currentUser || currentUser.balance < casePrice) {
      showToast("Insufficient balance", true);
      return;
    }

    if (currentUser) {
      currentUser.balance -= casePrice;
      if (typeof window.renderUser === "function") {
        window.renderUser();
      }
      window.dispatchEvent(
        new CustomEvent("balance:update", {
          detail: { newBalance: currentUser.balance },
          bubbles: true,
        })
      );
    }

    const res = await authenticatedFetch(`${API_URL}/cases/${id}/open`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      if (currentUser) {
        currentUser.balance += casePrice;
        if (typeof window.renderUser === "function") {
          window.renderUser();
        }
      }
      throw new Error(data.message || "Failed to open case");
    }

    if (data.newBalance !== undefined && currentUser) {
      currentUser.balance = data.newBalance;
      if (typeof window.renderUser === "function") {
        window.renderUser();
      }
      window.dispatchEvent(
        new CustomEvent("balance:update", {
          detail: { newBalance: currentUser.balance },
          bubbles: true,
        })
      );
    } else {
      await loadUser();
    }

    showWinModal(data.item, caseData.items);
    loadCasesHistory();
  } catch (err) {
    showToast(err.message, true);
  }
}

window.openCase = openCase;

async function checkActiveMinesGame() {
  try {
    const res = await authenticatedFetch(`${API_URL}/mines/active`);
    const data = await res.json();

    if (data.game) {
      currentMinesGameId = data.game._id;
      updateMinesUI(data.game);
      showToast("Restored active Mines game");
    } else {
      currentMinesGameId = null;
      renderMinesGrid();
      updateMinesControls(false);
    }
  } catch (err) {}
}

async function startMinesGame() {
  try {
    const amount = parseFloat(minesAmountInput.value);
    const minesCount = parseInt(minesCountInput.value);

    const res = await authenticatedFetch(`${API_URL}/mines/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, minesCount }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to start game");

    currentMinesGameId = data.gameId;

    renderMinesGrid();
    updateMinesControls(true);

    if (data.multipliers && data.multipliers.length > 0) {
      minesNextMult.textContent = `${data.multipliers[0]}x`;
      minesCurrentWin.textContent = `$${amount.toFixed(2)}`;
    }

    loadUser();
    showToast("Game started!");
  } catch (err) {
    showToast(err.message, true);
  }
}

async function revealTile(position) {
  if (!currentMinesGameId) return;

  try {
    const res = await authenticatedFetch(`${API_URL}/mines/reveal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId: currentMinesGameId, position }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to reveal tile");

    const btn = minesGrid.children[position];

    if (data.isMine) {
      btn.classList.add("revealed-mine");
      btn.innerHTML = "💣";
      showToast("BOOM! Game Over", true);
      endMinesGame(data.minePositions);
      loadUser();
      loadMinesHistory();
    } else {
      btn.classList.add("revealed-safe");
      btn.innerHTML = "💎";
      btn.disabled = true;

      minesNextMult.textContent = `${data.currentMultiplier}x`;
      minesCurrentWin.textContent = `$${data.currentValue.toFixed(2)}`;

      if (data.status === "won") {
        showToast(`You Won $${data.winAmount}! 🎉`);
        endMinesGame();
        loadUser();
        loadMinesHistory();
      }
    }
  } catch (err) {
    showToast(err.message, true);
  }
}

async function cashoutMines() {
  if (!currentMinesGameId) return;

  try {
    const res = await authenticatedFetch(`${API_URL}/mines/cashout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ gameId: currentMinesGameId }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to cashout");

    showToast(`Cashed out $${data.winAmount}! 💰`);
    endMinesGame(data.minePositions);
    loadUser();
    loadMinesHistory();
  } catch (err) {
    showToast(err.message, true);
  }
}

function renderMinesGrid(revealedPositions = [], minePositions = []) {
  minesGrid.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const btn = document.createElement("button");
    btn.className = "mine-tile";
    btn.dataset.pos = i;

    if (revealedPositions.includes(i)) {
      btn.disabled = true;
      if (minePositions.includes(i)) {
        btn.classList.add("revealed-mine");
        btn.innerHTML = "💣";
      } else {
        btn.classList.add("revealed-safe");
        btn.innerHTML = "💎";
      }
    } else {
      btn.addEventListener("click", () => revealTile(i));
    }

    minesGrid.appendChild(btn);
  }
}

function updateMinesUI(game) {
  if (game.status === "active") {
    updateMinesControls(true);
    renderMinesGrid(game.revealedPositions);
    minesInfo.classList.remove("hidden");
  } else {
    updateMinesControls(false);
    renderMinesGrid(game.revealedPositions, game.minePositions);
  }
}

function updateMinesControls(isActive) {
  minesStartBtn.disabled = isActive;
  minesCashoutBtn.disabled = !isActive;
  minesAmountInput.disabled = isActive;
  minesCountInput.disabled = isActive;

  if (isActive) {
    minesInfo.classList.remove("hidden");
  } else {
    minesInfo.classList.add("hidden");
  }
}

function endMinesGame(allMines = []) {
  currentMinesGameId = null;
  updateMinesControls(false);

  if (allMines.length > 0) {
    allMines.forEach((pos) => {
      const btn = minesGrid.children[pos];
      if (btn && !btn.classList.contains("revealed-safe")) {
        btn.classList.add("revealed");
        btn.innerHTML = "💣";
        btn.style.opacity = "0.5";
      }
    });
  }

  Array.from(minesGrid.children).forEach((btn) => (btn.disabled = true));
}

async function loadMinesHistory() {
  try {
    const res = await authenticatedFetch(`${API_URL}/mines/history?limit=10`);
    const data = await res.json();
    renderMinesHistory(data.games);
  } catch (err) {}
}

function renderMinesHistory(games) {
  if (!games || games.length === 0) {
    minesHistoryTable.innerHTML =
      '<tr><td colspan="5" style="text-align: center; padding: 1rem; color: var(--text-dim);">No history yet</td></tr>';
    return;
  }

  minesHistoryTable.innerHTML = games
    .map((game) => {
      const date = new Date(game.createdAt).toLocaleString();
      const profit =
        game.status === "won"
          ? game.winAmount - game.betAmount
          : -game.betAmount;
      const profitClass =
        profit >= 0
          ? "color: var(--accent-success);"
          : "color: var(--accent-error);";
      const profitSign = profit >= 0 ? "+" : "";

      return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 0.75rem 1rem; color: var(--text-dim); font-size: 0.875rem;">${date}</td>
        <td style="padding: 0.75rem 1rem;">$${game.betAmount.toFixed(2)}</td>
        <td style="padding: 0.75rem 1rem;">${game.minesCount}</td>
        <td style="padding: 0.75rem 1rem;">${
          game.cashoutMultiplier ? game.cashoutMultiplier + "x" : "-"
        }</td>
        <td style="padding: 0.75rem 1rem; font-weight: 600; ${profitClass}">${profitSign}$${profit.toFixed(
        2
      )}</td>
      </tr>
    `;
    })
    .join("");
}

minesStartBtn.addEventListener("click", startMinesGame);
minesCashoutBtn.addEventListener("click", cashoutMines);

minesCountInput.addEventListener("change", () => {
  const val = parseInt(minesCountInput.value);
  if (val < 1) minesCountInput.value = 1;
  if (val > 24) minesCountInput.value = 24;
});

minesAmountInput.addEventListener("change", () => {
  const val = parseFloat(minesAmountInput.value);
  if (val < 0.1) minesAmountInput.value = 0.1;
});

function renderUser() {
  if (!currentUser) return;
  window.currentUser = currentUser;
  window.renderUser = renderUser;
  userInfoEl.innerHTML = `
    <div>
      <h2 style="font-size: 1.25rem; font-weight: 600;">${escapeHtml(
        currentUser.username
      )}</h2>
      <p style="color: var(--text-dim);">${escapeHtml(currentUser.email)}</p>
    </div>
      <div style="text-align: right;">
        <div style="font-size: 1.5rem; color: var(--accent-success); font-weight: 700;">$${currentUser.balance.toFixed(
          2
        )}</div>
        <div style="font-size: 0.875rem; color: var(--text-dim);">Balance</div>
    </div>
  `;
}

async function loadCasesHistory() {
  try {
    const res = await authenticatedFetch(`${API_URL}/cases/history?limit=10`);
    const data = await res.json();
    renderCasesHistory(data.openings);
  } catch (err) {}
}

function renderCasesHistory(openings) {
  if (!casesHistoryTable) return;

  if (!openings || openings.length === 0) {
    casesHistoryTable.innerHTML =
      '<tr><td colspan="6" style="text-align: center; padding: 1rem; color: var(--text-dim);">No history yet</td></tr>';
    return;
  }

  casesHistoryTable.innerHTML = openings
    .map((opening) => {
      const date = new Date(opening.createdAt).toLocaleString();
      const profit = opening.profit;
      const profitClass =
        profit >= 0
          ? "color: var(--accent-success);"
          : "color: var(--accent-error);";
      const profitSign = profit >= 0 ? "+" : "";

      return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
        <td style="padding: 0.75rem 1rem; color: var(--text-dim); font-size: 0.875rem;">${date}</td>
        <td style="padding: 0.75rem 1rem;">${escapeHtml(opening.caseName)}</td>
        <td style="padding: 0.75rem 1rem;">${escapeHtml(opening.itemName)}</td>
        <td style="padding: 0.75rem 1rem; text-transform: capitalize;">${escapeHtml(
          opening.itemRarity
        )}</td>
        <td style="padding: 0.75rem 1rem;">$${opening.itemValue.toFixed(2)}</td>
        <td style="padding: 0.75rem 1rem; font-weight: 600; ${profitClass}">${profitSign}$${profit.toFixed(
        2
      )}</td>
      </tr>
    `;
    })
    .join("");
}

function renderCases(cases) {
  if (!cases || cases.length === 0) {
    casesGrid.innerHTML = '<div class="card"><p>No cases available</p></div>';
    return;
  }

  const isValidUrl = (str) => {
    if (!str || typeof str !== "string") return false;
    return (
      str.startsWith("http://") ||
      str.startsWith("https://") ||
      str.startsWith("/")
    );
  };

  casesGrid.innerHTML = cases
    .map((c) => {
      const image = c.image || "";
      const imageHTML = isValidUrl(image)
        ? `<div class="case-img" style="background-image: url('${image}'); background-size: cover; background-position: center;"></div>`
        : `<div class="case-img" style="display: flex; align-items: center; justify-content: center; font-size: 4rem; background: rgba(255,255,255,0.1);">${
            image || "📦"
          }</div>`;

      return `
    <div class="card case-item">
      ${imageHTML}
      <h3 style="margin-bottom: 0.5rem;">${c.name || "Unknown"}</h3>
      <p style="color: var(--accent-success); font-weight: 600; margin-bottom: 1rem;">$${
        c.price || 0
      }</p>
      <button onclick="openCase('${c.id || ""}')">Open Case</button>
    </div>
  `;
    })
    .join("");
}

function showWinModal(winningItem, allItems = []) {
  const modal = document.createElement("div");
  modal.className = "win-modal-overlay";
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.9);
    display: flex; align-items: center; justify-content: center; z-index: 100;
    overflow-y: auto; padding: 2rem 1rem;
  `;

  const closeModal = () => {
    modal.remove();
  };

  const getRarityColor = (rarity) => {
    const colors = {
      Common: "#9E9E9E",
      Uncommon: "#4CAF50",
      Rare: "#2196F3",
      Epic: "#9C27B0",
      Legendary: "#F44336",
      Gold: "#FFD700",
    };
    return colors[rarity] || "#9E9E9E";
  };

  const isValidUrl = (str) => {
    if (!str || typeof str !== "string") return false;
    return (
      str.startsWith("http://") ||
      str.startsWith("https://") ||
      str.startsWith("/")
    );
  };

  const itemsHTML = allItems
    .map((item) => {
      const isWinner = item.id === winningItem.id;
      const rarityColor = getRarityColor(item.rarity);

      let itemImage = null;
      if (isWinner) {
        itemImage = winningItem.image;
      } else {
        const nameMatch =
          item.name &&
          item.name.match(
            /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u
          );
        if (nameMatch) {
          itemImage = nameMatch[0];
        }
      }

      let itemIcon = '<div style="font-size: 2rem;">📦</div>';
      if (itemImage && itemImage.trim() !== "") {
        if (isValidUrl(itemImage)) {
          itemIcon = `<img src="${itemImage}" alt="${
            item.name || "Item"
          }" style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.25rem;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 2rem;\\'>📦</div>';">`;
        } else {
          itemIcon = `<div style="font-size: 2rem;">${itemImage}</div>`;
        }
      }

      return `
      <div style="
        padding: 1rem;
        background: ${
          isWinner
            ? "linear-gradient(135deg, rgba(255,215,0,0.25) 0%, rgba(255,215,0,0.15) 100%)"
            : "rgba(255,255,255,0.05)"
        };
        border: ${
          isWinner ? "3px solid #FFD700" : "2px solid rgba(255,255,255,0.1)"
        };
        border-radius: 0.75rem;
        margin-bottom: 0.75rem;
        transition: all 0.3s ease;
        ${
          isWinner
            ? "box-shadow: 0 0 25px rgba(255,215,0,0.6), 0 0 50px rgba(255,215,0,0.4); transform: scale(1.08);"
            : ""
        }
        position: relative;
        ${isWinner ? "animation: pulse 2s infinite;" : ""}
      ">
        ${
          isWinner
            ? '<div style="position: absolute; top: -12px; right: -12px; background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000; padding: 0.35rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 700; box-shadow: 0 4px 10px rgba(255,215,0,0.5); z-index: 10;">⭐ WIN! ⭐</div>'
            : ""
        }
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="
            width: 70px;
            height: 70px;
            background: ${
              isWinner
                ? `linear-gradient(135deg, ${rarityColor}40 0%, ${rarityColor}20 100%)`
                : `${rarityColor}20`
            };
            border: ${
              isWinner ? `3px solid ${rarityColor}` : `2px solid ${rarityColor}`
            };
            border-radius: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            ${isWinner ? "box-shadow: 0 0 15px " + rarityColor + "80;" : ""}
          ">
            ${itemIcon}
          </div>
          <div style="flex: 1;">
            <div style="
              font-weight: ${isWinner ? "700" : "500"};
              font-size: ${isWinner ? "1.2rem" : "1rem"};
              color: ${isWinner ? "#FFD700" : "#fff"};
              margin-bottom: 0.35rem;
              text-shadow: ${
                isWinner ? "0 0 10px rgba(255,215,0,0.5)" : "none"
              };
            ">
              ${item.name || "Unknown Item"}
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: rgba(255,255,255,0.7); flex-wrap: wrap;">
              <span style="color: ${rarityColor}; font-weight: 600; background: ${rarityColor}20; padding: 0.2rem 0.5rem; border-radius: 0.25rem;">${
        item.rarity || "Common"
      }</span>
              <span>💰 $${item.value || 0}</span>
              <span>🎲 ${item.chance?.toFixed(2) || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  modal.innerHTML = `
    <div class="card" style="max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid rgba(255,255,255,0.1);">
        <h2 style="margin-bottom: 0.5rem; color: #FFD700; font-size: 2rem;">🎉 You Won! 🎉</h2>
        <p style="color: rgba(255,255,255,0.8);">Case Contents</p>
      </div>
      
      <div style="margin-bottom: 1.5rem;">
        ${itemsHTML}
      </div>
      
      <div style="text-align: center; padding-top: 1rem; border-top: 2px solid rgba(255,255,255,0.1);">
        <button 
          class="collect-btn"
          style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
          "
          onmouseover="this.style.transform='scale(1.05)'"
          onmouseout="this.style.transform='scale(1)'"
        >
          Collect
        </button>
      </div>
    </div>
  `;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.body.appendChild(modal);

  const collectBtn = modal.querySelector(".collect-btn");
  if (collectBtn) {
    collectBtn.addEventListener("click", closeModal);
  }
}

function showAuth() {
  authSection.classList.remove("hidden");
  mainSection.classList.add("hidden");
  logoutBtn.style.display = "none";
}

function showMain() {
  authSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
  logoutBtn.style.display = "block";
}

function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.style.borderColor = isError
    ? "var(--accent-error)"
    : "var(--primary)";
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3000);
}

let isLoginMode = true;

toggleAuthBtn.addEventListener("click", () => {
  isLoginMode = !isLoginMode;
  authTitle.textContent = isLoginMode ? "Login" : "Register";
  toggleAuthBtn.textContent = isLoginMode
    ? "Need an account? Register"
    : "Have an account? Login";

  if (isLoginMode) {
    document.getElementById("reg-username").classList.add("hidden");
  } else {
    document.getElementById("reg-username").classList.remove("hidden");
  }
});

document.getElementById("auth-submit").addEventListener("click", (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value;
  const password = document.getElementById("auth-password").value;

  if (!email || !password) {
    showToast("Please fill in all fields", true);
    return;
  }

  if (isLoginMode) {
    login(email, password);
  } else {
    const username = document.getElementById("auth-username").value;
    if (!username) {
      showToast("Please fill in all fields", true);
      return;
    }
    register(username, email, password);
  }
});

logoutBtn.addEventListener("click", () => logout());

window.getAccessToken = getAccessToken;
window.authenticatedFetch = authenticatedFetch;

init();
