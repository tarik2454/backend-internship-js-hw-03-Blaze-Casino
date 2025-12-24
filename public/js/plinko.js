/* eslint-env browser */
document.addEventListener("DOMContentLoaded", () => {
  const plinkoTabBtn = document.getElementById("tab-plinko");
  const plinkoContainer = document.getElementById("plinko-view");
  const playBtn = document.getElementById("plinko-play-btn");
  const riskSelect = document.getElementById("plinko-risk");
  const rowsSelect = document.getElementById("plinko-rows");
  const ballsSelect = document.getElementById("plinko-balls");
  const betInput = document.getElementById("plinko-bet");
  const canvas = document.getElementById("plinko-canvas");
  const ctx = canvas ? canvas.getContext("2d") : null;
  const historyTable = document.getElementById("plinko-history-table");

  const activeBalls = [];
  let animationRunning = false;
  let currentMultipliers = [];
  let currentLines = 16;
  let pendingBalanceUpdate = null;

  document.addEventListener("plinko:shown", () => {
    if (!animationRunning) {
      startAnimationLoop();
      loadMultipliers();
    }
    loadHistory();
  });

  if (!plinkoTabBtn || !plinkoContainer) return;

  plinkoTabBtn.addEventListener("click", () => {
    if (!animationRunning) {
      startAnimationLoop();
      loadMultipliers();
    }
  });

  riskSelect.addEventListener("change", loadMultipliers);

  const validateAndLoadLines = () => {
    let lines = parseInt(rowsSelect.value);
    if (isNaN(lines) || lines < 8) {
      lines = 8;
      rowsSelect.value = 8;
    } else if (lines > 16) {
      lines = 16;
      rowsSelect.value = 16;
    }
    loadMultipliers();
  };

  rowsSelect.addEventListener("change", validateAndLoadLines);
  rowsSelect.addEventListener("input", validateAndLoadLines);

  async function loadMultipliers() {
    const risk = riskSelect.value;
    const lines = parseInt(rowsSelect.value);
    currentLines = lines;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch(
        `/api/plinko/multipliers?risk=${risk}&lines=${lines}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        currentMultipliers = data.multipliers || [];
      }
    } catch (error) {
      currentMultipliers = getDefaultMultipliers(lines, risk);
    }
  }

  function getDefaultMultipliers(lines, risk) {
    if (lines === 16 && risk === "medium") {
      return [
        110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110,
      ];
    }
    if (lines === 16 && risk === "low") {
      return [
        16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16,
      ];
    }
    if (lines === 16 && risk === "high") {
      return [
        1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000,
      ];
    }
    return [];
  }

  if (playBtn) {
    playBtn.addEventListener("click", async () => {
      const bet = parseFloat(betInput.value);
      const risk = riskSelect.value;
      const lines = parseInt(rowsSelect.value);
      const balls = parseInt(ballsSelect.value);

      if (isNaN(bet) || bet <= 0) {
        alert("Invalid bet amount");
        return;
      }

      if (isNaN(lines) || lines < 8 || lines > 16) {
        alert("Lines must be between 8 and 16");
        return;
      }

      const totalBet = bet * balls;

      if (!window.currentUser || window.currentUser.balance < totalBet) {
        alert("Insufficient balance");
        return;
      }

      playBtn.disabled = true;

      if (window.currentUser) {
        window.currentUser.balance -= totalBet;
        if (typeof window.renderUser === "function") {
          window.renderUser();
        }
        window.dispatchEvent(
          new CustomEvent("balance:update", {
            detail: { newBalance: window.currentUser.balance },
            bubbles: true,
          })
        );
      }

      try {
        const apiUrl = "/api/plinko/drop";
        const token = localStorage.getItem("token");
        if (!token) {
          if (window.currentUser) {
            window.currentUser.balance += totalBet;
            if (typeof window.renderUser === "function") {
              window.renderUser();
            }
          }
          alert("Please login first");
          return;
        }

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount: bet, risk, lines, balls }),
        });

        if (!response.ok) {
          if (window.currentUser) {
            window.currentUser.balance += totalBet;
            if (typeof window.renderUser === "function") {
              window.renderUser();
            }
          }
          playBtn.disabled = false;
          const errorData = await response.json();
          throw new Error(errorData.message || "Game failed");
        }

        const data = await response.json();

        const finalBalance =
          data.newBalance !== undefined
            ? data.newBalance
            : window.currentUser.balance + (data.totalWin || 0);

        pendingBalanceUpdate = {
          newBalance: finalBalance,
          totalWin: data.totalWin || 0,
          totalBet: data.totalBet || totalBet,
          ballsCount: balls,
        };

        if (data.drops && data.drops.length > 0) {
          let ballsAdded = 0;
          data.drops.forEach((drop, index) => {
            setTimeout(() => {
              addBall(
                drop.path,
                lines,
                drop.multiplier,
                drop.winAmount,
                drop.slotIndex
              );
              ballsAdded++;
              if (ballsAdded === data.drops.length) {
                checkAndUpdateBalance();
              }
            }, index * 400);
          });
        } else {
          applyBalanceUpdate();
          playBtn.disabled = false;
        }

        addToHistory({
          bet: bet,
          balls: balls,
          lines: lines,
          risk: risk,
          multiplier: (data.totalWin / data.totalBet).toFixed(2),
          winAmount: data.totalWin,
        });
      } catch (error) {
        alert(error.message);
        if (playBtn) playBtn.disabled = false;
      }
    });
  }

  function startAnimationLoop() {
    animationRunning = true;
    function loop() {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderBoard();
      renderSlots();
      updateAndDrawBalls();

      requestAnimationFrame(loop);
    }
    loop();
  }

  function getSlotColor(multiplier, maxMultiplier) {
    const ratio = multiplier / maxMultiplier;

    if (ratio >= 0.8) return "#FF0000";
    if (ratio >= 0.5) return "#FF6600";
    if (ratio >= 0.3) return "#FFAA00";
    if (ratio >= 0.15) return "#FFD700";
    if (ratio >= 0.1) return "#90EE90";
    if (ratio >= 0.05) return "#32CD32";
    return "#228B22";
  }

  function renderSlots() {
    if (!ctx || !canvas || currentMultipliers.length === 0) return;

    const lines = currentLines;
    const startY = 50;
    const spacing = 30;
    const slotY = startY + (lines + 1) * spacing + 10;
    const slotHeight = 45;
    const width = canvas.width;
    const slotCount = currentMultipliers.length;
    const slotWidth = (width * 0.9) / slotCount;
    const startX = width * 0.05;

    const maxMultiplier = Math.max(...currentMultipliers);

    currentMultipliers.forEach((multiplier, index) => {
      const x = startX + index * slotWidth;
      const color = getSlotColor(multiplier, maxMultiplier);

      ctx.fillStyle = color;
      ctx.fillRect(x, slotY, slotWidth - 2, slotHeight);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, slotY, slotWidth - 2, slotHeight);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        multiplier.toString(),
        x + (slotWidth - 2) / 2,
        slotY + slotHeight / 2
      );
    });
  }

  function renderBoard() {
    if (!ctx || !canvas) return;
    const lines = currentLines;
    const width = canvas.width;

    ctx.fillStyle = "#ffffff";
    const startY = 50;
    const spacing = 30;

    for (let i = 0; i <= lines; i++) {
      for (let j = 0; j <= i; j++) {
        const x = width / 2 + (j - i / 2) * spacing;
        const y = startY + i * spacing;

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function addBall(path, lines, multiplier, win, slotIndex) {
    activeBalls.push({
      path,
      currentStep: 0,
      progress: 0,
      row: 0,
      col: 0,
      lines,
      multiplier,
      win,
      slotIndex,
      finished: false,
      highlightSlot: false,
    });
  }

  function applyBalanceUpdate() {
    if (!pendingBalanceUpdate || !window.currentUser) {
      if (playBtn) playBtn.disabled = false;
      return;
    }

    const { newBalance } = pendingBalanceUpdate;

    if (newBalance !== undefined) {
      window.currentUser.balance = newBalance;

      if (typeof window.renderUser === "function") {
        window.renderUser();
      }

      window.dispatchEvent(
        new CustomEvent("balance:update", {
          detail: { newBalance: window.currentUser.balance },
          bubbles: true,
        })
      );
    }

    pendingBalanceUpdate = null;
    if (playBtn) playBtn.disabled = false;
  }

  function checkAndUpdateBalance() {
    const checkInterval = setInterval(() => {
      if (activeBalls.length === 0 && pendingBalanceUpdate) {
        clearInterval(checkInterval);
        applyBalanceUpdate();
      }
    }, 100);

    setTimeout(() => {
      if (pendingBalanceUpdate) {
        clearInterval(checkInterval);
        applyBalanceUpdate();
      }
    }, 10000);
  }

  function updateAndDrawBalls() {
    const startY = 50;
    const spacing = 30;
    const width = canvas.width;
    const slotY = startY + (currentLines + 1) * spacing + 10;
    const slotHeight = 40;
    const slotCount = currentMultipliers.length;
    const slotWidth = (width * 0.9) / slotCount;
    const startX = width * 0.05;

    for (let i = activeBalls.length - 1; i >= 0; i--) {
      const ball = activeBalls[i];

      ball.progress += 0.15;

      if (ball.progress >= 1) {
        ball.progress = 0;
        ball.currentStep++;

        if (ball.currentStep >= ball.path.length) {
          ball.highlightSlot = true;

          if (ball.slotIndex >= 0 && ball.slotIndex < slotCount) {
            const slotX = startX + ball.slotIndex * slotWidth;
            ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
            ctx.fillRect(slotX, slotY, slotWidth - 2, slotHeight);

            ctx.fillStyle = "#fff";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            const text =
              ball.win > 0
                ? `+$${ball.win.toFixed(2)}`
                : `-$${Math.abs(ball.win).toFixed(2)}`;
            ctx.fillText(text, slotX + (slotWidth - 2) / 2, slotY - 20);
          }

          setTimeout(() => {
            const idx = activeBalls.indexOf(ball);
            if (idx > -1) {
              activeBalls.splice(idx, 1);
              if (activeBalls.length === 0 && pendingBalanceUpdate) {
                applyBalanceUpdate();
              }
            }
          }, 2000);

          continue;
        }

        ball.row++;
        const direction = ball.path[ball.currentStep];
        ball.col += direction;
      }

      const currentPathIndex = ball.currentStep;

      let startCol = 0;
      for (let k = 0; k < currentPathIndex; k++) startCol += ball.path[k];

      let endCol = startCol;
      if (currentPathIndex < ball.path.length) {
        endCol += ball.path[currentPathIndex];
      }

      const t = ball.progress;
      const renderRow = currentPathIndex + t;
      const renderCol = startCol + (endCol - startCol) * t;

      const x = width / 2 + (renderCol - renderRow / 2) * spacing;
      let y = startY + renderRow * spacing;

      if (ball.currentStep >= ball.path.length) {
        if (ball.slotIndex >= 0 && ball.slotIndex < slotCount) {
          const slotX = startX + ball.slotIndex * slotWidth;
          y = slotY + slotHeight / 2;
          const ballX = slotX + (slotWidth - 2) / 2;

          ctx.fillStyle = "#ff0000";
          ctx.beginPath();
          ctx.arc(ballX, y, 6, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 10;
          ctx.shadowColor = "#ff0000";
          ctx.beginPath();
          ctx.arc(ballX, y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      } else {
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(x, y - 5, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  async function loadHistory() {
    if (!historyTable) return;

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/plinko/history?limit=10", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        historyTable.innerHTML = "";

        if (data.drops && data.drops.length > 0) {
          data.drops.forEach((drop) => {
            addHistoryRow({
              bet: drop.betAmount,
              balls: drop.ballsCount,
              lines: drop.linesCount,
              risk: drop.riskLevel,
              multiplier: drop.avgMultiplier || "0.00",
              winAmount: drop.totalWin || 0,
              createdAt: drop.createdAt,
            });
          });
        }
      }
    } catch (error) {
    }
  }

  function addHistoryRow(data) {
    if (!historyTable) return;

    const row = document.createElement("tr");
    const date = data.createdAt ? new Date(data.createdAt) : new Date();
    const timeStr = date.toLocaleTimeString();

    const totalBet = data.bet * data.balls;
    const profit = data.winAmount - totalBet;
    const profitClass =
      profit >= 0 ? "var(--accent-success)" : "var(--accent-error)";

    row.innerHTML = `
      <td style="padding: 1rem">${timeStr}</td>
      <td style="padding: 1rem">$${data.bet.toFixed(2)}</td>
      <td style="padding: 1rem">${data.balls}</td>
      <td style="padding: 1rem">${data.lines}</td>
      <td style="padding: 1rem; text-transform: capitalize">${data.risk}</td>
      <td style="padding: 1rem; font-weight: 700; color: #ffd700">${
        data.multiplier
      }x</td>
      <td style="padding: 1rem; font-weight: 700; color: ${profitClass}">$${
      profit >= 0 ? "+" : ""
    }${profit.toFixed(2)}</td>
    `;

    historyTable.insertBefore(row, historyTable.firstChild);
  }

  function addToHistory(data) {
    addHistoryRow({
      bet: data.bet,
      balls: data.balls,
      lines: data.lines,
      risk: data.risk,
      multiplier: data.multiplier,
      winAmount: data.winAmount,
      createdAt: new Date().toISOString(),
    });
  }

  loadMultipliers();
  loadHistory();
});
