import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Body = {
  sessionId?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data: session, error: sessionError } = await supabase
      .from("hatym_sessions")
      .select("id,is_active")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 500 });
    }
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.is_active !== true) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    const nowIso = new Date().toISOString();

    const { error: pagesError } = await supabase
      .from("hatym_pages")
      .update({
        status: "completed",
        completed_at: nowIso,
        assigned_to: null,
        assigned_at: null,
        claim_token: null
      })
      .eq("session_id", sessionId)
      .neq("status", "completed");

    if (pagesError) {
      return NextResponse.json({ error: pagesError.message }, { status: 500 });
    }

    const { error: finishError } = await supabase
      .from("hatym_sessions")
      .update({
        is_active: false,
        completed_at: nowIso
      })
      .eq("id", sessionId);

    if (finishError) {
      return NextResponse.json({ error: finishError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
