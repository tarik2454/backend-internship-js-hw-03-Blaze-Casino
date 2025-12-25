/* eslint-env browser */

// API_URL is already declared in app.js
let socket = null;
let currentGameId = null;
let currentBetId = null;
let currentMultiplier = 1.0;
let currentBetAmount = 0;
let gameState = "waiting"; // waiting, running, crashed
let crashTimeout = null;

// Modal functions
function showModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("crash-modal");
    const modalTitle = document.getElementById("crash-modal-title");
    const modalMessage = document.getElementById("crash-modal-message");
    const modalOk = document.getElementById("crash-modal-ok");

    if (!modal || !modalTitle || !modalMessage || !modalOk) {
      // Fallback to alert if modal elements not found
      alert(`${title}\n\n${message}`);
      resolve();
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.remove("hidden");

    const handleClose = () => {
      modal.classList.add("hidden");
      modalOk.removeEventListener("click", handleClose);
      modal.removeEventListener("click", handleOverlayClose);
      resolve();
    };

    const handleOverlayClose = (e) => {
      if (e.target === modal.querySelector(".crash-modal-overlay")) {
        handleClose();
      }
    };

    modalOk.addEventListener("click", handleClose);
    modal.addEventListener("click", handleOverlayClose);
  });
}

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

  // Connect WebSocket when crash tab is shown
  document.addEventListener("crash:shown", () => {
    connectWebSocket();
    loadCurrentGame();
    loadHistory();
  });

  // Disconnect when hidden
  document.addEventListener("crash:hidden", () => {
    disconnectWebSocket();
  });

  function connectWebSocket() {
    if (socket && socket.connected) return;

    const wsUrl = window.location.origin.replace(/^http/, "ws");
    socket = io(`${wsUrl}/crash`);

    socket.on("connect", () => {
      console.log("Connected to crash namespace");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from crash namespace");
    });

    socket.on("game:start", (data) => {
      handleGameStart(data);
    });

    socket.on("game:tick", (data) => {
      handleGameTick(data);
    });

    socket.on("game:crash", (data) => {
      handleGameCrash(data);
    });

    socket.on("player:bet", (data) => {
      console.log("Player bet:", data);
      handlePlayerBet(data);
    });

    socket.on("player:cashout", (data) => {
      console.log("Player cashout:", data);
      handlePlayerCashout(data);
    });
  }

  function disconnectWebSocket() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  function handleGameStart(data) {
    if (crashTimeout) {
      clearTimeout(crashTimeout);
      crashTimeout = null;
    }
    currentGameId = data.gameId;
    gameState = "waiting";
    currentMultiplier = 1.0;

    // Clear current bets list
    const betsListEl = document.getElementById("crash-bets-list");
    if (betsListEl) betsListEl.innerHTML = "";

    updateUI();
  }

  function handleGameTick(data) {
    if (gameState !== "running") {
      gameState = "running";
    }
    currentMultiplier = data.multiplier;
    updateUI();
  }

  function handleGameCrash(data) {
    gameState = "crashed";
    currentMultiplier = data.crashPoint;
    updateUI();

    // Reset after a delay
    setTimeout(() => {
      if (currentBetId) {
        currentBetId = null;
        currentBetAmount = 0;
      }
      gameState = "waiting";
      currentMultiplier = 1.0;

      // Clear current bets list
      const betsListEl = document.getElementById("crash-bets-list");
      if (betsListEl) betsListEl.innerHTML = "";

      updateUI();
      loadHistory();
    }, 3000);
  }

  function handlePlayerBet(data) {
    // Add to current bets list UI
    const betsListEl = document.getElementById("crash-bets-list");
    if (!betsListEl) return;

    const row = document.createElement("tr");
    row.id = `bet-${data.userId}`;
    row.innerHTML = `
      <td style="padding: 0.5rem">${data.userName || "Anonymous"}</td>
      <td style="padding: 0.5rem">$${data.amount.toFixed(2)}</td>
      <td class="player-multiplier" style="padding: 0.5rem">-</td>
      <td class="player-win" style="padding: 0.5rem">-</td>
    `;
    betsListEl.appendChild(row);
  }

  function handlePlayerCashout(data) {
    // Check if this is the current user's cashout
    const currentUserId =
      window.currentUser?._id?.toString() ||
      window.currentUser?.id?.toString();
    
    if (currentUserId && data.userId === currentUserId && currentBetId) {
      // Reset bet state for current user
      currentBetId = null;
      currentBetAmount = 0;
      updateUI(); // Hide bet info panel
    }

    // Update the bets list table
    const row = document.getElementById(`bet-${data.userId}`);
    if (!row) return;

    const multEl = row.querySelector(".player-multiplier");
    const winEl = row.querySelector(".player-win");

    if (multEl) {
      multEl.textContent = data.multiplier.toFixed(2) + "x";
      multEl.style.color = "var(--accent-success)";
    }
    if (winEl) {
      winEl.textContent = "$" + data.winAmount.toFixed(2);
      winEl.style.color = "var(--accent-success)";
    }
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
      if (gameState === "waiting") {
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

    // Update buttons
    if (betBtn) {
      const shouldDisable = gameState !== "waiting" || !!currentBetId;
      betBtn.disabled = shouldDisable;
      console.log(
        "Bet button state - disabled:",
        shouldDisable,
        "gameState:",
        gameState,
        "currentBetId:",
        currentBetId
      );
    }

    if (cashoutBtn) {
      const isDisabled = !currentBetId || gameState !== "running";
      cashoutBtn.disabled = isDisabled;
      
      // Additional check: if we have a bet but gameState is not running,
      // try to reload game state to sync
      if (currentBetId && gameState !== "running" && gameState !== "crashed") {
        console.warn("Bet exists but gameState is not 'running'. Current state:", gameState);
        // Don't reload here to avoid infinite loop, but log warning
      }
      
      console.log(
        "Cashout button state - disabled:",
        isDisabled,
        "currentBetId:",
        currentBetId,
        "gameState:",
        gameState
      );
    }

    // Update info panel
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
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/crash/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // If no active game, reset state to allow betting when game is created
        if (response.status === 404) {
          console.log("No active game found, resetting state");
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
      console.log("Loaded game state:", gameState, "GameId:", currentGameId);

      if (data.multiplier) {
        currentMultiplier = data.multiplier;
      } else {
        currentMultiplier = 1.0;
      }

      // Store current betId before updating to preserve it if needed
      const previousBetId = currentBetId;
      const previousBetAmount = currentBetAmount;
      const previousGameId = currentGameId;
      
      // Check if current user has an active bet (use myBet if available, otherwise check bets array)
      if (data.myBet) {
        currentBetId = data.myBet.betId;
        currentBetAmount = data.myBet.amount;
        console.log(
          "Found active bet from myBet:",
          currentBetId,
          "Amount:",
          currentBetAmount
        );
      } else if (window.currentUser && data.bets && data.bets.length > 0) {
        const currentUserId =
          window.currentUser._id?.toString() ||
          window.currentUser.id?.toString();
        const userBet = data.bets.find((bet) => bet.userId === currentUserId);

        if (userBet) {
          currentBetId = userBet.betId;
          currentBetAmount = userBet.amount || 0;
          console.log(
            "Found active bet from bets array:",
            currentBetId,
            "Amount:",
            currentBetAmount
          );
        } else {
          // Only reset if we're sure there's no bet (don't reset if we just placed one)
          // Keep previous betId if gameId matches and we had one before
          if (data.gameId === previousGameId && previousBetId) {
            console.log("No bet in response but keeping previous betId for same game:", previousBetId);
            currentBetId = previousBetId;
            currentBetAmount = previousBetAmount;
          } else {
            currentBetId = null;
            currentBetAmount = 0;
            console.log("No active bet found for user");
          }
        }
      } else {
        // Only reset if gameId doesn't match (different game)
        // Keep previous betId if it's for the same game
        if (data.gameId === previousGameId && previousBetId) {
          console.log("No bets in response but keeping previous betId for same game:", previousBetId);
          currentBetId = previousBetId;
          currentBetAmount = previousBetAmount;
        } else {
          currentBetId = null;
          currentBetAmount = 0;
          console.log("No bets or user found, reset state");
        }
      }

      console.log(
        "Before updateUI - gameState:",
        gameState,
        "currentBetId:",
        currentBetId
      );
      updateUI();
    } catch (error) {
      console.error("Failed to load current game:", error);
      // On error, reset state to allow betting
      gameState = "waiting";
      currentBetId = null;
      currentBetAmount = 0;
      updateUI();
    }
  }

  async function loadHistory() {
    try {
      const token = localStorage.getItem("token");
      if (!token || !historyTable) return;

      const response = await fetch(
        `${API_URL}/crash/history?limit=20&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load history");
      }

      const data = await response.json();
      renderHistory(data.games);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  }

  function renderHistory(games) {
    if (!historyTable) return;

    if (games.length === 0) {
      historyTable.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-dim)">
            No game history yet
          </td>
        </tr>
      `;
      return;
    }

    historyTable.innerHTML = games
      .map((game) => {
        const date = game.createdAt ? new Date(game.createdAt) : new Date();
        return `
          <tr>
            <td style="padding: 1rem">${date.toLocaleString()}</td>
            <td style="padding: 1rem">-</td>
            <td style="padding: 1rem; font-weight: 600; color: var(--accent-success)">${game.crashPoint.toFixed(
              2
            )}x</td>
            <td style="padding: 1rem">-</td>
            <td style="padding: 1rem">-</td>
          </tr>
        `;
      })
      .join("");
  }

  if (betBtn) {
    betBtn.addEventListener("click", async () => {
      console.log("Place bet button clicked");
      const amount = parseFloat(amountInput?.value || 0);
      let autoCashout = undefined;
      if (autoCashoutInput?.value && autoCashoutInput.value.trim() !== "") {
        autoCashout = parseFloat(autoCashoutInput.value);
      }

      console.log("Amount:", amount, "AutoCashout:", autoCashout);

      if (isNaN(amount) || amount < 0.1) {
        await showModal("Invalid Bet", "Bet amount must be at least $0.10");
        return;
      }

      if (
        autoCashout !== undefined &&
        (isNaN(autoCashout) || autoCashout < 1.0)
      ) {
        await showModal("Invalid Auto Cashout", "Auto cashout multiplier must be at least 1.00");
        return;
      }

      betBtn.disabled = true;

      try {
            const token = localStorage.getItem("token");
            if (!token) {
              await showModal("Authentication Required", "Please login first");
              betBtn.disabled = false;
              return;
            }

        const requestBody = { amount };
        if (autoCashout !== undefined) {
          requestBody.autoCashout = autoCashout;
        }
        console.log(
          "Sending bet request to:",
          `${API_URL}/crash/bet`,
          "Body:",
          requestBody
        );
        const response = await fetch(`${API_URL}/crash/bet`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
          let errorMessage = "Failed to place bet";
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const text = await response.text();
            // Try to extract error message from HTML
            const htmlMatch = text.match(/Error: ([^<\n]+)/);
            if (htmlMatch && htmlMatch[1]) {
              errorMessage = htmlMatch[1].trim();
            } else {
              errorMessage = text || errorMessage;
            }
          }

          console.error("Bet error:", errorMessage);

          // If user already has a bet, reload current game to update state
          if (errorMessage.includes("already have an active bet")) {
            await loadCurrentGame(); // This will call updateUI() which will disable the button
            await showModal("Bet Already Placed", "You already have an active bet in this game");
            return;
          }

          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("Bet successful:", data);

        // Update state immediately
        const newBetId = data.betId;
        const newBetAmount = amount;
        const newGameId = data.gameId;
        
        currentBetId = newBetId;
        currentBetAmount = newBetAmount;
        currentGameId = newGameId;

        // Emit WebSocket event
        if (socket && socket.connected) {
          socket.emit("bet:place", { amount, autoCashout });
        }

        // Update balance
        if (window.currentUser) {
          window.currentUser.balance -= amount;
          if (typeof window.renderUser === "function") {
            window.renderUser();
          }
        }

        // Reload current game to sync gameState (in case game is already running)
        // But preserve the betId we just set
        await loadCurrentGame();
        
        // If loadCurrentGame didn't find our bet (race condition), restore it
        if (!currentBetId && newBetId && currentGameId === newGameId) {
          currentBetId = newBetId;
          currentBetAmount = newBetAmount;
          console.log("Restored bet state after loadCurrentGame:", currentBetId);
        }
        
        // Update UI with the correct state
        updateUI();
      } catch (error) {
          console.error("Bet error:", error);
          await showModal("Bet Failed", error.message || "Failed to place bet");
          betBtn.disabled = false;
      }
    });
  } else {
    console.error("Bet button not found!");
  }

  if (cashoutBtn) {
    cashoutBtn.addEventListener("click", async () => {
      console.log("Cashout button clicked. currentBetId:", currentBetId, "gameState:", gameState);
      
      if (!currentBetId) {
        await showModal("No Active Bet", "You don't have an active bet to cashout");
        return;
      }

      // If gameState is not "running", try to sync state first
      if (gameState !== "running") {
        console.log("Game state is not 'running', syncing state...");
        try {
          await loadCurrentGame();
          // Check again after sync
          if (gameState !== "running") {
            const errorMsg = `Cannot cashout. Game state is: ${gameState}. Game must be running.`;
            console.error(errorMsg);
            await showModal("Cannot Cashout", errorMsg);
            return;
          }
        } catch (error) {
          console.error("Failed to sync game state:", error);
          const errorMsg = `Cannot cashout. Failed to sync game state: ${error.message}`;
          await showModal("Sync Error", errorMsg);
          return;
        }
      }

      cashoutBtn.disabled = true;

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          await showModal("Authentication Required", "Please login first");
          cashoutBtn.disabled = false;
          return;
        }

        const response = await fetch(`${API_URL}/crash/cashout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            betId: currentBetId,
          }),
        });

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
          console.error("Cashout error:", errorMessage, "Response status:", response.status);
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Emit WebSocket event
        if (socket && socket.connected) {
          socket.emit("bet:cashout", { betId: currentBetId });
        }

        // Update balance
        if (window.currentUser) {
          window.currentUser.balance += data.winAmount;
          if (typeof window.renderUser === "function") {
            window.renderUser();
          }
        }

        console.log("Cashout successful:", data);
        
        // Reset bet state first (before updateUI to hide bet info)
        currentBetId = null;
        currentBetAmount = 0;

        // Update UI immediately to hide bet info panel and disable cashout button
        updateUI();
        
        // Load history and show success message
        loadHistory();
        
        await showModal(
          "Cashout Successful",
          `Cashed out at ${data.multiplier.toFixed(2)}x!\nWin: $${data.winAmount.toFixed(2)}`
        );
        
        // Don't enable cashout button - bet is already cashed out, updateUI() will handle it
        // updateUI() already set cashoutBtn.disabled = true because currentBetId is now null
      } catch (error) {
        console.error("Cashout error:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          currentBetId,
          gameState
        });
        
        // On error, restore button state so user can try again
        cashoutBtn.disabled = false;
        await showModal("Cashout Failed", error.message || "Failed to cashout");
      }
    });
  }

  // Initial load if tab is already active
  if (!crashView.classList.contains("hidden")) {
    connectWebSocket();
    loadCurrentGame();
    loadHistory();
  }
});
