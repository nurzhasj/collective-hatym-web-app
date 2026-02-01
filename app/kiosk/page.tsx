import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function KioskIndex() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_hatym_session");
  if (error || !data) {
    throw new Error(error?.message || "Unable to create hatym session");
  }
  redirect(`/kiosk/${data}`);
}
