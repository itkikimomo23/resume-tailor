import { supabase } from "@/lib/supabase";
import { deleteFileFromDrive } from "@/lib/googleDrive";

/** Statuses that mean "this application no longer has a valid generated resume" -
 * any previously uploaded Drive file is now stale and should be removed. */
export const STATUSES_THAT_CLEAR_RESUME = ["pending", "failed"];

/**
 * Deletes the Drive file for each of `ids` that has one (best-effort - a file
 * already gone is not an error), and returns the DB fields to null out
 * alongside the status update so callers don't leave orphaned Drive files or
 * dangling google_drive_file_id/google_drive_link references. Shared by the
 * single-application and batch PATCH routes so their cleanup can't drift apart.
 */
export async function resumeClearingFields(
  ids: string[]
): Promise<{ google_drive_file_id: null; google_drive_link: null }> {
  const { data: apps } = await supabase
    .from("applications")
    .select("google_drive_file_id")
    .in("id", ids)
    .not("google_drive_file_id", "is", null);

  await Promise.all(
    (apps ?? []).map(async (app) => {
      try {
        await deleteFileFromDrive(app.google_drive_file_id as string);
      } catch {
        // Drive file may already be gone — continue
      }
    })
  );

  return { google_drive_file_id: null, google_drive_link: null };
}
