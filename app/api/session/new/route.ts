import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_hatym_session");
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Unable to create session" },
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
