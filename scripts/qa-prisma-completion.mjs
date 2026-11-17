import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

assert.equal(process.env.CRO_PARTNER_QA, "isolated");
const url = new URL(process.env.DATABASE_URL ?? "");
assert.ok(["postgres:", "postgresql:"].includes(url.protocol));
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "5432");
assert.equal(url.pathname, "/cro_partner_qa");
assert.equal(url.username, "cro_qa");

// Import only after rejecting unapproved connection settings.
const { PrismaClient } = await import("@prisma/client");
const first = new PrismaClient();
const second = new PrismaClient();
const id = "qa-prisma-" + randomUUID();

try {
  const [database] = await first.$queryRaw`
    SELECT current_database() AS name, current_user AS role
  `;
  assert.equal(database.name, "cro_partner_qa");
  assert.equal(database.role, "cro_qa");

  const originalTime = new Date("2026-01-01T00:00:00Z");
  const completedTime = new Date("2026-01-02T00:00:00Z");

  await first.experiment.create({
    data: {
      id, shop: "qa.invalid", name: "Synthetic Prisma QA",
      hypothesis: "Only one competing completion succeeds",
      status: "RUNNING", updatedAt: originalTime,
    },
  });

  const update = {
    where: {
      id, shop: "qa.invalid", status: "RUNNING",
      updatedAt: originalTime,
    },
    data: {
      status: "COMPLETED", completedAt: completedTime,
      resultOutcome: "NO_DIFFERENCE",
      recommendationAction: "GATHER_MORE_DATA",
      interpretation: "Synthetic provisional result",
      updatedAt: completedTime,
    },
  };

  const results = await Promise.all([
    first.experiment.updateMany(update),
    second.experiment.updateMany(update),
  ]);
  assert.deepEqual(results.map(r => r.count).sort(), [0, 1]);
  console.log("PASS: one competing Prisma update succeeded");

  const saved = await second.experiment.findUniqueOrThrow({
    where: { id },
  });
  assert.equal(saved.status, "COMPLETED");
  assert.equal(saved.completedAt.toISOString(), completedTime.toISOString());
  assert.equal(saved.resultOutcome, "NO_DIFFERENCE");
  assert.equal(saved.recommendationAction, "GATHER_MORE_DATA");
  assert.equal(saved.interpretation, "Synthetic provisional result");
  console.log("PASS: completion snapshot persisted");

  const wrongShop = await first.experiment.updateMany({
    where: { id, shop: "other-shop.invalid" },
    data: { interpretation: "Must not be saved" },
  });
  assert.equal(wrongShop.count, 0);
  const unchanged = await second.experiment.findUniqueOrThrow({ where: { id } });
  assert.equal(unchanged.interpretation, saved.interpretation);
  console.log("PASS: wrong-shop update rejected; snapshot unchanged");
  console.log("Synthetic fixture retained:", id);
} finally {
  await Promise.all([first.$disconnect(), second.$disconnect()]);
}