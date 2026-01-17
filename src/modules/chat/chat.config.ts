export interface ChatRoom {
  id: string;
  name: string;
}

export const CHAT_ROOMS: ChatRoom[] = [
  { id: "general", name: "General Chat" },
  { id: "crash", name: "Crash Chat" },
  { id: "mines", name: "Mines Chat" },
  { id: "cases", name: "Cases Chat" },
  { id: "plinko", name: "Plinko Chat" },
];

export const BOT_NAME = "Chat Bot";
