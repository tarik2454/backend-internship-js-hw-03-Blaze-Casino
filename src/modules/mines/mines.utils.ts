import crypto from "crypto";

export function generateMinePositions(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  minesCount: number
): number[] {
  const positions: number[] = [];
  const available = Array.from({ length: 25 }, (_, i) => i);

  for (let i = 0; i < minesCount; i++) {
    const combined = `${serverSeed}:${clientSeed}:${nonce}:${i}`;
    const hash = crypto.createHash("sha256").update(combined).digest("hex");
    const index = parseInt(hash.slice(0, 8), 16) % available.length;
    positions.push(available.splice(index, 1)[0]);
  }

  return positions.sort((a, b) => a - b);
}

export function calculateMultiplier(
  minesCount: number,
  revealedCount: number,
  houseEdge = 0.04
): number {
  const totalTiles = 25;
  const safeTiles = totalTiles - minesCount;

  let probability = 1.0;
  for (let i = 0; i < revealedCount; i++) {
    probability *= (safeTiles - i) / (totalTiles - i);
  }

  let multiplier = 0;
  if (probability > 0) {
    multiplier = (1 - houseEdge) / probability;
  }

  return Math.round(multiplier * 100) / 100;
}

export function generateMultiplierTable(minesCount: number): number[] {
  const safeTiles = 25 - minesCount;
  const multipliers: number[] = [];

  for (let i = 1; i <= safeTiles; i++) {
    multipliers.push(calculateMultiplier(minesCount, i));
  }

  return multipliers;
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}
