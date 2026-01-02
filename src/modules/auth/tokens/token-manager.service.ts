import accessTokenService from "./access-token/access-token.service";
import refreshTokenService from "./refresh-token/refresh-token.service";
import { TokenPair, RefreshResult } from "./shared/token.types";

class TokenManager {
  async generateTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = accessTokenService.generate(userId);
    const refreshToken = await refreshTokenService.create(userId);

    return {
      accessToken,
      refreshToken,
    };
  }

  async refreshTokens(oldRefreshToken: string): Promise<RefreshResult> {
    const existingToken = await refreshTokenService.validate(oldRefreshToken);

    await refreshTokenService.delete(oldRefreshToken);

    const newRefreshToken = await refreshTokenService.create(
      existingToken.userId.toString(),
      existingToken.sessionStart
    );
    const newAccessToken = accessTokenService.generate(
      existingToken.userId.toString()
    );

    return {
      tokenPair: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
      userId: existingToken.userId.toString(),
    };
  }

  async revokeAllTokens(userId: string): Promise<void> {
    await refreshTokenService.deleteAll(userId);
  }

  verifyAccessToken(token: string): { userId: string } {
    return accessTokenService.verify(token);
  }
}

export default new TokenManager();

