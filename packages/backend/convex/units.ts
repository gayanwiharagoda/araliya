import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, ANY_MEMBER } from "./authz";

export const add = mutation({
  args: {
    buildingId: v.id("buildings"),
    label: v.string(),
    floorArea: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ["admin"]);
    return ctx.db.insert("units", {
      buildingId: args.buildingId,
      label: args.label,
      floorArea: args.floorArea,
    });
  },
});

export const list = query({
  args: { buildingId: v.id("buildings") },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.buildingId, ANY_MEMBER);
    return ctx.db
      .query("units")
      .withIndex("by_building", (q) => q.eq("buildingId", args.buildingId))
      .collect();
  },
});
