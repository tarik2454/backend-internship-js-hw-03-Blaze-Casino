import bcrypt from "bcryptjs";
import { User } from "./models/users.model";
import { IUser } from "./models/users.types";
import { HttpError } from "../../helpers/index";
import { UserSignupDTO, UserUpdateDTO } from "./users.schema";
import gravatar from "gravatar";

class UsersService {
  async createUser(userData: UserSignupDTO): Promise<IUser> {
    const { email, password, ...restData } = userData;

    if (!restData.avatarURL) {
      restData.avatarURL = gravatar.url(email, {
        s: "250",
        d: "wavatar",
        r: "pg",
        protocol: "https",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw HttpError(409, "Email already in use");
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      ...restData,
      email,
      password: hashPassword,
    });

    return newUser;
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  async getUserById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async updateUser(
    userId: string,
    updateData: Partial<UserUpdateDTO>
  ): Promise<IUser | null> {
    const updated = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select(
      "username email avatarURL balance totalWagered gamesPlayed totalWon"
    );

    return updated;
  }

  async updateUserToken(userId: string, token: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { token });
  }

  async getAllUsers() {
    return await User.find({}, "username avatarURL gamesPlayed balance");
  }
}

export default new UsersService();
