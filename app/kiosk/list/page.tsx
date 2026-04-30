import { createSupabaseServerClient } from "@/lib/supabase/server";
import CreateHatymClient, { type HatymSessionSummary } from "@/components/CreateHatymClient";
import { mapSessionRowToSettings } from "@/lib/sessionSettings";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  created_at: string;
  completed_at: string | null;
  is_active: boolean;
  pages_per_user: number;
  page_ttl_minutes: number;
  auto_complete_after_minutes: number | null;
};

type PageRow = {
  session_id: string;
  status: "available" | "assigned" | "completed";
};

type ParticipantRow = {
  session_id: string;
  user_id: string;
  deceased_name: string | null;
};

const V2_SCHEMA_WARNING =
  "Supabase схемасы v2 үшін жаңартылмаған. Қатысушылар мен арналған есімдер көрінуі үшін supabase/schema.sql файлын базаға қолданыңыз.";

function isMissingV2SchemaError(message: string) {
  return (
    message.includes("hatym_participants") ||
    message.includes("hatym_claim_events") ||
    message.includes("schema cache")
  );
}

export default async function KioskListPage() {
  const supabase = createSupabaseServerClient();
  const { data: sessionsData, error: sessionsError } = await supabase
    .from("hatym_sessions")
    .select("id,created_at,completed_at,is_active,pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
    .order("created_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const sessions = (sessionsData ?? []) as SessionRow[];
  const sessionIds = sessions.map((session) => session.id);

  let pages: PageRow[] = [];
  let participants: ParticipantRow[] = [];
  let schemaWarning: string | null = null;

  if (sessionIds.length) {
    const [{ data: pagesData, error: pagesError }, { data: participantsData, error: participantsError }] =
      await Promise.all([
        supabase.from("hatym_pages").select("session_id,status").in("session_id", sessionIds),
        supabase.from("hatym_participants").select("session_id,user_id,deceased_name").in("session_id", sessionIds)
      ]);

    if (pagesError) {
      throw new Error(pagesError.message);
    }
    if (participantsError) {
      if (isMissingV2SchemaError(participantsError.message)) {
        schemaWarning = V2_SCHEMA_WARNING;
      } else {
        throw new Error(participantsError.message);
      }
    }

    pages = (pagesData ?? []) as PageRow[];
    participants = participantsError ? [] : ((participantsData ?? []) as ParticipantRow[]);
  }

  const summaries: HatymSessionSummary[] = sessions.map((session) => {
    const sessionPages = pages.filter((page) => page.session_id === session.id);
    const sessionParticipants = participants.filter((participant) => participant.session_id === session.id);
    const dedications = Array.from(
      new Set(
        sessionParticipants
          .map((participant) => participant.deceased_name?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );

    return {
      id: session.id,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      isActive: session.is_active,
      settings: mapSessionRowToSettings(session),
      completedPages: sessionPages.filter((page) => page.status === "completed").length,
      assignedPages: sessionPages.filter((page) => page.status === "assigned").length,
      availablePages: sessionPages.filter((page) => page.status === "available").length,
      participantCount: new Set(sessionParticipants.map((participant) => participant.user_id)).size,
      dedications
    };
  });

  return <CreateHatymClient sessions={summaries} schemaWarning={schemaWarning} view="list" />;
}
