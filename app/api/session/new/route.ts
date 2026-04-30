import { NextResponse } from "next/server";
import { normalizeSessionSettings } from "@/lib/sessionSettings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  pagesPerUser?: unknown;
  pageTtlMinutes?: unknown;
  autoCompleteAfterMinutes?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    const settings = normalizeSessionSettings(body ?? undefined);
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_hatym_session_with_settings", {
      p_pages_per_user: settings.pagesPerUser,
      p_page_ttl_minutes: settings.pageTtlMinutes,
      p_auto_complete_after_minutes: settings.autoCompleteAfterMinutes
    });

    if (error || !data) {
      const isSchemaMismatch =
        error?.message?.includes("create_hatym_session_with_settings") ||
        error?.message?.includes("hatym_sessions_single_row_idx") ||
        error?.message?.includes("hatym_participants") ||
        error?.message?.includes("schema cache");
      const message =
        isSchemaMismatch
          ? "Database schema is outdated. Apply the latest supabase/schema.sql to remove the legacy single-session constraint and add v2 tables."
          : error?.message || "Unable to create session";

      return NextResponse.json(
        { error: message },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
