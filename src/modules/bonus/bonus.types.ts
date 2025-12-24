export interface BonusStatusResponse {
  nextClaimAt: string;
  amount: number;
  baseAmount: number;
  wagerBonus: number;
  gamesBonus: number;
}

export interface ClaimBonusResponse {
  amount: number;
  balance: number;
  nextClaimAt: string;
}
