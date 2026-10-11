// Integration: create building → add units → add members, all building-scoped;
// plus cross-tenant isolation (no membership in X ⇒ no read/write in X).

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

describe("domain flow", () => {
  it("creates a building, scopes units and members to it", async () => {
    const t = convexTest(schema, modules);
    const admin = await newUser(t);

    const buildingId = await admin.as.mutation(api.buildings.create, {
      name: "Palm Court",
    });

    // Creator is bootstrapped as an active admin member.
    const members0 = await admin.as.query(api.members.list, { buildingId });
    expect(members0).toHaveLength(1);
    expect(members0[0]?.role).toBe("admin");
    expect(members0[0]?.userId).toBe(admin.userId);

    // Defaults for Sri Lanka.
    const building = await admin.as.query(api.buildings.get, { buildingId });
    expect(building?.region).toBe("LK");
    expect(building?.currency).toBe("LKR");

    await admin.as.mutation(api.units.add, { buildingId, label: "A-1" });
    await admin.as.mutation(api.units.add, { buildingId, label: "A-2" });
    const units = await admin.as.query(api.units.list, { buildingId });
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.buildingId === buildingId)).toBe(true);

    await admin.as.mutation(api.members.add, {
      buildingId,
      role: "treasurer",
      userId: (await newUser(t)).userId,
    });
    const members = await admin.as.query(api.members.list, { buildingId });
    expect(members).toHaveLength(2);
    expect(members.every((m) => m.buildingId === buildingId)).toBe(true);

    // listMine returns only my building.
    const mine = await admin.as.query(api.buildings.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]?._id).toBe(buildingId);
  });

  it("isolates tenants: a non-member cannot read or mutate building X", async () => {
    const t = convexTest(schema, modules);

    const alice = await newUser(t);
    const buildingX = await alice.as.mutation(api.buildings.create, {
      name: "X",
    });
    await alice.as.mutation(api.units.add, {
      buildingId: buildingX,
      label: "X-1",
    });

    const bob = await newUser(t);
    const bobBuilding = await bob.as.mutation(api.buildings.create, {
      name: "Bob's",
    });

    // Bob is a member of his own building but not X.
    await expect(
      bob.as.query(api.buildings.get, { buildingId: buildingX }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      bob.as.query(api.units.list, { buildingId: buildingX }),
    ).rejects.toThrow(/Forbidden/);
    await expect(
      bob.as.mutation(api.units.add, { buildingId: buildingX, label: "hack" }),
    ).rejects.toThrow(/Forbidden/);

    // Bob's own listMine excludes X.
    const bobMine = await bob.as.query(api.buildings.listMine, {});
    expect(bobMine).toHaveLength(1);
    expect(bobMine[0]?._id).toBe(bobBuilding);
  });
});
