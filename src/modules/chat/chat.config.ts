export interface ChatRoom {
  id: string;
  name: string;
}

export const CHAT_ROOMS: ChatRoom[] = [
  { id: "general", name: "General Chat" },
  { id: "crash", name: "Crash Chat" },
];

export const BOT_NAME = "Chat Bot";
