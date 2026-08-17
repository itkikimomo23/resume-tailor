import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Shifts a UTC instant so its UTC getters read as JST wall-clock time.
function toJstShifted(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MS);
}

// Reverses toJstShifted — turns a JST wall-clock Date back into the real UTC instant.
function fromJstShifted(d: Date): Date {
  return new Date(d.getTime() - JST_OFFSET_MS);
}

function isDice(job_url: string | null, job_board: string | null): boolean {
  return /dice\.com/i.test(job_url ?? "") || /dice\.com/i.test(job_board ?? "");
}

export async function GET() {
  const jstNow = toJstShifted(new Date());

  // Daily bid counts — current week (Sun-Sat) in JST, summed across all profiles
  const jstWeekStart = new Date(jstNow);
  jstWeekStart.setUTCHours(0, 0, 0, 0);
  jstWeekStart.setUTCDate(jstWeekStart.getUTCDate() - jstWeekStart.getUTCDay());
  const jstWeekEnd = new Date(jstWeekStart);
  jstWeekEnd.setUTCDate(jstWeekEnd.getUTCDate() + 7);

  const weekStartUtc = fromJstShifted(jstWeekStart);
  const weekEndUtc = fromJstShifted(jstWeekEnd);

  const { data: apps, error } = await supabase
    .from("applications")
    .select("id, created_at, job_url, job_board")
    .gte("created_at", weekStartUtc.toISOString())
    .lt("created_at", weekEndUtc.toISOString());

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const diceMap = new Map<string, number>();
  const otherMap = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(jstWeekStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    diceMap.set(key, 0);
    otherMap.set(key, 0);
  }

  for (const a of apps) {
    const day = toJstShifted(new Date(a.created_at)).toISOString().slice(0, 10);
    const map = isDice(a.job_url, a.job_board) ? diceMap : otherMap;
    if (map.has(day)) map.set(day, (map.get(day) ?? 0) + 1);
  }

  const diceCounts = Array.from(diceMap.entries()).map(([date, count]) => ({ date, count }));
  const otherCounts = Array.from(otherMap.entries()).map(([date, count]) => ({ date, count }));

  return NextResponse.json({ diceCounts, otherCounts });
}
