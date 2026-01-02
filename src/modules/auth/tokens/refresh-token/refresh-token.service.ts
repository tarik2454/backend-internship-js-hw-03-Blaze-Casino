import { randomBytes } from "crypto";
import { HttpError } from "../../../../helpers/index";
import refreshTokenRepository from "./refresh-token.repository";
import {
  REFRESH_TOKEN_EXPIRES_IN_MS,
  MAX_SESSION_AGE_MS,
} from "../shared/token.config";
import { IRefreshToken } from "../../models/refresh-token.types";

class RefreshTokenService {
  async create(userId: string, sessionStart?: Date): Promise<string> {
    const refreshToken = randomBytes(64).toString("hex");
    const now = new Date();
    const start = sessionStart || now;
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_EXPIRES_IN_MS);

    await refreshTokenRepository.create({
      token: refreshToken,
      userId,
      expiresAt,
      sessionStart: start,
    });

    return refreshToken;
  }

  async validate(token: string): Promise<IRefreshToken> {
    if (!token) {
      throw HttpError(401, "No token provided");
    }

    const existingToken = await refreshTokenRepository.findByToken(token);
    if (!existingToken) {
      throw HttpError(401, "Invalid token");
    }

    if (existingToken.expiresAt < new Date()) {
      throw HttpError(401, "Refresh token expired");
    }

    const now = new Date();
    const sessionAge =
      now.getTime() - (existingToken.sessionStart?.getTime() ?? 0);

    if (sessionAge > MAX_SESSION_AGE_MS) {
      throw HttpError(401, "Session expired");
    }

    return existingToken;
  }

  async delete(token: string): Promise<void> {
    await refreshTokenRepository.deleteByToken(token);
  }

  async deleteAll(userId: string): Promise<void> {
    await refreshTokenRepository.deleteAllByUserId(userId);
  }
}

export default new RefreshTokenService();

