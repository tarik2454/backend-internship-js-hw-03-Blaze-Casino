let socket = null;
let currentGameId = null;
let currentBetId = null;
let currentMultiplier = 1.0;
let currentBetAmount = 0;
let gameState = "waiting";
let hasCashedOut = false;
let cashedOutMultiplier = 0;

document.addEventListener("DOMContentLoaded", () => {
  const crashTabBtn = document.getElementById("tab-crash");
  const crashView = document.getElementById("crash-view");
  const betBtn = document.getElementById("crash-bet-btn");
  const cashoutBtn = document.getElementById("crash-cashout-btn");
  const amountInput = document.getElementById("crash-amount");
  const autoCashoutInput = document.getElementById("crash-auto-cashout");
  const multiplierEl = document.getElementById("crash-multiplier");
  const statusEl = document.getElementById("crash-status");
  const historyTable = document.getElementById("crash-history-table");

  if (!crashTabBtn || !crashView) return;

  document.addEventListener("crash:shown", () => {
    gameState = "waiting";
    currentBetId = null;
    currentBetAmount = 0;
    currentGameId = null;
    currentMultiplier = 1.0;
    updateUI();

    connectWebSocket();
    loadCurrentGame();
    loadHistory();
  });

  document.addEventListener("crash:hidden", () => {
    disconnectWebSocket();
  });

  function connectWebSocket() {
    if (socket && socket.connected) return;

    const wsUrl = window.location.origin.replace(/^http/, "ws");
    socket = io(`${wsUrl}/crash`);

    socket.on("connect", () => {
      console.log("[Crash WS] Client connected:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[Crash WS] Client disconnected");
    });

    socket.on("game:tick", (data) => {
      if (data.elapsed % 1000 < 100) {
        console.log(
          `[Crash WS] Received game:tick - multiplier: ${data.multiplier.toFixed(
            2
          )}x, elapsed: ${data.elapsed}ms`
        );
      }
      handleGameTick(data);
    });

    socket.on("game:crash", (data) => {
      console.log(
        `[Crash WS] Received game:crash - crashPoint: ${data.crashPoint.toFixed(
          2
        )}x`
      );
      handleGameCrash(data);
    });
  }

  function disconnectWebSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function handleGameTick(data) {
    if (gameState !== "running") {
      gameState = "running";
    }
    currentMultiplier = data.multiplier;
    const preservedBetId = currentBetId;
    updateUI();
    if (!currentBetId && preservedBetId) {
      currentBetId = preservedBetId;
      updateUI();
    }
  }

  function handleGameCrash(data) {
    gameState = "crashed";
    currentMultiplier = data.crashPoint;
    updateUI();

    setTimeout(() => {
      if (currentBetId) {
        currentBetId = null;
        currentBetAmount = 0;
      }
      gameState = "waiting";
      currentMultiplier = 1.0;
      hasCashedOut = false;

      const winInfoEl = document.getElementById("crash-win-info");
      if (winInfoEl) {
        winInfoEl.classList.add("hidden");
      }

      updateUI();
      loadHistory();
    }, 3000);
  }

  function updateUI() {
    if (multiplierEl) {
      multiplierEl.textContent = currentMultiplier.toFixed(2) + "x";

      if (gameState === "running") {
        multiplierEl.style.color = "var(--accent-success)";
      } else if (gameState === "crashed") {
        multiplierEl.style.color = "var(--accent-error, #ef4444)";
      } else {
        multiplierEl.style.color = "var(--text-dim)";
      }
    }

    if (statusEl) {
      if (hasCashedOut && gameState === "running") {
        statusEl.textContent = `Cashed out at ${
          cashedOutMultiplier > 0
            ? cashedOutMultiplier.toFixed(2)
            : currentMultiplier.toFixed(2)
        }x`;
        statusEl.style.color = "var(--accent-success)";
      } else if (gameState === "waiting") {
        statusEl.textContent = "Waiting for bets...";
        statusEl.style.color = "var(--text-dim)";
      } else if (gameState === "running") {
        statusEl.textContent = "Game is running!";
        statusEl.style.color = "var(--accent-success)";
      } else if (gameState === "crashed") {
        statusEl.textContent = `Crashed at ${currentMultiplier.toFixed(2)}x`;
        statusEl.style.color = "var(--accent-error, #ef4444)";
      }
    }

    if (betBtn) {
      const shouldDisable = gameState !== "waiting" || !!currentBetId;
      betBtn.disabled = shouldDisable;
    }

    if (cashoutBtn) {
      const hasActiveBet = currentBetId !== null && currentBetId !== undefined;
      cashoutBtn.disabled = !hasActiveBet;
    }

    const infoEl = document.getElementById("crash-info");
    if (infoEl && currentBetId) {
      infoEl.classList.remove("hidden");
      const currentMultEl = document.getElementById("crash-current-mult");
      const potentialWinEl = document.getElementById("crash-potential-win");

      if (currentMultEl) {
        currentMultEl.textContent = currentMultiplier.toFixed(2) + "x";
      }

      if (potentialWinEl && currentBetAmount) {
        const potentialWin = currentBetAmount * currentMultiplier;
        potentialWinEl.textContent = "$" + potentialWin.toFixed(2);
      }
    } else if (infoEl) {
      infoEl.classList.add("hidden");
    }
  }

  async function loadCurrentGame() {
    try {
      if (!window.authenticatedFetch) return;

      const response = await window.authenticatedFetch(
        `${window.API_URL}/crash/current`
      );

      if (!response.ok) {
        if (response.status === 404) {
          currentGameId = null;
          gameState = "waiting";
          currentMultiplier = 1.0;
          currentBetId = null;
          currentBetAmount = 0;
          updateUI();
          return;
        }
        throw new Error("Failed to load current game");
      }

      const data = await response.json();
      currentGameId = data.gameId;
      gameState = data.state;

      if (socket && socket.connected && currentGameId) {
        socket.emit("subscribe:game", { gameId: currentGameId });
      }

      if (gameState === "crashed") {
        currentBetId = null;
        currentBetAmount = 0;
        gameState = "waiting";
        currentGameId = null;
        currentMultiplier = 1.0;
        updateUI();
        return;
      }

      if (data.multiplier) {
        currentMultiplier = data.multiplier;
      } else {
        currentMultiplier = 1.0;
      }

      if (data.myBet) {
        currentBetId = data.myBet.betId;
        currentBetAmount = data.myBet.amount;
      } else {
        currentBetId = null;
        currentBetAmount = 0;
      }

      updateUI();
    } catch (error) {
      gameState = "waiting";
      currentBetId = null;
      currentBetAmount = 0;
      updateUI();
    }
  }

  async function loadHistory() {
    try {
      if (!window.authenticatedFetch || !historyTable) return;

      const response = await window.authenticatedFetch(
        `${window.API_URL}/crash/bets/history?limit=10&offset=0`
      );

      if (!response.ok) {
        throw new Error("Failed to load history");
      }

      const data = await response.json();
      renderHistory(data.bets);
    } catch (error) {}
  }

  function renderHistory(bets) {
    if (!historyTable) return;

    if (bets.length === 0) {
      historyTable.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-dim)">
            No bet history yet
          </td>
        </tr>
      `;
      return;
    }

    historyTable.innerHTML = bets
      .map((bet) => {
        const date = new Date(bet.createdAt).toLocaleString();
        const multiplier = bet.cashoutMultiplier
          ? bet.cashoutMultiplier.toFixed(2) + "x"
          : bet.crashPoint.toFixed(2) + "x";
        const winAmount = bet.winAmount
          ? `$${bet.winAmount.toFixed(2)}`
          : "$0.00";
        const statusColor =
          bet.status === "won"
            ? "var(--accent-success)"
            : "var(--accent-error, #ef4444)";
        const statusText = bet.status === "won" ? "Won" : "Lost";

        return `
          <tr>
            <td style="padding: 1rem; font-size: 0.875rem; color: var(--text-dim)">${date}</td>
            <td style="padding: 1rem">$${bet.amount.toFixed(2)}</td>
            <td style="padding: 1rem; font-weight: 600; color: var(--accent-success)">${multiplier}</td>
            <td style="padding: 1rem; font-weight: 600; color: ${statusColor}">${winAmount}</td>
            <td style="padding: 1rem; color: ${statusColor}">${statusText}</td>
          </tr>
        `;
      })
      .join("");
  }

  if (betBtn) {
    betBtn.addEventListener("click", async () => {
      const amount = parseFloat(amountInput?.value || 0);
      let autoCashout;
      if (autoCashoutInput?.value && autoCashoutInput.value.trim() !== "") {
        autoCashout = parseFloat(autoCashoutInput.value);
      }

      if (isNaN(amount) || amount < 0.1) {
        return;
      }

      if (
        autoCashout !== undefined &&
        (isNaN(autoCashout) || autoCashout < 1.0)
      ) {
        return;
      }

      betBtn.disabled = true;

      try {
        if (!window.authenticatedFetch) {
          betBtn.disabled = false;
          return;
        }

        if (!socket || !socket.connected) {
          connectWebSocket();

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const requestBody = { amount };
        if (autoCashout !== undefined) {
          requestBody.autoCashout = autoCashout;
        }
        const response = await window.authenticatedFetch(
          `${window.API_URL}/crash/bet`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          let errorMessage = "Failed to place bet";
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const text = await response.text();

            const htmlMatch = text.match(/Error: ([^<\n]+)/);
            if (htmlMatch && htmlMatch[1]) {
              errorMessage = htmlMatch[1].trim();
            } else {
              errorMessage = text || errorMessage;
            }
          }

          if (errorMessage.includes("already have an active bet")) {
            await loadCurrentGame();
            return;
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();

        const newBetId = data.betId;
        const newBetAmount = amount;
        const newGameId = data.gameId;

        currentBetId = newBetId;
        currentBetAmount = newBetAmount;
        currentGameId = newGameId;

        if (socket && socket.connected && currentGameId) {
          socket.emit("subscribe:game", { gameId: currentGameId });
        }

        if (socket && socket.connected) {
          console.log("[Crash WS] Emitting bet:place", { amount, autoCashout });
          socket.emit("bet:place", { amount, autoCashout });
        }

        if (window.currentUser) {
          window.currentUser.balance -= amount;
          if (typeof window.renderUser === "function") {
            window.renderUser();
          }
        }

        await loadCurrentGame();

        if (!currentBetId && newBetId && currentGameId === newGameId) {
          currentBetId = newBetId;
          currentBetAmount = newBetAmount;
        }

        updateUI();
      } catch (error) {
        betBtn.disabled = false;
      }
    });
  }

  if (cashoutBtn) {
    cashoutBtn.addEventListener("click", async () => {
      if (!currentBetId) {
        return;
      }

      cashoutBtn.disabled = true;

      try {
        if (!window.authenticatedFetch) {
          cashoutBtn.disabled = false;
          return;
        }

        const response = await window.authenticatedFetch(
          `${window.API_URL}/crash/cashout`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              betId: currentBetId,
            }),
          }
        );

        if (!response.ok) {
          let errorMessage = "Failed to cashout";
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (parseError) {
            const text = await response.text();
            const htmlMatch = text.match(/Error: ([^<\n]+)/);
            if (htmlMatch && htmlMatch[1]) {
              errorMessage = htmlMatch[1].trim();
            } else {
              errorMessage = `HTTP ${response.status}: ${text}`;
            }
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        if (socket && socket.connected) {
          console.log("[Crash WS] Emitting bet:cashout", {
            betId: currentBetId,
          });
          socket.emit("bet:cashout", { betId: currentBetId });
        }

        if (window.currentUser) {
          window.currentUser.balance += data.winAmount;
          if (typeof window.renderUser === "function") {
            window.renderUser();
          }
        }

        cashedOutMultiplier = data.multiplier;

        currentBetId = null;
        currentBetAmount = 0;
        hasCashedOut = true;

        const winInfoEl = document.getElementById("crash-win-info");
        const winMultiplierEl = document.getElementById("crash-win-multiplier");
        const winAmountEl = document.getElementById("crash-win-amount");

        if (winInfoEl) {
          winInfoEl.classList.remove("hidden");
        }
        if (winMultiplierEl) {
          winMultiplierEl.textContent = data.multiplier.toFixed(2) + "x";
        }
        if (winAmountEl) {
          winAmountEl.textContent = "$" + data.winAmount.toFixed(2);
        }

        updateUI();

        loadHistory();
      } catch (error) {
        cashoutBtn.disabled = false;
      }
    });
  }
});
