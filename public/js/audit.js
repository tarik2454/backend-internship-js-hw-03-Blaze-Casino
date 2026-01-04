const currentAuditFilters = {
  entityType: "",
  limit: 50,
  offset: 0,
};

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatAction(action) {
  const actionMap = {
    LOGIN: "🔐 Login",
    LOGOUT: "🚪 Logout",
    REGISTER: "📝 Register",
    OPEN_CASE: "📦 Open Case",
    CLAIM_BONUS: "🎁 Claim Bonus",
    BET: "🎲 Bet",
    CASHOUT: "💰 Cashout",
    REVEAL: "🔍 Reveal",
    CREATE: "➕ Create",
    UPDATE: "✏️ Update",
    DELETE: "🗑️ Delete",
  };
  return actionMap[action] || action;
}

function formatDetails(log) {
  const details = [];

  if (log.oldValue && Object.keys(log.oldValue).length > 0) {
    details.push(
      `<strong>Old:</strong> ${JSON.stringify(log.oldValue, null, 2)}`
    );
  }

  if (log.newValue && Object.keys(log.newValue).length > 0) {
    details.push(
      `<strong>New:</strong> ${JSON.stringify(log.newValue, null, 2)}`
    );
  }

  if (details.length === 0) {
    return "-";
  }

  return `<details style="cursor: pointer;"><summary style="color: var(--text-dim);">View Details</summary><pre style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 0.25rem; font-size: 0.75rem; overflow-x: auto;">${details.join(
    "<br>"
  )}</pre></details>`;
}

async function loadAuditLogs() {
  const loadingEl = document.getElementById("audit-loading");
  const errorEl = document.getElementById("audit-error");
  const tableEl = document.getElementById("audit-logs-table");
  const statsEl = document.getElementById("audit-stats");
  const totalEl = document.getElementById("audit-total");
  const showingEl = document.getElementById("audit-showing");

  loadingEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  statsEl.classList.add("hidden");
  tableEl.innerHTML = "";

  try {
    if (!window.authenticatedFetch) {
      throw new Error("Not authenticated");
    }

    const params = new URLSearchParams();
    if (currentAuditFilters.entityType) {
      params.append("entityType", currentAuditFilters.entityType);
    }
    params.append("limit", currentAuditFilters.limit.toString());
    params.append("offset", currentAuditFilters.offset.toString());

    const response = await window.authenticatedFetch(
      `${window.API_URL}/audit?${params.toString()}`
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to load audit logs");
    }

    const data = await response.json();

    loadingEl.classList.add("hidden");
    statsEl.classList.remove("hidden");

    totalEl.textContent = data.total || 0;
    showingEl.textContent = `${data.logs?.length || 0} of ${data.total || 0}`;

    if (!data.logs || data.logs.length === 0) {
      tableEl.innerHTML = `
        <tr>
          <td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-dim);">
            No logs found
          </td>
        </tr>
      `;
      return;
    }

    tableEl.innerHTML = data.logs
      .map(
        (log) => `
      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
        <td style="padding: 0.75rem; color: var(--text-dim); font-size: 0.8rem;">
          ${formatDate(log.createdAt)}
        </td>
        <td style="padding: 0.75rem;">
          ${formatAction(log.action)}
        </td>
        <td style="padding: 0.75rem; color: var(--text-dim);">
          ${escapeHtml(log.entityType)}
        </td>
        <td style="padding: 0.75rem;">
          ${
            log.userId
              ? escapeHtml(
                  log.userId.username ||
                    log.userId.email ||
                    log.userId._id ||
                    "-"
                )
              : "-"
          }
        </td>
        <td style="padding: 0.75rem; color: var(--text-dim); font-size: 0.8rem;">
          ${escapeHtml(log.ipAddress || "-")}
        </td>
        <td style="padding: 0.75rem; max-width: 300px;">
          ${formatDetails(log)}
        </td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.textContent = `Error: ${error.message}`;
    tableEl.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--accent-error);">
          Failed to load logs: ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("audit-refresh-btn");
  const filterType = document.getElementById("audit-filter-type");
  const filterLimit = document.getElementById("audit-filter-limit");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      currentAuditFilters.entityType = filterType?.value || "";
      currentAuditFilters.limit = parseInt(filterLimit?.value || "50", 10);
      currentAuditFilters.limit = Math.min(
        Math.max(currentAuditFilters.limit, 1),
        100
      );
      currentAuditFilters.offset = 0;
      loadAuditLogs();
    });
  }

  if (filterType) {
    filterType.addEventListener("change", () => {
      currentAuditFilters.entityType = filterType.value || "";
      currentAuditFilters.offset = 0;
      loadAuditLogs();
    });
  }

  if (filterLimit) {
    filterLimit.addEventListener("change", () => {
      currentAuditFilters.limit = parseInt(filterLimit.value || "50", 10);
      currentAuditFilters.limit = Math.min(
        Math.max(currentAuditFilters.limit, 1),
        100
      );
      currentAuditFilters.offset = 0;
      loadAuditLogs();
    });
  }

  document.addEventListener("audit:shown", () => {
    loadAuditLogs();
  });
});
