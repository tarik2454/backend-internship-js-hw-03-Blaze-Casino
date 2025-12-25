export interface GameTickEvent {
  gameId: string;
  multiplier: number;
  elapsed: number;
}

export interface GameCrashEvent {
  gameId: string;
  crashPoint: number;
  serverSeed: string;
  reveal: string;
}

export interface BetPlaceEvent {
  amount: number;
  autoCashout?: number;
}

export interface BetCashoutEvent {
  betId: string;
}
