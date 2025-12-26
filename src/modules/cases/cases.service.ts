import crypto from "crypto";
import mongoose, { HydratedDocument, Document } from "mongoose";
import { Case } from "./models/cases/cases.model";
import { CaseOpening } from "./models/case-openings/case-openings.model";
import { CaseItem as CaseItemModel } from "./models/case-items/case-items.model";
import "./models/items/items.model";
import "./models/rarities/rarities.model";
import {
  CaseDetailsItem,
  PopulatedCaseItem,
  OpenCaseResponse,
  CaseDetailsResponse,
  CasesResponse,
  CaseListItem,
  WonItem,
} from "./cases.types";
import { generateRoll } from "./cases.utils";
import { IUser } from "../users/models/users.types";
import { HttpError } from "../../helpers/index";
import leaderboardService from "../leaderboard/leaderboard.service";
import auditService from "../audit/audit.service";

const toPopulatedCaseItem = (doc: Document): PopulatedCaseItem => {
  return doc as unknown as PopulatedCaseItem;
};

class CasesService {
  async getAllCases(): Promise<CasesResponse> {
    const cases = await Case.find({ isActive: true });
    const caseList: CaseListItem[] = cases.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      price: c.price,
      image: c.imageUrl,
      items: [],
    }));
    return { cases: caseList };
  }

  async getCaseById(id: string): Promise<CaseDetailsResponse> {
    const result = await Case.findById(id);
    if (!result) {
      throw HttpError(404, "Case not found");
    }

    const caseItems = await CaseItemModel.find({ caseId: id }).populate({
      path: "itemId",
      populate: { path: "rarityId" },
    });

    const items: CaseDetailsItem[] = caseItems.map((ci) => {
      const populatedCaseItem = toPopulatedCaseItem(ci);
      const item = populatedCaseItem.itemId;
      return {
        id: item._id.toString(),
        name: item.name,
        rarity: item.rarityId.name,
        value: item.value,
        chance: ci.chance,
      };
    });

    return {
      id: result._id as string,
      name: result.name,
      price: result.price,
      items,
    };
  }

  async openCase(
    user: HydratedDocument<IUser>,
    caseId: string,
    clientSeed: string = crypto.randomBytes(16).toString("hex"),
    ipAddress?: string,
    userAgent?: string
  ): Promise<OpenCaseResponse> {
    const caseToOpen = await Case.findById(caseId);
    if (!caseToOpen) {
      throw HttpError(404, "Case not found");
    }

    if (user.balance < caseToOpen.price) {
      throw HttpError(400, "Insufficient balance");
    }

    const oldBalance = user.balance;
    const oldTotalWagered = user.totalWagered;
    const oldGamesPlayed = user.gamesPlayed;

    const caseItems = await CaseItemModel.find({ caseId: caseId })
      .populate({
        path: "itemId",
        populate: { path: "rarityId" },
      })
      .sort({ chance: -1 });

    if (!caseItems || caseItems.length === 0) {
      throw HttpError(400, "Case is empty");
    }

    let serverSeed = user.serverSeed;
    if (!serverSeed) {
      serverSeed = crypto.randomBytes(32).toString("hex");
    }

    const nonce = user.gamesPlayed + 1;

    const rollValue = generateRoll(serverSeed, clientSeed, nonce);

    const newServerSeed = crypto.randomBytes(32).toString("hex");

    let winningCaseItem = caseItems[caseItems.length - 1];
    let cumulative = 0;

    for (const item of caseItems) {
      cumulative += item.chance / 100;

      if (rollValue < cumulative) {
        winningCaseItem = item;
        break;
      }
    }

    const winningItem = toPopulatedCaseItem(winningCaseItem).itemId;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const netChange = winningItem.value - caseToOpen.price;
      const updatedUser = await mongoose
        .model("User")
        .findOneAndUpdate(
          {
            _id: user._id,
            balance: { $gte: caseToOpen.price },
          },
          {
            $inc: {
              balance: netChange,
              totalWagered: caseToOpen.price,
              gamesPlayed: 1,
              totalWon: winningItem.value,
            },
            $set: {
              clientSeed: clientSeed,
              serverSeed: user.serverSeed || serverSeed,
            },
          },
          {
            session,
            new: true,
            runValidators: true,
          }
        );

      if (!updatedUser) {
        throw HttpError(400, "Insufficient balance or user not found");
      }

      updatedUser.serverSeed = newServerSeed;
      await updatedUser.save({ session });

      const opening = await CaseOpening.create(
        [
          {
            userId: user._id,
            caseId: caseToOpen._id,
            itemId: winningItem._id,
            rollValue,
            serverSeed,
            clientSeed,
            nonce,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      const isWin = winningItem.value > caseToOpen.price;
      const netWin = winningItem.value - caseToOpen.price;
      leaderboardService
        .updateStats(user._id, caseToOpen.price, netWin, isWin)
        .catch((err) => {
          console.error("Leaderboard update failed", {
            userId: user._id.toString(),
            error: err,
          });
        });

      auditService
        .log({
          userId: user._id,
          action: "OPEN_CASE",
          entityType: "CaseOpening",
          entityId: opening[0]._id,
          oldValue: {
            balance: oldBalance,
            totalWagered: oldTotalWagered,
            gamesPlayed: oldGamesPlayed,
          },
          newValue: {
            balance: updatedUser.balance,
            totalWagered: oldTotalWagered + caseToOpen.price,
            gamesPlayed: oldGamesPlayed + 1,
            caseId: caseToOpen._id.toString(),
            casePrice: caseToOpen.price,
            itemValue: winningItem.value,
            itemId: winningItem.id,
            roll: rollValue,
          },
          ipAddress,
          userAgent,
        })
        .catch((err) => {
          console.error("Audit log failed:", err);
        });

      const wonItem: WonItem = {
        id: winningItem._id.toString(),
        name: winningItem.name,
        rarity: winningItem.rarityId.name,
        value: winningItem.value,
        image: winningItem.imageUrl,
      };

      return {
        openingId: opening[0]._id as string,
        item: wonItem,
        serverSeed,
        clientSeed,
        nonce,
        roll: rollValue,
        newBalance: updatedUser.balance,
        casePrice: caseToOpen.price,
        itemValue: winningItem.value,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getHistory(user: HydratedDocument<IUser>, limit = 10, offset = 0) {
    const openings = await CaseOpening.find({
      userId: user._id,
    })
      .populate({
        path: "caseId",
        select: "name price",
      })
      .populate({
        path: "itemId",
        populate: { path: "rarityId", select: "name" },
        select: "name value imageUrl",
      })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    const openingsWithProfit = openings.map((opening) => {
      const openingDoc = opening as any;
      const caseData = openingDoc.caseId;
      const item = openingDoc.itemId;
      const casePrice = caseData?.price || 0;
      const itemValue = item?.value || 0;
      const profit = itemValue - casePrice;

      return {
        id: opening._id.toString(),
        createdAt: opening.createdAt,
        caseName: caseData?.name || "Unknown",
        casePrice,
        itemName: item?.name || "Unknown",
        itemValue,
        itemRarity: item?.rarityId?.name || "Unknown",
        itemImage: item?.imageUrl || "",
        profit,
      };
    });

    return { openings: openingsWithProfit };
  }
}

export default new CasesService();
