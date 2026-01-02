import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_EXPIRES_IN } from "../shared/token.config";

class AccessTokenService {
  generate(userId: string): string {
    return jwt.sign({ userId }, process.env.JWT_SECRET as string, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  verify(token: string): { userId: string } {
    try {
      return jwt.verify(token, process.env.JWT_SECRET as string) as {
        userId: string;
      };
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }
}

export default new AccessTokenService();

