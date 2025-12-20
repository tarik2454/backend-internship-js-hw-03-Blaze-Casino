/* eslint-env browser */
const API_URL = "http://localhost:3000/api";
let token = localStorage.getItem("token");
let currentUser = null;

// DOM Elements
const authSection = document.getElementById("auth-section");
const mainSection = document.getElementById("main-section");
const userInfoEl = document.getElementById("user-info");
userInfoEl.innerHTML = '<div style="padding: 1rem;">Loading...</div>'; // Initial state
const casesGrid = document.getElementById("cases-grid");
const toastEl = document.getElementById("toast");
const logoutBtn = document.getElementById("logout-btn");
const toggleAuthBtn = document.getElementById("toggle-auth");
const authTitle = document.getElementById("auth-title");

// Init
function init() {
  if (token) {
    // Optimistic UI: Show main immediately, then populate
    showMain();
    loadUser(); // Async data fetch
  } else {
    showAuth();
  }
}

// Auth Logic
async function login(email, password) {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    token = data.token;
    localStorage.setItem("token", token);

    // Show main section immediately
    showMain();
    // Load user data and cases
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

    // Check if response is JSON (sometimes html error pages return)
    const contentType = res.headers.get("content-type");
    let data;
    if (contentType && contentType.indexOf("application/json") !== -1) {
      data = await res.json();
    } else {
      const text = await res.text();
      console.error("Non-JSON response:", text);
      throw new Error("Server returned non-JSON response");
    }

    if (!res.ok) throw new Error(data.message || "Registration failed");

    // Auto login after register
    await login(email, password);
  } catch (err) {
    showToast(err.message, true);
  }
}

async function loadUser() {
  try {
    const res = await fetch(`${API_URL}/users/current`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        logout();
        return;
      }
      throw new Error("Failed to load user");
    }
    currentUser = await res.json();
    renderUser();
    loadCases();
  } catch (err) {
    console.error("LoadUser error:", err);
    showToast("Failed to load user: " + err.message, true);
    // Force logout on any error to ensure UI recovers
    logout();
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem("token");
  showAuth();
}

// Cases Logic
async function loadCases() {
  try {
    const res = await fetch(`${API_URL}/cases`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    // Сначала загружаем детали кейса, чтобы получить все предметы
    const caseRes = await fetch(`${API_URL}/cases/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!caseRes.ok) throw new Error("Failed to load case details");
    const caseData = await caseRes.json();

    // Открываем кейс
    const res = await fetch(`${API_URL}/cases/${id}/open`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // clientSeed auto generated
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to open case");

    // Показываем модальное окно со всеми предметами и выделенным выигранным
    showWinModal(data.item, caseData.items);
    loadUser(); // Refresh balance
  } catch (err) {
    showToast(err.message, true);
  }
}

// UI Renderers
function renderUser() {
  if (!currentUser) return;
  userInfoEl.innerHTML = `
    <div>
      <h2 style="font-size: 1.25rem; font-weight: 600;">${
        currentUser.username
      }</h2>
      <p style="color: var(--text-dim);">${currentUser.email}</p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 1.5rem; color: var(--accent-success); font-weight: 700;">$${currentUser.balance.toFixed(
        2
      )}</div>
      <div style="font-size: 0.875rem; color: var(--text-dim);">Balance</div>
    </div>
  `;
}

function renderCases(cases) {
  if (!cases || cases.length === 0) {
    casesGrid.innerHTML = '<div class="card"><p>No cases available</p></div>';
    return;
  }
  casesGrid.innerHTML = cases
    .map(
      (c) => `
    <div class="card case-item">
      <div class="case-img" style="background-image: url('${
        c.image || ""
      }'); background-size: cover; background-position: center;"></div>
      <h3 style="margin-bottom: 0.5rem;">${c.name || "Unknown"}</h3>
      <p style="color: var(--accent-success); font-weight: 600; margin-bottom: 1rem;">$${
        c.price || 0
      }</p>
      <button onclick="openCase('${c.id || ""}')">Open Case</button>
    </div>
  `
    )
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

  // Функция для закрытия модального окна
  const closeModal = () => {
    modal.remove();
  };

  // Функция для получения цвета редкости
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

  // Генерируем HTML для всех предметов
  const itemsHTML = allItems
    .map((item) => {
      const isWinner = item.id === winningItem.id;
      const rarityColor = getRarityColor(item.rarity);

      // Для выигранного предмета используем его image, для остальных - иконку
      let itemIcon = '<div style="font-size: 2rem;">📦</div>';
      if (isWinner && winningItem.image && winningItem.image.trim() !== "") {
        const imageUrl = winningItem.image;
        itemIcon = `<img src="${imageUrl}" alt="${
          item.name || "Item"
        }" style="width: 100%; height: 100%; object-fit: cover; border-radius: 0.25rem;" onerror="console.error('Image failed to load:', '${imageUrl}'); this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 2rem;\\'>📦</div>';" onload="console.log('Image loaded:', '${imageUrl}');">`;
      } else if (isWinner) {
        console.warn("Winning item has no image:", winningItem);
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

  // Закрытие по клику вне модального окна
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.body.appendChild(modal);

  // Добавляем обработчик для кнопки Collect после добавления в DOM
  const collectBtn = modal.querySelector(".collect-btn");
  if (collectBtn) {
    collectBtn.addEventListener("click", closeModal);
  }
}

// Helpers
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

// Event Listeners
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

logoutBtn.addEventListener("click", logout);

init();
