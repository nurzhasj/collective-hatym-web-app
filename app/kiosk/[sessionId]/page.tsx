import KioskClient from "@/components/KioskClient";
<<<<<<< HEAD
=======
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapSessionRowToSettings } from "@/lib/sessionSettings";
>>>>>>> 3e37cd6 (Added: menu for hatym)

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function KioskPage({ params }: Props) {
  const { sessionId } = await params;
<<<<<<< HEAD
  return <KioskClient sessionId={sessionId} />;
=======
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hatym_sessions")
    .select("pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Hatym session not found");
  }

  return <KioskClient sessionId={sessionId} sessionSettings={mapSessionRowToSettings(data)} />;
>>>>>>> 3e37cd6 (Added: menu for hatym)
}
