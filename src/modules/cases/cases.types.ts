import { IItem } from "./models/items/items.types";
import { IRarity } from "./models/rarities/rarities.types";
import { ICaseItem } from "./models/case-items/case-items.types";
export { ICase } from "./models/cases/cases.types";

export interface PopulatedItem extends Omit<IItem, "rarityId"> {
  rarityId: IRarity;
}

export interface PopulatedCaseItem extends Omit<ICaseItem, "itemId"> {
  itemId: PopulatedItem;
}

export interface CaseItem {
  id: string;
  name: string;
  rarity: string;
  value: number;
  imageUrl: string;
}

export interface WonItem {
  id: string;
  name: string;
  rarity: string;
  value: number;
  image: string;
}

export interface CaseDetailsItem {
  id: string;
  name: string;
  rarity: string;
  chance: number;
  value: number;
  imageUrl: string;
}

export interface CaseListItem {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string | null;
  items: [];
}

export interface CasesResponse {
  cases: CaseListItem[];
}

export interface CaseDetailsResponse {
  id: string;
  name: string;
  price: number;
  description: string | null;
  items: CaseDetailsItem[];
}

export interface OpenCaseResponse {
  openingId: string;
  item: WonItem;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  roll: number;
  newBalance: number;
  casePrice: number;
  itemValue: number;
}

export interface CaseHistoryItem {
  id: string;
  createdAt: Date;
  caseName: string;
  casePrice: number;
  itemName: string;
  itemValue: number;
  itemRarity: string;
  itemImage: string;
  profit: number;
}

export interface CaseHistoryResponse {
  openings: CaseHistoryItem[];
}
