let chatSocket = null;
let currentRoom = "general";
const messagesByRoom = {};

function escapeHtml(text) {
  if (typeof text !== "string") {
    if (text === null || text === undefined) {
      return "";
    }
    if (typeof text === "object") {
      if (text.text) return escapeHtml(text.text);
      if (text.message) return escapeHtml(text.message);
      return "";
    }
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

function initChat() {
  if (chatSocket && chatSocket.connected) return;

  const accessToken = localStorage.getItem("accessToken");

  if (!accessToken) {
    console.error("[Chat] No access token available");
    return;
  }

  chatSocket = io({
    auth: {
      token: accessToken,
    },
  });

  if (typeof window !== "undefined") {
    window.chatSocket = chatSocket;
  }

  chatSocket.on("connect", () => {
    joinRoom(currentRoom);
  });

  chatSocket.on("chat:error", (data) => {
    console.error("[Chat] Error:", data.message);
    if (
      data.message === "Authentication token required" ||
      data.message === "Invalid authentication token" ||
      data.message === "User not found"
    ) {
      if (typeof showToast === "function") {
        showToast("Authentication failed. Please login again.", true);
      }
    }
  });

  chatSocket.on("chat:rooms", (rooms) => {
    renderRooms(rooms);
  });

  chatSocket.on("message", (data) => {
    const roomId = data.roomId || "general";

    const messageData = {
      _id: data._id,
      username: data.username || "Anonymous",
      text: data.text || data.message || "",
      time: data.time || new Date().toLocaleTimeString(),
      roomId: roomId,
      userId: data.userId || null,
      timestamp: data.timestamp || new Date().toISOString(),
    };

    console.log("[Chat] Message received:", {
      roomId: messageData.roomId,
      username: messageData.username,
      messageUserId: messageData.userId,
      currentUser: window.currentUser,
      currentUserId: window.currentUser?._id,
      currentUserKeys: window.currentUser
        ? Object.keys(window.currentUser)
        : [],
    });

    addMessageToRoom(roomId, messageData);
    if (roomId === currentRoom) {
      renderMessages(roomId);
    }
  });

  // История комнаты, отправляется сервером при join
  chatSocket.on("chat:history", (data) => {
    if (!data || !data.roomId || !Array.isArray(data.messages)) return;
    data.messages.forEach((msg) => {
      addMessageToRoom(data.roomId, {
        _id: msg._id,
        username: msg.username || "Anonymous",
        text: msg.text || "",
        time:
          msg.time ||
          (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""),
        roomId: data.roomId,
        userId: msg.userId || null,
        timestamp: msg.createdAt || new Date().toISOString(),
      });
    });
    if (data.roomId === currentRoom) {
      renderMessages(data.roomId);
    }
  });

  chatSocket.on("disconnect", () => {});
}

function joinRoom(roomId) {
  if (!chatSocket || !chatSocket.connected) {
    initChat();
    setTimeout(() => joinRoom(roomId), 500);
    return;
  }

  if (currentRoom && currentRoom !== roomId) {
    chatSocket.emit("chat:leave", { roomId: currentRoom });
  }

  currentRoom = roomId;
  chatSocket.emit("chat:join", { roomId });

  updateRoomUI(roomId);
  renderMessages(roomId);
}

function renderRooms(rooms) {
  const roomsList = document.getElementById("chat-rooms-list");
  if (!roomsList || !rooms) return;

  roomsList.innerHTML = rooms
    .map((room) => {
      const isActive = room.id === currentRoom;
      const roomIcons = {
        general: "💬",
        crash: "🚀",
      };
      return `
        <button
          class="chat-room-btn ${isActive ? "active" : ""}"
          data-room="${room.id}"
          style="
            width: 100%;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            text-align: left;
            background: ${
              isActive
                ? "rgba(102, 126, 234, 0.2)"
                : "rgba(255, 255, 255, 0.05)"
            };
            border: 1px solid ${
              isActive ? "rgba(102, 126, 234, 0.3)" : "rgba(255, 255, 255, 0.1)"
            };
            border-radius: 0.5rem;
            color: white;
            cursor: pointer;
          "
        >
          ${roomIcons[room.id] || "💬"} ${room.name}
        </button>
      `;
    })
    .join("");

  // Добавляем обработчики событий для кнопок
  const roomButtons = roomsList.querySelectorAll(".chat-room-btn");
  roomButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const roomId = btn.getAttribute("data-room");
      if (roomId) {
        joinRoom(roomId);
      }
    });
  });
}

function renderRooms(rooms) {
  const roomsList = document.getElementById("chat-rooms-list");
  if (!roomsList || !rooms) return;

  roomsList.innerHTML = rooms
    .map((room) => {
      const isActive = room.id === currentRoom;
      const roomIcons = {
        general: "💬",
        crash: "🚀",
      };
      return `
        <button
          class="chat-room-btn ${isActive ? "active" : ""}"
          data-room="${room.id}"
          style="
            width: 100%;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            text-align: left;
            background: ${
              isActive
                ? "rgba(102, 126, 234, 0.2)"
                : "rgba(255, 255, 255, 0.05)"
            };
            border: 1px solid ${
              isActive ? "rgba(102, 126, 234, 0.3)" : "rgba(255, 255, 255, 0.1)"
            };
            border-radius: 0.5rem;
            color: white;
            cursor: pointer;
          "
        >
          ${roomIcons[room.id] || "💬"} ${room.name}
        </button>
      `;
    })
    .join("");

  // Добавляем обработчики событий для кнопок
  const roomButtons = roomsList.querySelectorAll(".chat-room-btn");
  roomButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const roomId = btn.getAttribute("data-room");
      if (roomId) {
        joinRoom(roomId);
      }
    });
  });
}

function updateRoomUI(roomId) {
  const roomTitle = document.getElementById("chat-room-title");
  const currentRoomEl = document.getElementById("chat-current-room");
  const roomButtons = document.querySelectorAll(".chat-room-btn");

  if (roomTitle) {
    const roomNames = {
      general: "General Chat",
      crash: "Crash Chat",
    };
    roomTitle.textContent = roomNames[roomId] || `${roomId} Chat`;
  }

  if (currentRoomEl) {
    currentRoomEl.textContent =
      roomId.charAt(0).toUpperCase() + roomId.slice(1);
  }

  roomButtons.forEach((btn) => {
    const btnRoom = btn.getAttribute("data-room");
    if (btnRoom === roomId) {
      btn.classList.add("active");
      btn.style.background = "rgba(102, 126, 234, 0.2)";
      btn.style.border = "1px solid rgba(102, 126, 234, 0.3)";
    } else {
      btn.classList.remove("active");
      btn.style.background = "rgba(255, 255, 255, 0.05)";
      btn.style.border = "1px solid rgba(255, 255, 255, 0.1)";
    }
  });
}

function addMessageToRoom(roomId, messageData) {
  if (!messagesByRoom[roomId]) {
    messagesByRoom[roomId] = [];
  }

  const exists = messagesByRoom[roomId].some((m) => {
    if (m._id && messageData._id) return m._id === messageData._id;
    return (
      m.timestamp === messageData.timestamp &&
      m.username === messageData.username &&
      m.text === messageData.text
    );
  });

  if (!exists) {
    messagesByRoom[roomId].push(messageData);
    // keep chronological order
    messagesByRoom[roomId].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  if (roomId === currentRoom) {
    renderMessages(roomId);
  }
}

function renderMessages(roomId) {
  const messagesContainer = document.getElementById("chat-messages");
  if (!messagesContainer) {
    console.warn("[Chat] chat-messages container not found!");
    return;
  }

  const messages = messagesByRoom[roomId] || [];

  if (messages.length === 0) {
    const emptyMessage = `
      <div style="text-align: center; color: var(--text-dim); font-size: 0.875rem; padding: 1rem;">
        No messages yet. Start the conversation!
      </div>
    `;
    messagesContainer.innerHTML = emptyMessage;

    messagesContainer.style.display = "flex";
    messagesContainer.style.flexDirection = "column";
    messagesContainer.scrollTop = 0;
    return;
  }

  messagesContainer.innerHTML = messages
    .map((msg) => {
      let messageText = "";
      if (typeof msg === "string") {
        messageText = msg;
      } else if (typeof msg === "object" && msg !== null) {
        messageText = msg.text || msg.message || "";
        if (typeof messageText === "object") {
          messageText = JSON.stringify(messageText);
        }
      }

      const username = (msg.username || "Anonymous").toString();
      const timestamp = (
        msg.time ||
        (msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString()
          : new Date().toLocaleTimeString())
      ).toString();

      let isOwnMessage = false;
      if (window.currentUser) {
        const currentUserId = String(
          window.currentUser._id ||
            window.currentUser.id ||
            window.currentUser.userId ||
            ""
        ).trim();

        const messageUserId =
          msg.userId && msg.userId !== "anonymous"
            ? String(msg.userId).trim()
            : "";

        if (currentUserId && messageUserId && messageUserId !== "anonymous") {
          isOwnMessage = currentUserId === messageUserId;
        }

        console.log("[Chat] Message ownership check:", {
          currentUser: window.currentUser,
          currentUserId,
          messageUserId: msg.userId,
          normalizedMessageUserId: messageUserId,
          isOwnMessage,
          username: msg.username,
        });
      }

      return `
        <div style="
          display: flex;
          flex-direction: row;
          justify-content: ${isOwnMessage ? "flex-end" : "flex-start"};
          align-items: flex-start;
          margin-bottom: 0.75rem;
          width: 100%;
        ">
          <div style="
            max-width: 70%;
            min-width: 120px;
            padding: 0.75rem 1rem;
            background: ${
              isOwnMessage
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "rgba(255, 255, 255, 0.05)"
            };
            border-radius: 0.75rem;
            border: 1px solid ${
              isOwnMessage
                ? "rgba(102, 126, 234, 0.3)"
                : "rgba(255, 255, 255, 0.1)"
            };
            display: flex;
            flex-direction: column;
          ">
            <div style="
              font-size: 0.75rem;
              color: ${
                isOwnMessage ? "rgba(255,255,255,0.8)" : "var(--text-dim)"
              };
              margin-bottom: 0.25rem;
              font-weight: ${isOwnMessage ? "500" : "400"};
            ">
              ${escapeHtml(username)}
            </div>
            <div style="color: white; word-wrap: break-word; line-height: 1.4;">
              ${escapeHtml(messageText)}
            </div>
            <div style="
              font-size: 0.7rem;
              color: ${
                isOwnMessage ? "rgba(255,255,255,0.6)" : "var(--text-dim)"
              };
              margin-top: 0.25rem;
              text-align: ${isOwnMessage ? "right" : "left"};
            ">
              ${escapeHtml(timestamp)}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("chat-message-input");
  if (!input || !input.value.trim()) return;

  if (!chatSocket || !chatSocket.connected) {
    initChat();
    setTimeout(() => sendMessage(), 500);
    return;
  }

  const message = input.value.trim();
  const username =
    window.currentUser?.username || window.currentUser?.email || "Anonymous";
  const userId = window.currentUser?._id
    ? String(window.currentUser._id)
    : null;

  if (!userId) {
    console.error("[Chat] Cannot send message: user ID is missing");
    return;
  }

  console.log("[Chat] Sending message:", {
    roomId: currentRoom,
    username,
    userId,
  });

  chatSocket.emit("chat:message", {
    roomId: currentRoom,
    message,
    username,
    userId,
  });

  input.value = "";
}

function setupChatHandlers() {
  const chatView = document.getElementById("chat-view");
  if (!chatView) {
    console.error("[Chat] chat-view not found!");
    return;
  }

  chatView.classList.remove("hidden");
  // Не устанавливаем display, так как в HTML уже есть inline стиль display: grid

  const sendBtn = document.getElementById("chat-send-btn");
  const messageInput = document.getElementById("chat-message-input");

  if (!sendBtn || !messageInput) {
    console.warn("[Chat] Send button or input not found!");
    return;
  }

  sendBtn.onclick = (e) => {
    e.preventDefault();
    sendMessage();
  };

  messageInput.onkeypress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };
}

// Инициализация при показе чата
document.addEventListener("chat:shown", () => {
  // Проверить, что chat-view видим
  const chatViewEl = document.getElementById("chat-view");
  if (!chatViewEl) {
    console.error("[Chat] chat-view element not found!");
    return;
  }

  // Убедиться, что класс hidden удален и элемент видим
  chatViewEl.classList.remove("hidden");
  // Не устанавливаем display, так как в HTML уже есть inline стиль display: grid

  // Небольшая задержка для гарантии, что DOM обновился
  setTimeout(() => {
    // Проверить, что все элементы доступны
    const messagesContainer = document.getElementById("chat-messages");
    const roomsList = document.getElementById("chat-rooms-list");
    const sendBtn = document.getElementById("chat-send-btn");
    const messageInput = document.getElementById("chat-message-input");

    if (!messagesContainer) {
      console.error("[Chat] chat-messages not found!");
    }
    if (!roomsList) {
      console.error("[Chat] chat-rooms-list not found!");
    }
    if (!sendBtn) {
      console.error("[Chat] chat-send-btn not found!");
    }
    if (!messageInput) {
      console.error("[Chat] chat-message-input not found!");
    }

    // Убедиться, что chat-view видим
    if (chatViewEl.classList.contains("hidden")) {
      chatViewEl.classList.remove("hidden");
    }

    // Проверить родительский элемент main-section
    const mainSection = document.getElementById("main-section");
    if (mainSection && mainSection.classList.contains("hidden")) {
      console.warn("[Chat] main-section is hidden!");
      mainSection.classList.remove("hidden");
    }

    setupChatHandlers();

    if (!chatSocket || !chatSocket.connected) {
      initChat();
    } else {
      joinRoom(currentRoom);
    }

    updateRoomUI(currentRoom);
    renderMessages(currentRoom);

    // Финальная проверка видимости
    const computedStyle = window.getComputedStyle(chatViewEl);
    if (computedStyle.display === "none") {
      console.error("[Chat] chat-view is still hidden after initialization!");
      chatViewEl.style.display = "block";
    }
  }, 100);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      setupChatHandlers();
      initChat();
    }, 500);
  });
} else {
  setTimeout(() => {
    setupChatHandlers();
    initChat();
  }, 500);
}

if (typeof window !== "undefined") {
  window.initChat = initChat;
  window.chatSocket = chatSocket;
  window.joinRoom = joinRoom;
  window.sendMessage = sendMessage;
}
