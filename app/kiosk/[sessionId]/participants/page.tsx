import ParticipantsClient from "@/components/ParticipantsClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function ParticipantsPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("hatym_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("Hatym session not found");
  }

  return <ParticipantsClient sessionId={sessionId} />;
}
