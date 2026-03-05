<<<<<<< HEAD
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
=======
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateHatymClient from "@/components/CreateHatymClient";
import { mapSessionRowToSettings } from "@/lib/sessionSettings";
>>>>>>> 3e37cd6 (Added: menu for hatym)

export const dynamic = "force-dynamic";

export default async function KioskIndex() {
  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("hatym_sessions")
<<<<<<< HEAD
    .select("id")
=======
    .select("id,created_at,pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
>>>>>>> 3e37cd6 (Added: menu for hatym)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

<<<<<<< HEAD
  if (existing?.id) {
    redirect(`/kiosk/${existing.id}`);
  }

  const { data, error } = await supabase.rpc("create_hatym_session");
  if (error || !data) {
    throw new Error(error?.message || "Unable to create hatym session");
  }
  redirect(`/kiosk/${data}`);
=======
  const activeSession = existing?.id
    ? {
        id: existing.id,
        createdAt: existing.created_at,
        settings: mapSessionRowToSettings(existing)
      }
    : null;

  return <CreateHatymClient activeSession={activeSession} />;
>>>>>>> 3e37cd6 (Added: menu for hatym)
}
