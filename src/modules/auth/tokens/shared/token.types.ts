export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenData {
  token: string;
  userId: string;
  expiresAt: Date;
  sessionStart: Date;
}

export interface RefreshResult {
  tokenPair: TokenPair;
  userId: string;
}

