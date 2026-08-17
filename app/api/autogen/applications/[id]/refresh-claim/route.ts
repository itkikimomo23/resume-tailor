import { NextRequest, NextResponse } from "next/server";
import { requireBearerAuth } from "@/lib/auth";
import { refreshClaim } from "@/lib/autogenClaim";

/**
 * Called periodically by a lane/window while it's still actively working on a
 * long-running attempt, to keep its claim from crossing STALE_CLAIM_MS while
 * genuinely still in progress - and to detect early if another window's
 * auto-claim already recycled it as abandoned, rather than only finding out
 * after wasting a full ChatGPT generation on a submit-answer call that's too
 * late. Body: `{ claimedAt }` - the `autogen_claimed_at` this caller currently
 * believes it holds. Returns `{ ok: true, claimedAt }` on success (use the new
 * `claimedAt` for the next refresh), or `{ ok: false }` if the claim was
 * already lost - the caller must abort this attempt and move on instead of
 * continuing to generate.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireBearerAuth(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const claimedAt = String(body?.claimedAt ?? "");
  if (!claimedAt) return NextResponse.json({ message: "claimedAt is required" }, { status: 400 });

  const refreshedAt = await refreshClaim(id, claimedAt);
  if (!refreshedAt) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, claimedAt: refreshedAt });
}
