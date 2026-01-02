/* eslint-env browser */
const getLeaderboardApiUrl = () => {
  if (typeof window !== "undefined" && window.API_URL) {
    return window.API_URL;
  }
  return "http://localhost:3000/api";
};

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
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

let currentPeriod = "all";

function getLeaderboardElements() {
  return {
    leaderboardView: document.getElementById("leaderboard-view"),
    tableBody: document.getElementById("leaderboard-table-body"),
    currentUserEl: document.getElementById("leaderboard-current-user"),
    periodButtons: document.querySelectorAll("[data-period]"),
  };
}

async function loadLeaderboard(period = "all") {
  try {
    if (!window.authenticatedFetch) {
      return;
    }

    const { tableBody, currentUserEl } = getLeaderboardElements();
    if (!tableBody) {
      return;
    }

    tableBody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-dim);">
          Loading...
        </td>
      </tr>
    `;

    const apiUrl = getLeaderboardApiUrl();
    const url = `${apiUrl}/leaderboard?period=${period}`;

    const res = await window.authenticatedFetch(url);

    if (!res.ok) {
      if (res.status === 401) {
        return;
      }
      throw new Error(`Failed to load leaderboard: ${res.status}`);
    }

    const data = await res.json();

    if (!data.players || data.players.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-dim);">
            No players yet
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = data.players
      .map(
        (player) => `
      <tr style="border-bottom: 1px solid rgba(102, 126, 234, 0.1);">
        <td style="padding: 0.75rem; font-weight: 600;">#${player.rank}</td>
        <td style="padding: 0.75rem;">${escapeHtml(player.username)}</td>
        <td style="padding: 0.75rem; text-align: right;">$${player.totalWagered.toFixed(
          2
        )}</td>
        <td style="padding: 0.75rem; text-align: right;">${
          player.gamesPlayed
        }</td>
        <td style="padding: 0.75rem; text-align: right;">${player.winRate.toFixed(
          2
        )}%</td>
      </tr>
    `
      )
      .join("");

    if (data.currentUser && currentUserEl) {
      currentUserEl.innerHTML = `
        <div style="
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
          border: 2px solid rgba(102, 126, 234, 0.3);
          border-radius: 1rem;
          padding: 1.5rem;
        ">
          <div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--text-primary);">
            Your Position
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
            <div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-primary);">
                #${data.currentUser.rank}
              </div>
              <div style="font-size: 0.875rem; color: var(--text-dim);">Rank</div>
            </div>
            <div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                $${data.currentUser.totalWagered.toFixed(2)}
              </div>
              <div style="font-size: 0.875rem; color: var(--text-dim);">Wagered</div>
            </div>
            <div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">
                ${data.currentUser.gamesPlayed}
              </div>
              <div style="font-size: 0.875rem; color: var(--text-dim);">Games</div>
            </div>
            <div>
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-success);">
                ${data.currentUser.winRate.toFixed(2)}%
              </div>
              <div style="font-size: 0.875rem; color: var(--text-dim);">Win Rate</div>
            </div>
          </div>
        </div>
      `;
    } else {
      if (currentUserEl) {
        currentUserEl.innerHTML = "";
      }
    }
  } catch (err) {
    const { tableBody } = getLeaderboardElements();
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-dim);">
            Failed to load leaderboard
          </td>
        </tr>
      `;
    }
  }
}

function updatePeriodButtons(activePeriod) {
  const { periodButtons } = getLeaderboardElements();
  if (!periodButtons) return;

  periodButtons.forEach((btn) => {
    const period = btn.getAttribute("data-period");
    if (period === activePeriod) {
      btn.classList.remove("secondary");
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
      btn.classList.add("secondary");
    }
  });
}

let buttonsInitialized = false;

function setupLeaderboardPeriodButtons() {
  if (buttonsInitialized) return;

  const { periodButtons } = getLeaderboardElements();
  if (!periodButtons || periodButtons.length === 0) {
    return;
  }

  periodButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = btn.getAttribute("data-period");
      if (period) {
        currentPeriod = period;
        updatePeriodButtons(period);
        loadLeaderboard(period);
      }
    });
  });

  buttonsInitialized = true;
}

function initLeaderboard() {
  setupLeaderboardPeriodButtons();
}

document.addEventListener("leaderboard:shown", () => {
  initLeaderboard();
  setTimeout(() => {
    loadLeaderboard(currentPeriod);
  }, 100);
});

document.addEventListener("leaderboard:hidden", () => {
  // Leaderboard hidden - no action needed
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLeaderboard();
  });
} else {
  initLeaderboard();
}
