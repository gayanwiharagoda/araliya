import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, ANY_MEMBER } from "./authz";
import { getUserId } from "./auth";
import { role } from "./schema";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export const add = mutation({
  args: {
    buildingId: v.id("buildings"),
    role,
    userId: v.optional(v.id("users")),
    unitId: v.optional(v.id("units")),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ["admin"]);
    return ctx.db.insert("members", {
      buildingId: args.buildingId,
      role: args.role,
      userId: args.userId,
      unitId: args.unitId,
      status: "active",
    });
  },
});

export const generateInvite = mutation({
  args: { buildingId: v.id("buildings"), unitId: v.id("units") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ["admin"]);
    const unit = await ctx.db.get(args.unitId);
    if (!unit || unit.buildingId !== args.buildingId)
      throw new Error("Invalid unit");

    const inviteToken = crypto.randomUUID();
    const inviteTokenExpiresAt = Date.now() + INVITE_EXPIRY_MS;
    await ctx.db.insert("members", {
      buildingId: args.buildingId,
      unitId: args.unitId,
      role: "resident",
      status: "invited",
      inviteToken,
      inviteTokenExpiresAt,
    });
    return {
      appUrl: `domusos://invite?token=${inviteToken}`,
      fallbackUrl: `/invite?token=${inviteToken}`,
    };
  },
});

export const claimInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);
    const member = await ctx.db
      .query("members")
      .withIndex("by_inviteToken", (q) => q.eq("inviteToken", args.token))
      .unique();
    if (!member || member.status !== "invited")
      throw new Error("Invalid invite");
    if (
      member.inviteTokenExpiresAt &&
      member.inviteTokenExpiresAt < Date.now()
    ) {
      throw new Error("Invite expired");
    }

    await ctx.db.patch(member._id, {
      userId,
      status: "active",
      inviteToken: undefined,
      inviteTokenClaimedBy: userId,
      inviteTokenClaimedAt: Date.now(),
    });
  },
});

export const list = query({
  args: { buildingId: v.id("buildings") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ANY_MEMBER);
    return ctx.db
      .query("members")
      .withIndex("by_building", (q) => q.eq("buildingId", args.buildingId))
      .collect();
  },
});
