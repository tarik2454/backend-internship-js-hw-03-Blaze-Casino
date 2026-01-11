import { Types } from "mongoose";
import { LeaderboardStats } from "./models/leaderboard-stats.model";
import {
  PeriodType,
  LeaderboardResponse,
  LeaderboardPlayer,
} from "./leaderboard.types";

class LeaderboardService {
  private getPeriodStart(periodType: PeriodType): Date {
    const now = new Date();
    const periodStart = new Date(now);

    switch (periodType) {
      case "daily":
        periodStart.setUTCHours(0, 0, 0, 0);
        break;
      case "weekly": {
        const dayOfWeek = now.getUTCDay();
        const diff = now.getUTCDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        periodStart.setUTCDate(diff);
        periodStart.setUTCHours(0, 0, 0, 0);
        break;
      }
      case "monthly":
        periodStart.setUTCDate(1);
        periodStart.setUTCHours(0, 0, 0, 0);
        break;
      case "all":
        periodStart.setUTCFullYear(2020, 0, 1);
        periodStart.setUTCHours(0, 0, 0, 0);
        break;
    }

    return periodStart;
  }

  async updateStats(
    userId: Types.ObjectId,
    wagered: number,
    won: number,
    isWin: boolean
  ): Promise<void> {
    const periods: PeriodType[] = ["daily", "weekly", "monthly", "all"];

    const updatePromises = periods.map((periodType) => {
      const periodStart = this.getPeriodStart(periodType);

      return LeaderboardStats.findOneAndUpdate(
        { userId, periodType, periodStart },
        {
          $inc: {
            totalWagered: wagered,
            totalWon: won,
            gamesPlayed: 1,
            gamesWon: isWin ? 1 : 0,
          },
        },
        { upsert: true, new: true }
      );
    });

    await Promise.all(updatePromises);
  }

  async getLeaderboard(
    period: PeriodType,
    currentUserId?: Types.ObjectId
  ): Promise<LeaderboardResponse> {
    const periodStart = this.getPeriodStart(period);

    const stats = await LeaderboardStats.find({
      periodType: period,
      periodStart,
      gamesPlayed: { $gt: 0 },
    })
      .populate("userId", "username avatarURL")
      .sort({ totalWagered: -1 })
      .limit(100)
      .lean();

    const players: LeaderboardPlayer[] = stats
      .filter((stat) => {
        if (!stat.userId || typeof stat.userId !== "object") {
          return false;
        }
        const user = stat.userId as unknown as {
          _id?: Types.ObjectId;
          username?: string;
          avatarURL?: string;
        };
        return user._id && user.username;
      })
      .map((stat, index) => {
        const user = stat.userId as unknown as {
          _id: Types.ObjectId;
          username: string;
          avatarURL: string;
        };
        const winRate =
          stat.gamesPlayed > 0
            ? Math.round((stat.gamesWon / stat.gamesPlayed) * 100 * 100) / 100
            : 0;

        return {
          rank: index + 1,
          username: user.username,
          avatarURL: user.avatarURL || null,
          totalWagered: stat.totalWagered,
          gamesPlayed: stat.gamesPlayed,
          winRate,
        };
      });

    let currentUser: LeaderboardPlayer | null = null;

    if (currentUserId) {
      const currentUserStat = await LeaderboardStats.findOne({
        userId: currentUserId,
        periodType: period,
        periodStart,
      })
        .populate("userId", "username avatarURL")
        .lean();

      if (
        currentUserStat &&
        currentUserStat.userId &&
        typeof currentUserStat.userId === "object"
      ) {
        const user = currentUserStat.userId as unknown as {
          _id?: Types.ObjectId;
          username?: string;
          avatarURL?: string;
        };
        if (user._id && user.username) {
          const typedUser = user as {
            _id: Types.ObjectId;
            username: string;
            avatarURL: string;
          };
          const winRate =
            currentUserStat.gamesPlayed > 0
              ? Math.round(
                  (currentUserStat.gamesWon / currentUserStat.gamesPlayed) *
                    100 *
                    100
                ) / 100
              : 0;

          let rank =
            stats.findIndex((s) => {
              if (!s.userId || typeof s.userId !== "object") {
                return false;
              }
              const user = s.userId as unknown as { _id?: Types.ObjectId };
              return (
                user._id && user._id.toString() === currentUserId.toString()
              );
            }) + 1;

          if (rank === 0) {
            const betterCount = await LeaderboardStats.countDocuments({
              periodType: period,
              periodStart,
              totalWagered: { $gt: currentUserStat.totalWagered },
              gamesPlayed: { $gt: 0 },
            });
            rank = betterCount + 1;
          }

          currentUser = {
            rank,
            username: typedUser.username,
            avatarURL: typedUser.avatarURL || null,
            totalWagered: currentUserStat.totalWagered,
            gamesPlayed: currentUserStat.gamesPlayed,
            winRate,
          };
        }
      }
    }

    return { players, currentUser };
  }
}

export default new LeaderboardService();
