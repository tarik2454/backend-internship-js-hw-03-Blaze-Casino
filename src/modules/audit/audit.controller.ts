import { Response } from "express";
import { ctrlWrapper } from "../../decorators";
import { AuthenticatedRequest } from "../../types";
import auditService from "./audit.service";
import { Types } from "mongoose";
import { EntityType } from "./models/audit-log.types";

const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const userId = req.query.userId as string | undefined;
  const entityTypeParam = req.query.entityType as string | undefined;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const validEntityTypes: EntityType[] = [
    "User",
    "MinesGame",
    "PlinkoDrop",
    "CaseOpening",
    "BonusClaim",
    "LeaderboardStats",
    "CrashBet",
    "Crash",
  ];

  const entityType: EntityType | undefined =
    entityTypeParam && validEntityTypes.includes(entityTypeParam as EntityType)
      ? (entityTypeParam as EntityType)
      : undefined;

  const result = await auditService.getLogs(
    userId ? new Types.ObjectId(userId) : undefined,
    entityType,
    Math.min(limit, 100),
    Math.max(offset, 0)
  );

  res.json(result);
};

export default {
  getAuditLogs: ctrlWrapper(getAuditLogs),
};
