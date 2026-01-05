const getApiUrl = () => {
  if (typeof window !== "undefined" && window.API_URL) {
    return window.API_URL;
  }
  return "http://localhost:3000/api";
};

let bonusStatus = null;
let bonusStatusInterval = null;
let countdownInterval = null;
let countdownEndTime = null;

function getBonusElements() {
  return {
    bonusView: document.getElementById("bonus-view"),
    bonusStatusEl: document.getElementById("bonus-status"),
    bonusClaimBtn: document.getElementById("bonus-claim-btn"),
    bonusTimerEl: document.getElementById("bonus-timer"),
    bonusAmountEl: document.getElementById("bonus-amount"),
    bonusBaseAmountEl: document.getElementById("bonus-base-amount"),
    bonusWagerBonusEl: document.getElementById("bonus-wager-bonus"),
    bonusGamesBonusEl: document.getElementById("bonus-games-bonus"),
    bonusNextClaimAtEl: document.getElementById("bonus-next-claim-at"),
  };
}

async function loadBonusStatus(shouldLog = false) {
  try {
    if (!window.authenticatedFetch) return;

    const res = await window.authenticatedFetch(`${getApiUrl()}/bonus/status`);

    if (!res.ok) {
      if (res.status === 401) {
        return;
      }
      throw new Error("Failed to load bonus status");
    }

    bonusStatus = await res.json();
    updateTimer();
    updateBonusStatusDisplay();
  } catch (err) {}
}

function updateBonusStatusDisplay() {
  const {
    bonusAmountEl,
    bonusBaseAmountEl,
    bonusWagerBonusEl,
    bonusGamesBonusEl,
    bonusNextClaimAtEl,
  } = getBonusElements();
  if (!bonusStatus) return;

  if (bonusAmountEl) {
    bonusAmountEl.textContent = `$${bonusStatus.amount?.toFixed(2) || "0.00"}`;
  }
  if (bonusBaseAmountEl) {
    bonusBaseAmountEl.textContent = `$${
      bonusStatus.baseAmount?.toFixed(2) || "0.00"
    }`;
  }
  if (bonusWagerBonusEl) {
    bonusWagerBonusEl.textContent = `$${
      bonusStatus.wagerBonus?.toFixed(2) || "0.00"
    }`;
  }
  if (bonusGamesBonusEl) {
    bonusGamesBonusEl.textContent = `$${
      bonusStatus.gamesBonus?.toFixed(2) || "0.00"
    }`;
  }
  if (bonusNextClaimAtEl && bonusStatus.nextClaimAt) {
    const nextClaimDate = new Date(bonusStatus.nextClaimAt);
    bonusNextClaimAtEl.textContent = nextClaimDate.toLocaleString();
  }
}

function updateTimer() {
  const { bonusTimerEl, bonusClaimBtn } = getBonusElements();
  if (!bonusStatus || !bonusTimerEl) return;

  const nextClaimDate = new Date(bonusStatus.nextClaimAt);
  const now = new Date();
  const canClaim = nextClaimDate <= now;

  if (canClaim) {
    bonusTimerEl.textContent = "Available now!";
    bonusTimerEl.style.color = "var(--accent-success)";
    if (bonusClaimBtn) {
      bonusClaimBtn.disabled = false;
      bonusClaimBtn.textContent = "Claim Bonus";
    }
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    countdownEndTime = null;
  } else {
    const diffMs = nextClaimDate.getTime() - now.getTime();
    const diffSeconds = Math.ceil(diffMs / 1000);
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;

    bonusTimerEl.textContent = `Next bonus in: ${minutes}:${seconds
      .toString()
      .padStart(2, "0")}`;
    bonusTimerEl.style.color = "var(--text-dim)";

    if (bonusClaimBtn) {
      bonusClaimBtn.disabled = true;
    }
  }
}

function startCountdown(seconds) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownEndTime = Date.now() + seconds * 1000;
  updateCountdownDisplay();
}

const claimBonus = async function () {
  try {
    if (!window.authenticatedFetch) {
      if (typeof showToast === "function") {
        showToast("Not authenticated", true);
      }
      return;
    }

    const { bonusClaimBtn } = getBonusElements();
    if (!bonusClaimBtn) {
      return;
    }

    if (bonusClaimBtn.disabled) {
      return;
    }

    bonusClaimBtn.disabled = true;
    bonusClaimBtn.textContent = "Claiming...";

    const res = await window.authenticatedFetch(`${getApiUrl()}/bonus/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to claim bonus");
    }

    if (typeof showToast === "function") {
      showToast(`Bonus claimed! +$${data.amount.toFixed(2)} 🎉`);
    }

    if (window.currentUser) {
      window.currentUser.balance = data.balance;
      if (typeof window.renderUser === "function") {
        window.renderUser();
      }
      window.dispatchEvent(
        new CustomEvent("balance:update", {
          detail: { newBalance: data.balance },
          bubbles: true,
        })
      );
    }

    if (data.nextClaimAt && bonusStatus) {
      bonusStatus.nextClaimAt = data.nextClaimAt;
      updateBonusStatusDisplay();
    }

    startCountdown(60);
    await loadBonusStatus(false);
  } catch (err) {
    if (typeof showToast === "function") {
      showToast(err.message, true);
    }
    const { bonusClaimBtn } = getBonusElements();
    if (bonusClaimBtn) {
      bonusClaimBtn.disabled = false;
      bonusClaimBtn.textContent = "Claim Bonus";
    }
  }
};

if (typeof window !== "undefined") {
  window.claimBonus = claimBonus;
}

let lastStatusUpdate = 0;
const STATUS_UPDATE_INTERVAL = 5000;

function startBonusStatusUpdates() {
  if (bonusStatusInterval) {
    clearInterval(bonusStatusInterval);
  }

  loadBonusStatus(true);
  lastStatusUpdate = Date.now();

  bonusStatusInterval = setInterval(() => {
    const { bonusView } = getBonusElements();
    if (bonusView && !bonusView.classList.contains("hidden")) {
      if (countdownEndTime) {
        updateCountdownDisplay();
      } else {
        const now = Date.now();
        if (now - lastStatusUpdate >= STATUS_UPDATE_INTERVAL) {
          loadBonusStatus(false);
          lastStatusUpdate = now;
        } else {
          updateTimer();
        }
      }
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const { bonusTimerEl, bonusClaimBtn } = getBonusElements();
  if (!countdownEndTime || !bonusTimerEl || !bonusClaimBtn) return;

  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((countdownEndTime - now) / 1000));

  if (remaining <= 0) {
    bonusTimerEl.textContent = "Available now!";
    bonusTimerEl.style.color = "var(--accent-success)";
    bonusClaimBtn.disabled = false;
    bonusClaimBtn.textContent = "Claim Bonus";
    countdownEndTime = null;
    loadBonusStatus(false);
    return;
  }

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  bonusTimerEl.textContent = `Next bonus in: ${minutes}:${secs
    .toString()
    .padStart(2, "0")}`;
  bonusTimerEl.style.color = "var(--text-dim)";
  bonusClaimBtn.disabled = true;
  bonusClaimBtn.textContent = `Claim Bonus (${minutes}:${secs
    .toString()
    .padStart(2, "0")})`;
}

function stopBonusStatusUpdates() {
  if (bonusStatusInterval) {
    clearInterval(bonusStatusInterval);
    bonusStatusInterval = null;
  }
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function setupBonusButton() {
  const { bonusClaimBtn } = getBonusElements();
  if (bonusClaimBtn) {
    bonusClaimBtn.removeEventListener("click", claimBonus);
    bonusClaimBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      claimBonus();
    });
  }
}

document.addEventListener("bonus:shown", () => {
  setupBonusButton();
  startBonusStatusUpdates();
});

document.addEventListener("bonus:hidden", () => {
  stopBonusStatusUpdates();
});

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "bonus-claim-btn") {
    e.preventDefault();
    e.stopPropagation();
    claimBonus();
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(setupBonusButton, 100);
  });
} else {
  setTimeout(setupBonusButton, 100);
}

if (typeof window !== "undefined") {
  window.claimBonus = claimBonus;
}
