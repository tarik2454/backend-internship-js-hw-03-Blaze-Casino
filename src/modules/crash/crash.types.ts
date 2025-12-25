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
  createdAt?: Date;
}

export interface GetCrashHistoryResponse {
  games: CrashGameHistory[];
}

export interface CrashBet {
  betId: string;
  userId: string;
  amount: number;
  multiplier?: number;
}

export interface GetCurrentCrashResponse {
  gameId: string;
  state: "waiting" | "running" | "crashed";
  multiplier?: number;
  serverSeedHash: string;
  bets: CrashBet[];
  myBet?: {
    betId: string;
    amount: number;
  };
}
