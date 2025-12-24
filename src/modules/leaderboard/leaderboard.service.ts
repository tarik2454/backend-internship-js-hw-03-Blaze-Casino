import { Types } from "mongoose";
import { LeaderboardStats } from "./models/leaderboard-stats.model";
import { PeriodType, LeaderboardResponse, LeaderboardPlayer } from "./leaderboard.types";

class LeaderboardService {
  private getPeriodStart(periodType: PeriodType): Date {
    const now = new Date();
    const periodStart = new Date(now);

    switch (periodType) {
      case "daily":
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        periodStart.setDate(diff);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        periodStart.setDate(1);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case "all":
        periodStart.setFullYear(2020, 0, 1);
        periodStart.setHours(0, 0, 0, 0);
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
      .populate("userId", "username")
      .sort({ totalWagered: -1 })
      .limit(100)
      .lean();

    const players: LeaderboardPlayer[] = stats.map((stat, index) => {
      const user = stat.userId as unknown as { _id: Types.ObjectId; username: string };
      const winRate =
        stat.gamesPlayed > 0
          ? Math.round((stat.gamesWon / stat.gamesPlayed) * 100 * 100) / 100
          : 0;

      return {
        rank: index + 1,
        username: user.username,
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
        .populate("userId", "username")
        .lean();

      if (currentUserStat) {
        const user = currentUserStat.userId as unknown as {
          _id: Types.ObjectId;
          username: string;
        };
        const winRate =
          currentUserStat.gamesPlayed > 0
            ? Math.round(
                (currentUserStat.gamesWon / currentUserStat.gamesPlayed) * 100 * 100
              ) / 100
            : 0;

        let rank =
          stats.findIndex(
            (s) =>
              (s.userId as unknown as { _id: Types.ObjectId })._id.toString() ===
              currentUserId.toString()
          ) + 1;

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
          username: user.username,
          totalWagered: currentUserStat.totalWagered,
          gamesPlayed: currentUserStat.gamesPlayed,
          winRate,
        };
      }
    }

    return { players, currentUser };
  }
}

export default new LeaderboardService();

