import { Document } from "mongoose";

export interface ICase extends Document {
  name: string;
  slug: string;
  price: number;
  imageUrl: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
}
