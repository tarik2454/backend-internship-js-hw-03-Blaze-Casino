/* eslint-env browser */
/* global io */
let chatSocket = null;
let currentRoom = "general";
const messagesByRoom = {};

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

function initChat() {
  if (chatSocket && chatSocket.connected) return;

  chatSocket = io();

  if (typeof window !== "undefined") {
    window.chatSocket = chatSocket;
  }

  chatSocket.on("connect", () => {
    joinRoom(currentRoom);
  });

  chatSocket.on("message", (data) => {
    const roomId = data.roomId || "general";
    addMessageToRoom(roomId, data);
    if (roomId === currentRoom) {
      renderMessages(roomId);
    }
  });

  chatSocket.on("disconnect", () => {
    // Socket disconnected
  });
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

function updateRoomUI(roomId) {
  const roomTitle = document.getElementById("chat-room-title");
  const currentRoomEl = document.getElementById("chat-current-room");
  const roomButtons = document.querySelectorAll(".chat-room-btn");

  if (roomTitle) {
    const roomNames = {
      general: "General Chat",
      casino: "Casino Chat",
      support: "Support Chat",
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
  messagesByRoom[roomId].push(messageData);

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
    // Показываем начальное сообщение, если сообщений нет
    const emptyMessage = `
      <div style="text-align: center; color: var(--text-dim); font-size: 0.875rem; padding: 1rem;">
        No messages yet. Start the conversation!
      </div>
    `;
    messagesContainer.innerHTML = emptyMessage;
    // Убедиться, что контейнер видим
    messagesContainer.style.display = "flex";
    messagesContainer.style.flexDirection = "column";
    messagesContainer.scrollTop = 0;
    return;
  }

  messagesContainer.innerHTML = messages
    .map((msg) => {
      const isOwnMessage =
        window.currentUser && msg.userId === window.currentUser._id;
      const timestamp = msg.timestamp
        ? new Date(msg.timestamp).toLocaleTimeString()
        : new Date().toLocaleTimeString();
      const username = msg.username || "Anonymous";

      return `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: ${isOwnMessage ? "flex-end" : "flex-start"};
          margin-bottom: 0.5rem;
        ">
          <div style="
            max-width: 70%;
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
          ">
            <div style="
              font-size: 0.75rem;
              color: ${
                isOwnMessage ? "rgba(255,255,255,0.8)" : "var(--text-dim)"
              };
              margin-bottom: 0.25rem;
            ">
              ${escapeHtml(username)}
            </div>
            <div style="color: white; word-wrap: break-word;">
              ${escapeHtml(msg.message || msg.text || "")}
            </div>
            <div style="
              font-size: 0.7rem;
              color: ${
                isOwnMessage ? "rgba(255,255,255,0.6)" : "var(--text-dim)"
              };
              margin-top: 0.25rem;
            ">
              ${timestamp}
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
  const userId = window.currentUser?._id || "anonymous";

  chatSocket.emit("chat:message", {
    roomId: currentRoom,
    message,
    username,
    userId,
  });

  input.value = "";
}

function setupChatHandlers() {
  // Проверить, что chat-view существует
  const chatView = document.getElementById("chat-view");
  if (!chatView) {
    console.error("[Chat] chat-view not found!");
    return;
  }

  // Убедиться, что элемент видим (удалить hidden)
  chatView.classList.remove("hidden");
  // Не устанавливаем display, так как в HTML уже есть inline стиль display: grid

  const roomButtons = document.querySelectorAll(".chat-room-btn");
  if (roomButtons.length === 0) {
    console.warn("[Chat] No room buttons found!");
    return;
  }

  roomButtons.forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    if (btn.parentNode) {
      btn.parentNode.replaceChild(newBtn, btn);
    }

    newBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const roomId = newBtn.getAttribute("data-room");
      if (roomId) {
        joinRoom(roomId);
      }
    });
  });

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

// Инициализация при загрузке страницы
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

// Экспорт
if (typeof window !== "undefined") {
  window.initChat = initChat;
  window.chatSocket = chatSocket;
  window.joinRoom = joinRoom;
  window.sendMessage = sendMessage;
}
