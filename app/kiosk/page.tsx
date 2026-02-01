import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KioskIndex() {
  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("hatym_sessions")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    redirect(`/kiosk/${existing.id}`);
  }

  const { data, error } = await supabase.rpc("create_hatym_session");
  if (error || !data) {
    throw new Error(error?.message || "Unable to create hatym session");
  }
  redirect(`/kiosk/${data}`);
}
