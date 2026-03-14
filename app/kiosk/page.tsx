import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateHatymClient from "@/components/CreateHatymClient";
import { mapSessionRowToSettings } from "@/lib/sessionSettings";

export const dynamic = "force-dynamic";

export default async function KioskIndex() {
  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("hatym_sessions")
    .select("id,created_at,pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const activeSession = existing?.id
    ? {
        id: existing.id,
        createdAt: existing.created_at,
        settings: mapSessionRowToSettings(existing)
      }
    : null;

  return <CreateHatymClient activeSession={activeSession} />;
}
