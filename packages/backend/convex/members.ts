import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, ANY_MEMBER } from "./authz";
import { role } from "./schema";

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
