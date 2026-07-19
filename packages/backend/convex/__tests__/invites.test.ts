import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

const modules = import.meta.glob("../**/*.ts");
type T = ReturnType<typeof convexTest>;

async function newUser(t: T) {
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  return { userId, as: t.withIdentity({ subject: `${userId}|session` }) };
}

describe("resident invites", () => {
  it("generates and atomically claims an invite", async () => {
    const t = convexTest(schema, modules);
    const admin = await newUser(t);
    const resident = await newUser(t);
    const buildingId = await admin.as.mutation(api.buildings.create, {
      name: "Palm Court",
    });
    const unitId = await admin.as.mutation(api.units.add, {
      buildingId,
      label: "A-1",
    });

    const invite = await admin.as.mutation(api.members.generateInvite, {
      buildingId,
      unitId,
    });
    const token = new URL(invite.appUrl).searchParams.get("token");
    if (!token) throw new Error("Invite token missing");
    expect(invite.fallbackUrl).toContain(token);

    await resident.as.mutation(api.members.claimInvite, { token });
    const members = await admin.as.query(api.members.list, { buildingId });
    const claimed = members.find((member) => member.unitId === unitId);
    if (!claimed) throw new Error("Claimed member missing");
    expect(claimed.status).toBe("active");
    expect(claimed.userId).toBe(resident.userId);
    expect(claimed.inviteToken).toBeUndefined();

    await expect(
      resident.as.mutation(api.members.claimInvite, { token }),
    ).rejects.toThrow(/Invalid invite/);
  });

  it("rejects unknown and expired tokens", async () => {
    const t = convexTest(schema, modules);
    const admin = await newUser(t);
    const resident = await newUser(t);
    const buildingId = await admin.as.mutation(api.buildings.create, {
      name: "Palm Court",
    });
    const unitId = await admin.as.mutation(api.units.add, {
      buildingId,
      label: "A-1",
    });
    await t.run((ctx) =>
      ctx.db.insert("members", {
        buildingId,
        unitId,
        role: "resident",
        status: "invited",
        inviteToken: "expired",
        inviteTokenExpiresAt: Date.now() - 1,
      }),
    );

    await expect(
      resident.as.mutation(api.members.claimInvite, { token: "missing" }),
    ).rejects.toThrow(/Invalid invite/);
    await expect(
      resident.as.mutation(api.members.claimInvite, { token: "expired" }),
    ).rejects.toThrow(/Invite expired/);
  });
});
