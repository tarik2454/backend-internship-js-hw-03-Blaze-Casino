import { Types } from "mongoose";
import { RefreshToken } from "../../models/refresh-token.model";
import { IRefreshToken } from "../../models/refresh-token.types";

class RefreshTokenRepository {
  async create(data: {
    token: string;
    userId: string;
    expiresAt: Date;
    sessionStart: Date;
  }): Promise<IRefreshToken> {
    return await RefreshToken.create({
      token: data.token,
      userId: new Types.ObjectId(data.userId),
      expiresAt: data.expiresAt,
      sessionStart: data.sessionStart,
    });
  }

  async findByToken(token: string): Promise<IRefreshToken | null> {
    return await RefreshToken.findOne({ token });
  }

  async deleteByToken(token: string): Promise<void> {
    await RefreshToken.deleteOne({ token });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await RefreshToken.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}

export default new RefreshTokenRepository();

