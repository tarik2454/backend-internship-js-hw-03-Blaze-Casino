import crypto from "crypto";

export function generateCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  const hash = crypto.createHmac("sha256", combined).digest("hex");

  // Конвертация в число (первые 13 символов hex)
  const h = parseInt(hash.slice(0, 13), 16);
  const e = Math.pow(2, 52);

  // House edge 4%
  let crashPoint = (100 * e - h) / (e - h) / 100;
  crashPoint = Math.max(1.0, crashPoint);

  return Math.round(crashPoint * 100) / 100;
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

