import { IChatMessage } from "../models/chat-message.types";

export interface ChatJoinEvent {
  roomId: string;
}

export interface ChatLeaveEvent {
  roomId: string;
}

export interface ChatMessageEvent {
  roomId: string;
  message: string;
  username: string;
  userId: string;
}

export interface ChatHistoryEvent {
  roomId: string;
  messages: IChatMessage[];
}

export interface ChatErrorEvent {
  message: string;
}

export interface ChatRoomWithUsers {
  id: string;
  name: string;
  activeUsers: number;
}

export interface ChatRoomUsersEvent {
  roomId: string;
  activeUsers: number;
}
