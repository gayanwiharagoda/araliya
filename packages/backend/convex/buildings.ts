import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./auth";
import { requireRole, ANY_MEMBER } from "./authz";

export const create = mutation({
  args: {
    name: v.string(),
    address: v.optional(v.string()),
    region: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const buildingId = await ctx.db.insert("buildings", {
      name: args.name,
      address: args.address,
      region: args.region ?? "LK",
      currency: args.currency ?? "LKR",
      createdAt: Date.now(),
    });

    // Bootstrap the creator as the first member (admin/active) so they can
    // pass their own guard on subsequent calls.
    await ctx.db.insert("members", {
      buildingId,
      userId,
      role: "admin",
      status: "active",
    });

    return buildingId;
  },
});

export const get = query({
  args: { buildingId: v.id("buildings") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ANY_MEMBER);
    return ctx.db.get(args.buildingId);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getUserId(ctx);
    const memberships = await ctx.db
      .query("members")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const buildings = await Promise.all(
      memberships
        .filter((m) => m.status === "active")
        .map((m) => ctx.db.get(m.buildingId)),
    );
    return buildings.filter((b) => b !== null);
  },
});
