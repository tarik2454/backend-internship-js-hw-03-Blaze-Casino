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
    clientSeed: string = crypto.randomBytes(16).toString("hex")
  ): Promise<OpenCaseResponse> {
    const caseToOpen = await Case.findById(caseId);
    if (!caseToOpen) {
      throw HttpError(404, "Case not found");
    }

    if (user.balance < caseToOpen.price) {
      throw HttpError(400, "Insufficient balance");
    }

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
      if (!user.serverSeed) {
        user.serverSeed = serverSeed;
      }
      user.clientSeed = clientSeed;
      user.balance -= caseToOpen.price;
      user.totalWagered += caseToOpen.price;
      user.gamesPlayed += 1;
      user.balance += winningItem.value;
      user.totalWon += winningItem.value;
      user.serverSeed = newServerSeed;

      await user.save({ session });

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
        newBalance: user.balance,
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
}

export default new CasesService();
