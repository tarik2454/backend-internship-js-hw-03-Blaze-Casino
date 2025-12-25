export interface BetCrashResponse {
  betId: string;
  amount: number;
  gameId: string;
}

export interface CashoutCrashResponse {
  multiplier: number;
  winAmount: number;
}

export interface CrashGameHistory {
  gameId: string;
  crashPoint: number;
  hash: string;
  seed: string;
}

export interface GetCrashHistoryResponse {
  games: CrashGameHistory[];
}

export interface GetCurrentCrashResponse {
  gameId: string;
  state: "waiting" | "running" | "crashed";
  multiplier?: number;
  serverSeedHash: string;
  myBet?: {
    betId: string;
    amount: number;
  };
}

export interface CrashBetHistory {
  betId: string;
  gameId: string;
  amount: number;
  cashoutMultiplier?: number;
  winAmount?: number;
  status: "won" | "lost";
  crashPoint: number;
  createdAt: Date;
}

export interface GetBetHistoryResponse {
  bets: CrashBetHistory[];
}
