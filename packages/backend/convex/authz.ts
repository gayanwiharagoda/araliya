import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getUserId } from "./auth";

export type Role = Doc<"members">["role"];

/**
 * The single authorization invariant of the app. Every building-scoped query
 * and mutation MUST call this first.
 *
 * Resolves the authenticated caller, loads their ACTIVE membership in
 * `buildingId`, and asserts the membership role is in `allowed`. Returns the
 * membership for reuse. Throws "Unauthenticated" / "Forbidden" otherwise.
 *
 * ponytail: linear scan over one user's memberships (via by_user) — fine for a
 * person in a handful of buildings; upgrade to a by_user_building composite
 * index if that grows.
 */
export async function requireRole(
  ctx: QueryCtx | MutationCtx,
  buildingId: Id<"buildings">,
  allowed: Role[],
): Promise<Doc<"members">> {
  const userId = await getUserId(ctx);

  const memberships = await ctx.db
    .query("members")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const membership = memberships.find(
    (m) => m.buildingId === buildingId && m.status === "active",
  );
  if (!membership) throw new Error("Forbidden: not a member of this building");

  if (!allowed.includes(membership.role)) {
    throw new Error("Forbidden: insufficient role");
  }

  return membership;
}

/** Any active member, regardless of role. */
export const ANY_MEMBER: Role[] = ["admin", "treasurer", "resident"];
