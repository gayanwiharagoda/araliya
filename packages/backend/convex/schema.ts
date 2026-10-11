import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// MONEY CONVENTION: all monetary amounts are stored as integer minor units
// (LKR cents). Never store floating-point currency. Tickets 3–6 (fees,
// payments, ledger) build on this — do not reintroduce floats.

export const role = v.union(
  v.literal("admin"),
  v.literal("treasurer"),
  v.literal("resident"),
);

export default defineSchema({
  // Convex Auth tables (users, authAccounts, authSessions, ...).
  ...authTables,

  buildings: defineTable({
    name: v.string(),
    address: v.optional(v.string()),
    region: v.string(), // ISO country, defaults to "LK"
    currency: v.string(), // defaults to "LKR"
    providerConfig: v.optional(v.any()), // placeholder for payment-provider settings (ticket 4)
    createdAt: v.number(),
  }),

  units: defineTable({
    buildingId: v.id("buildings"),
    label: v.string(), // e.g. "A-12"
    floorArea: v.optional(v.number()), // for later by-area apportionment
  }).index("by_building", ["buildingId"]),

  members: defineTable({
    buildingId: v.id("buildings"),
    userId: v.optional(v.id("users")), // null while invited (ticket 2)
    unitId: v.optional(v.id("units")), // null for committee-only members
    role,
    status: v.union(v.literal("invited"), v.literal("active")),
    inviteToken: v.optional(v.string()), // reserved for ticket 2 invite redemption
  })
    .index("by_building", ["buildingId"])
    .index("by_user", ["userId"])
    .index("by_inviteToken", ["inviteToken"]),
});
