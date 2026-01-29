import "dotenv/config";
import mongoose, { HydratedDocument } from "mongoose";
import { Rarity } from "../modules/cases/models/rarities/rarities.model";
import { Item } from "../modules/cases/models/items/items.model";
import { Case } from "../modules/cases/models/cases/cases.model";
import { CaseItem } from "../modules/cases/models/case-items/case-items.model";
import { IRarity } from "../modules/cases/models/rarities/rarities.types";

const RARITIES = [
  { name: "Common", chance: 55, color: "#9E9E9E" },
  { name: "Uncommon", chance: 25, color: "#4CAF50" },
  { name: "Rare", chance: 12, color: "#2196F3" },
  { name: "Epic", chance: 5, color: "#9C27B0" },
  { name: "Legendary", chance: 2.5, color: "#F44336" },
  { name: "Gold", chance: 0.5, color: "#FFD700" },
];

// Данные из фронтенда
const CASES_DATA = [
  {
    name: "Animal Case",
    slug: "animal-case",
    price: 50,
    imageUrl: "🦁",
    description: "Animal Case",
    contents: [
      { emoji: "🐭", name: "Mouse" },
      { emoji: "🐰", name: "Rabbit" },
      { emoji: "🐸", name: "Frog" },
      { emoji: "🐔", name: "Chicken" },
      { emoji: "🐷", name: "Pig" },
      { emoji: "🐼", name: "Panda" },
      { emoji: "🦊", name: "Fox" },
      { emoji: "🦝", name: "Raccoon" },
      { emoji: "🦁", name: "Lion" },
      { emoji: "🐯", name: "Tiger" },
      { emoji: "🦄", name: "Unicorn" },
      { emoji: "🐉", name: "Dragon" },
      { emoji: "🦖", name: "T-Rex" },
      { emoji: "👑", name: "Crown" },
    ],
  },
  {
    name: "Space Case",
    slug: "space-case",
    price: 75,
    imageUrl: "🚀",
    description: "Space Case",
    contents: [
      { emoji: "⭐", name: "Star" },
      { emoji: "🌙", name: "Moon" },
      { emoji: "☄️", name: "Comet" },
      { emoji: "🛸", name: "UFO" },
      { emoji: "🌍", name: "Earth" },
      { emoji: "🪐", name: "Saturn" },
      { emoji: "🌌", name: "Galaxy" },
      { emoji: "🚀", name: "Rocket" },
      { emoji: "👽", name: "Alien" },
      { emoji: "🌟", name: "Glowing Star" },
      { emoji: "💫", name: "Dizzy" },
      { emoji: "🌠", name: "Shooting Star" },
      { emoji: "🔭", name: "Telescope" },
      { emoji: "🌞", name: "Sun" },
    ],
  },
  {
    name: "Food Case",
    slug: "food-case",
    price: 40,
    imageUrl: "🍕",
    description: "Food Case",
    contents: [
      { emoji: "🍎", name: "Apple" },
      { emoji: "🍌", name: "Banana" },
      { emoji: "🍞", name: "Bread" },
      { emoji: "🥕", name: "Carrot" },
      { emoji: "🥒", name: "Cucumber" },
      { emoji: "🍕", name: "Pizza" },
      { emoji: "🍔", name: "Burger" },
      { emoji: "🌮", name: "Taco" },
      { emoji: "🍰", name: "Cake" },
      { emoji: "🍣", name: "Sushi" },
      { emoji: "🦞", name: "Lobster" },
      { emoji: "🍾", name: "Champagne" },
      { emoji: "🎂", name: "Birthday Cake" },
      { emoji: "💎", name: "Diamond" },
    ],
  },
  {
    name: "Sports Case",
    slug: "sports-case",
    price: 60,
    imageUrl: "⚽",
    description: "Sports Case",
    contents: [
      { emoji: "⚽", name: "Soccer Ball" },
      { emoji: "🏀", name: "Basketball" },
      { emoji: "🏈", name: "Football" },
      { emoji: "⚾", name: "Baseball" },
      { emoji: "🎾", name: "Tennis" },
      { emoji: "🏐", name: "Volleyball" },
      { emoji: "🏓", name: "Ping Pong" },
      { emoji: "🥊", name: "Boxing" },
      { emoji: "🥇", name: "Gold Medal" },
      { emoji: "🏆", name: "Trophy" },
      { emoji: "🎖️", name: "Military Medal" },
      { emoji: "👑", name: "Crown" },
      { emoji: "🏅", name: "Medal" },
      { emoji: "⚡", name: "Lightning" },
    ],
  },
];

// Функция для расчета значения предмета на основе редкости и цены кейса
const calculateItemValue = (casePrice: number, rarityIndex: number): number => {
  let multiplier = 0;

  // Распределение редкостей по индексам (из фронтенда):
  // Common (0-4): multiplier = -0.4
  // Uncommon (5-7): multiplier = 0
  // Rare (8-9): multiplier = 0.2
  // Epic (10-11): multiplier = 1.0
  // Legendary (12): multiplier = 2.0
  // Gold (13): multiplier = 5.0

  if (rarityIndex < 5) {
    multiplier = -0.4; // Common
  } else if (rarityIndex < 8) {
    multiplier = 0; // Uncommon
  } else if (rarityIndex < 10) {
    multiplier = 0.2; // Rare
  } else if (rarityIndex < 12) {
    multiplier = 1.0; // Epic
  } else if (rarityIndex < 13) {
    multiplier = 2.0; // Legendary
  } else {
    multiplier = 5.0; // Gold
  }

  const value = casePrice * (1 + multiplier);
  return Math.ceil(value);
};

// Функция для получения названия редкости по индексу
const getRarityName = (index: number): string => {
  if (index < 5) return "Common";
  if (index < 8) return "Uncommon";
  if (index < 10) return "Rare";
  if (index < 12) return "Epic";
  if (index < 13) return "Legendary";
  return "Gold";
};

// Функция для расчета шанса выпадения по индексу
const getChance = (index: number): number => {
  // Common (0-4): 55% / 5 = 11% каждый
  if (index < 5) return 11;
  // Uncommon (5-7): 25% / 3 ≈ 8.333% каждый
  if (index < 8) return 25 / 3;
  // Rare (8-9): 12% / 2 = 6% каждый
  if (index < 10) return 6;
  // Epic (10-11): 5% / 2 = 2.5% каждый
  if (index < 12) return 2.5;
  // Legendary (12): 2.5%
  if (index < 13) return 2.5;
  // Gold (13): 0.5%
  return 0.5;
};

const seed = async () => {
  try {
    if (!process.env.DB_HOST) {
      throw new Error("DB_HOST is not defined in .env");
    }
    await mongoose.connect(process.env.DB_HOST);
    console.log("Connected to MongoDB for seeding...");

    // 1. Clean up
    console.log("Cleaning existing data...");
    await CaseItem.deleteMany({});
    await Case.deleteMany({});
    await Item.deleteMany({});
    await Rarity.deleteMany({});

    // 2. Seed Rarities
    console.log("Seeding Rarities...");
    const rarityMap: Record<string, HydratedDocument<IRarity>> = {};
    for (const r of RARITIES) {
      const doc = await Rarity.create({
        name: r.name,
        color: r.color,
        chance: r.chance,
      });
      rarityMap[r.name] = doc;
    }

    // 3. Seed Items and Cases
    console.log("Seeding Items and Cases...");

    // Для каждого кейса создаем предметы и сам кейс
    for (const caseData of CASES_DATA) {
      // Создаем кейс
      const caseDoc = await Case.create({
        name: caseData.name,
        slug: caseData.slug,
        price: caseData.price,
        imageUrl: caseData.imageUrl,
        description: caseData.description,
        isActive: true,
      });
      console.log(
        `[SEED] Created ${caseData.name} - ID: ${caseDoc._id}, Price: $${caseData.price}`
      );

      // Создаем предметы для этого кейса
      for (let index = 0; index < caseData.contents.length; index++) {
        const content = caseData.contents[index];
        const rarityName = getRarityName(index);
        const rarity = rarityMap[rarityName];

        if (!rarity) {
          console.warn(
            `Rarity ${rarityName} not found for item ${content.name}`
          );
          continue;
        }

        const value = calculateItemValue(caseData.price, index);
        const chance = getChance(index);

        // Создаем уникальное имя предмета для этого кейса
        const itemName = `${caseData.name} - ${content.name}`;

        const itemDoc = await Item.create({
          name: itemName,
          rarityId: rarity._id,
          imageUrl: content.emoji, // Используем emoji из contents как imageUrl
          value: value,
        });

        // Создаем связь CaseItem для этого кейса
        await CaseItem.create({
          caseId: caseDoc._id,
          itemId: itemDoc._id,
          chance: chance,
        });
      }

      console.log(
        `[SEED] Created ${caseData.contents.length} items for ${caseData.name}`
      );
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
};

seed();
