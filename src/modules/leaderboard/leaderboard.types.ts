export type PeriodType = "daily" | "weekly" | "monthly" | "all";

export interface LeaderboardPlayer {
  rank: number;
  username: string;
  avatarURL: string | null;
  totalWagered: number;
  gamesPlayed: number;
  winRate: number;
}

export interface LeaderboardResponse {
  players: LeaderboardPlayer[];
  currentUser: LeaderboardPlayer | null;
}
