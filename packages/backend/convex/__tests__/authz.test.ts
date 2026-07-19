// Guard role/branch matrix: admin, treasurer, resident, non-member,
// unauthenticated → allowed vs thrown. requireRole is the app's single
// authorization invariant, so every branch is exercised here.

import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.ts");

type T = ReturnType<typeof convexTest>;

async function newUser(t: T) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

describe("requireRole matrix", () => {
  it("enforces roles across every branch", async () => {
    const t = convexTest(schema, modules);

    const admin = await newUser(t);
    const buildingId = await admin.as.mutation(api.buildings.create, {
      name: "Tower A",
    });

    // Admin adds treasurer + resident members linked to real users.
    const treasurer = await newUser(t);
    const resident = await newUser(t);
    await admin.as.mutation(api.members.add, {
      buildingId,
      role: "treasurer",
      userId: treasurer.userId,
    });
    await admin.as.mutation(api.members.add, {
      buildingId,
      role: "resident",
      userId: resident.userId,
    });

    // admin → can add a unit
    await expect(
      admin.as.mutation(api.units.add, { buildingId, label: "A-1" }),
    ).resolves.toBeDefined();

    // treasurer → cannot add a unit (disallowed role) but can list
    await expect(
      treasurer.as.mutation(api.units.add, { buildingId, label: "A-2" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      treasurer.as.query(api.units.list, { buildingId }),
    ).resolves.toHaveLength(1);

    // resident → cannot add a unit but can list
    await expect(
      resident.as.mutation(api.units.add, { buildingId, label: "A-3" }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      resident.as.query(api.units.list, { buildingId }),
    ).resolves.toHaveLength(1);

    // non-member → forbidden on read
    const stranger = await newUser(t);
    await expect(
      stranger.as.query(api.units.list, { buildingId }),
    ).rejects.toThrow(/Forbidden/);

    // unauthenticated → rejected before any building lookup
    await expect(t.query(api.units.list, { buildingId })).rejects.toThrow(
      /Unauthenticated/,
    );
  });
});
