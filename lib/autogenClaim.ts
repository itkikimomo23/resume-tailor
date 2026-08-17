import { supabase } from "@/lib/supabase";

/**
 * A claim (status flipped `pending`/`failed` -> `generating`, `autogen_claimed_at`
 * stamped) older than this is treated as abandoned - the extension crashed or the
 * tab closed mid-run - and becomes claimable again automatically.
 */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

export function staleThresholdIso(): string {
  return new Date(Date.now() - STALE_CLAIM_MS).toISOString();
}

export interface ClaimableRow {
  id: string;
  status: string;
  autogen_claimed_at: string | null;
}

/**
 * Compare-and-swap claim of `row`: flips it to `generating` and stamps
 * `autogen_claimed_at`, only if its (status, autogen_claimed_at) are still exactly
 * what we read. Postgres serializes concurrent updates to the same row, so of N
 * racing callers (multiple lanes, possibly multiple browser windows) exactly one
 * wins. Returns the new `autogen_claimed_at` iff this caller won the row, else null.
 */
export async function tryClaimRow(row: ClaimableRow): Promise<string | null> {
  const now = new Date().toISOString();
  let q = supabase
    .from("applications")
    .update({ status: "generating", autogen_claimed_at: now })
    .eq("id", row.id)
    .eq("status", row.status);
  q =
    row.autogen_claimed_at == null
      ? q.is("autogen_claimed_at", null)
      : q.eq("autogen_claimed_at", row.autogen_claimed_at);
  const { data } = await q.select("id").maybeSingle();
  return data ? now : null;
}

/** Releases a claim we won but couldn't use (e.g. prompt couldn't be rendered). */
export async function releaseClaim(id: string, backToStatus = "pending"): Promise<void> {
  await supabase
    .from("applications")
    .update({ status: backToStatus, autogen_claimed_at: null })
    .eq("id", id);
}

/**
 * Re-stamps `autogen_claimed_at` to now, but ONLY if the row is still exactly
 * the claim the caller believes it holds (`status='generating'` AND
 * `autogen_claimed_at` matches `expectedClaimedAt`). Called periodically by a
 * lane/window that's still genuinely mid-generation on a long-running attempt,
 * so a legitimately in-progress claim never crosses STALE_CLAIM_MS and gets
 * silently handed to another window's auto-claim. If it returns null, this
 * caller no longer holds the claim (someone else's auto-claim already
 * recycled it as abandoned) - the caller must abort immediately rather than
 * eventually call submit-answer, which would blindly overwrite whatever the
 * new claimant is doing.
 */
export async function refreshClaim(id: string, expectedClaimedAt: string): Promise<string | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("applications")
    .update({ autogen_claimed_at: now })
    .eq("id", id)
    .eq("status", "generating")
    .eq("autogen_claimed_at", expectedClaimedAt)
    .select("id")
    .maybeSingle();
  return data ? now : null;
}
