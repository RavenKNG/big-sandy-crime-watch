import * as dbModule from "./db";

type PrismaLike = {
  publicRecordDemo: unknown;
  facebookDraft: unknown;
  $disconnect?: () => Promise<void>;
};

function isPrismaLike(value: unknown): value is PrismaLike {
  return Boolean(
    value &&
      typeof value === "object" &&
      "publicRecordDemo" in value &&
      "facebookDraft" in value,
  );
}

function resolvePrismaClient(): PrismaLike {
  const moduleAny = dbModule as Record<string, unknown>;
  const defaultExport = moduleAny.default;

  const candidates: unknown[] = [
    moduleAny.db,
    moduleAny.prisma,
    moduleAny.client,
    moduleAny.prismaClient,
    typeof moduleAny.getDb === "function" ? moduleAny.getDb() : undefined,
    typeof moduleAny.getPrisma === "function" ? moduleAny.getPrisma() : undefined,
    typeof moduleAny.getClient === "function" ? moduleAny.getClient() : undefined,
    typeof defaultExport === "function" ? defaultExport() : defaultExport,
  ];

  const found = candidates.find(isPrismaLike);

  if (!found) {
    throw new Error(
      `Could not resolve Prisma client from src/lib/db.ts. Export keys: ${Object.keys(moduleAny).join(", ")}`,
    );
  }

  return found;
}

export const prisma = resolvePrismaClient() as any;
