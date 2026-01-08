import bcrypt from "bcryptjs";
import { IUser } from "../users/models/users.types";
import { HttpError } from "../../helpers/index";
import usersService from "../users/users.service";
import { UserSigninDTO } from "../users/users.schema";
import { tokenManager } from "./tokens";

class AuthService {
  async signup(userData: {
    email: string;
    password: string;
    username: string;
  }): Promise<IUser> {
    const existingUser = await usersService.getUserByEmail(userData.email);
    if (existingUser) {
      throw HttpError(409, "User with this email already exists");
    }

    return await usersService.createUser(userData);
  }

  async signin(signinData: UserSigninDTO): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
    userName: string;
  }> {
    const { email, password } = signinData;

    const user = await usersService.getUserByEmail(email);
    if (!user) {
      throw HttpError(401, "Email is invalid");
    }

    const passwordCompare = await bcrypt.compare(password, user.password);
    if (!passwordCompare) {
      throw HttpError(401, "Password is invalid");
    }

    const { accessToken, refreshToken } = await tokenManager.generateTokenPair(
      user._id.toString()
    );

    return {
      accessToken,
      refreshToken,
      userId: user._id.toString(),
      userName: user.username,
    };
  }

  async refresh(oldRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
  }> {
    const { tokenPair, userId } = await tokenManager.refreshTokens(
      oldRefreshToken
    );

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      userId,
    };
  }

  async signout(userId: string): Promise<void> {
    await tokenManager.revokeAllTokens(userId);
  }
}

export default new AuthService();
