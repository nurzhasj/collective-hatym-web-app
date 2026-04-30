"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DayimLogo from "@/components/DayimLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type HatymPage = {
  page_number: number;
  status: "available" | "assigned" | "completed";
  assigned_to: string | null;
};

type ParticipantRow = {
  session_id: string;
  user_id: string;
  name: string;
  deceased_name: string | null;
  joined_at: string;
  last_seen_at: string;
};

type ClaimEventRow = {
  id: number;
  session_id: string;
  user_id: string;
  page_number: number;
  claimed_at: string;
  completed_at: string | null;
  expired_at: string | null;
};

type Props = {
  sessionId: string;
};

const COPY = {
  title: "Хатым етушілер",
  backToKiosk: "← Киоскқа",
  backToList: "Хатымдар тізімі",
  joinedAt: "Қосылған уақыты",
  readPages: "Оқыған беттері",
  currentPages: "Оқып жатқан беттері",
  missedPages: "Үлгермеген беттері",
  dedication: "Кімге арналған",
  noParticipants: "Әлі қатысушылар жоқ.",
  none: "Жоқ",
  loading: "Қатысушылар тізімі жүктелуде...",
  reload: "Қайта жүктеу"
};

const V2_SCHEMA_WARNING =
  "Supabase схемасы v2 үшін жаңартылмаған. Қатысушылар, үлгермеген беттер және арналған есімдер үшін supabase/schema.sql файлын базаға қолданыңыз.";

function isMissingV2SchemaError(message: string) {
  return (
    message.includes("hatym_participants") ||
    message.includes("hatym_claim_events") ||
    message.includes("schema cache")
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-[72px] bg-white shadow-[0_1px_0_rgba(54,66,132,0.08)] lg:h-[111px]">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 lg:px-6 xl:px-0">
        <DayimLogo />
        <nav className="hidden items-center gap-12 text-[18px] font-semibold text-figma-blue lg:flex xl:text-[24px]">
          <Link href="/kiosk/new" className="transition hover:opacity-70">
            Жаңа хатым
          </Link>
          <Link href="/kiosk/list" className="transition hover:opacity-70">
            Хатымдар тізімі
          </Link>
          <Link href="/" className="transition hover:opacity-70">
            Басты бет
          </Link>
        </nav>
      </div>
    </header>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("kk-KZ", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatPagesList(pageNumbers: number[]) {
  if (!pageNumbers.length) return COPY.none;
  return pageNumbers.join(", ");
}

function PagePill({ children, tone = "blue" }: { children: string; tone?: "blue" | "red" }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        tone === "red" ? "bg-red-50 text-red-700" : "bg-[#eceeff] text-[#0000b8]"
      }`}
    >
      {children}
    </span>
  );
}

export default function ParticipantsClient({ sessionId }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [pages, setPages] = useState<HatymPage[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [claimEvents, setClaimEvents] = useState<ClaimEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const t = COPY;

  useEffect(() => {
    let isMounted = true;

    async function fetchParticipants(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      await supabase.rpc("release_expired_assignments", {
        p_session_id: sessionId
      });

      const [pagesResult, participantsResult, eventsResult] = await Promise.all([
        supabase
          .from("hatym_pages")
          .select("page_number,status,assigned_to")
          .eq("session_id", sessionId)
          .order("page_number", { ascending: true }),
        supabase
          .from("hatym_participants")
          .select("session_id,user_id,name,deceased_name,joined_at,last_seen_at")
          .eq("session_id", sessionId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("hatym_claim_events")
          .select("id,session_id,user_id,page_number,claimed_at,completed_at,expired_at")
          .eq("session_id", sessionId)
          .order("claimed_at", { ascending: true })
      ]);

      if (!isMounted) return;
      const v2Errors = [participantsResult.error, eventsResult.error].filter(Boolean);
      const unexpectedV2Error = [pagesResult.error, ...v2Errors].find(
        (item) => item && !isMissingV2SchemaError(item.message)
      );

      if (unexpectedV2Error) {
        setError(unexpectedV2Error.message);
        if (showLoading) {
          setLoading(false);
        }
        return;
      }

      setSchemaWarning(v2Errors.length ? V2_SCHEMA_WARNING : null);
      setPages((pagesResult.data ?? []) as HatymPage[]);
      setParticipants(v2Errors.length ? [] : ((participantsResult.data ?? []) as ParticipantRow[]));
      setClaimEvents(v2Errors.length ? [] : ((eventsResult.data ?? []) as ClaimEventRow[]));
      if (showLoading) {
        setLoading(false);
      }
    }

    fetchParticipants(true);
    const refreshTimer = window.setInterval(() => {
      void fetchParticipants(false);
    }, 10000);

    const channel = supabase
      .channel(`hatym_participants_page:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hatym_pages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as HatymPage;
          if (!next?.page_number) return;
          setPages((prev) => {
            const idx = prev.findIndex((page) => page.page_number === next.page_number);
            if (idx === -1) return prev;
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...next };
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hatym_participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as ParticipantRow;
          if (!next?.user_id) return;
          setParticipants((prev) => {
            const idx = prev.findIndex((participant) => participant.user_id === next.user_id);
            if (idx === -1) return [...prev, next].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...next };
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hatym_claim_events", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as ClaimEventRow;
          if (!next?.id) return;
          setClaimEvents((prev) => {
            const idx = prev.findIndex((event) => event.id === next.id);
            if (idx === -1) return [...prev, next].sort((a, b) => a.claimed_at.localeCompare(b.claimed_at));
            const updated = [...prev];
            updated[idx] = { ...updated[idx], ...next };
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, supabase]);

  const participantSummaries = useMemo(() => {
    return participants.map((participant) => {
      const currentPages = pages
        .filter((page) => page.status === "assigned" && page.assigned_to === participant.user_id)
        .map((page) => page.page_number)
        .sort((a, b) => a - b);

      const readPageSet = new Set<number>();
      for (const event of claimEvents) {
        if (event.user_id === participant.user_id && event.completed_at) {
          readPageSet.add(event.page_number);
        }
      }
      for (const page of pages) {
        if (page.status === "completed" && page.assigned_to === participant.user_id) {
          readPageSet.add(page.page_number);
        }
      }

      const missedPages = claimEvents
        .filter((event) => event.user_id === participant.user_id && event.expired_at)
        .map((event) => event.page_number)
        .sort((a, b) => a - b);

      return {
        ...participant,
        currentPages,
        readPages: Array.from(readPageSet).sort((a, b) => a - b),
        missedPages
      };
    });
  }, [claimEvents, pages, participants]);

  if (loading) {
    return (
      <main className="min-h-screen bg-figma-stage text-white">
        <AppHeader />
        <section className="flex min-h-[calc(100svh-72px)] items-center justify-center px-6 text-center text-[20px] font-semibold lg:min-h-[calc(100vh-111px)]">
          {t.loading}
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-figma-stage text-white">
        <AppHeader />
        <section className="flex min-h-[calc(100svh-72px)] flex-col items-center justify-center gap-5 px-5 text-center lg:min-h-[calc(100vh-111px)]">
          <div className="max-w-2xl rounded-[20px] bg-white px-6 py-5 text-[16px] font-medium text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)] sm:px-8 sm:py-6 sm:text-[18px]">
            {error}
          </div>
          <button
            className="h-[44px] rounded-full bg-white px-8 text-[15px] font-semibold uppercase tracking-[0.08em] text-figma-blue transition hover:opacity-85"
            onClick={() => window.location.reload()}
          >
            {t.reload}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-figma-stage text-white">
      <AppHeader />
      <section className="relative overflow-hidden px-5 py-8 lg:px-8 lg:py-14 xl:px-0">
        <img
          alt=""
          className="pointer-events-none absolute right-[-180px] top-[-160px] h-[520px] w-[520px] object-cover opacity-35 sm:right-[-120px] lg:right-0 lg:top-0 lg:h-[764px] lg:w-[764px] lg:opacity-60"
          src="/figma/quran-open.png"
        />
        <div className="relative z-10 mx-auto max-w-[1280px]">
          <div className="mb-6 flex flex-col gap-4 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link
                href={`/kiosk/${sessionId}`}
                className="inline-flex rounded-full bg-white px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-figma-blue shadow-[0_6px_18px_rgba(13,22,85,0.16)] transition hover:opacity-85"
              >
                {t.backToKiosk}
              </Link>
              <h1 className="mt-5 text-[28px] font-semibold uppercase leading-[1.1] tracking-[-0.84px] sm:text-[36px]">
                {t.title}
              </h1>
              <p className="mt-2 text-[14px] font-medium text-white/70 sm:text-[16px]">
                {participants.length} қатысушы, {claimEvents.filter((event) => event.expired_at).length} үлгермеген бет
              </p>
            </div>
            <Link
              href="/kiosk/list"
              className="inline-flex h-[44px] items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold uppercase tracking-[0.08em] text-figma-blue shadow-[0_6px_18px_rgba(13,22,85,0.16)] transition hover:opacity-85"
            >
              {t.backToList}
            </Link>
          </div>

          {schemaWarning ? (
            <div className="mb-5 rounded-[18px] border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              {schemaWarning}
            </div>
          ) : null}

          <div className="grid gap-4 lg:hidden">
            {participantSummaries.map((participant) => (
              <article key={participant.user_id} className="rounded-[20px] bg-white p-5 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] font-semibold tracking-[-0.6px]">{participant.name}</h2>
                    <p className="mt-1 text-[12px] font-medium text-figma-blue/55">
                      {formatDateTime(participant.joined_at)}
                    </p>
                  </div>
                  {participant.missedPages.length ? <PagePill tone="red">{formatPagesList(participant.missedPages)}</PagePill> : null}
                </div>
                <div className="mt-5 grid gap-4 text-[13px]">
                  <div>
                    <div className="mb-2 font-semibold uppercase tracking-[0.12em] text-figma-blue/50">{t.readPages}</div>
                    <PagePill>{formatPagesList(participant.readPages)}</PagePill>
                  </div>
                  <div>
                    <div className="mb-2 font-semibold uppercase tracking-[0.12em] text-figma-blue/50">{t.currentPages}</div>
                    <PagePill>{formatPagesList(participant.currentPages)}</PagePill>
                  </div>
                  <div>
                    <div className="mb-2 font-semibold uppercase tracking-[0.12em] text-figma-blue/50">{t.dedication}</div>
                    <span className="text-figma-blue/75">{participant.deceased_name || t.none}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-[20px] bg-white p-7 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)] lg:block">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-figma-blue/10 text-xs uppercase tracking-[0.16em] text-figma-blue/55">
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">{t.joinedAt}</th>
                  <th className="py-3 pr-4 font-medium">{t.readPages}</th>
                  <th className="py-3 pr-4 font-medium">{t.currentPages}</th>
                  <th className="py-3 pr-4 font-medium">{t.missedPages}</th>
                  <th className="py-3 font-medium">{t.dedication}</th>
                </tr>
              </thead>
              <tbody>
                {participantSummaries.map((participant) => (
                  <tr key={participant.user_id} className="border-b border-figma-blue/10 align-top last:border-0">
                    <td className="py-4 pr-4 font-semibold">{participant.name}</td>
                    <td className="py-4 pr-4 text-figma-blue/70">{formatDateTime(participant.joined_at)}</td>
                    <td className="py-4 pr-4 text-figma-blue/70">{formatPagesList(participant.readPages)}</td>
                    <td className="py-4 pr-4 text-figma-blue/70">{formatPagesList(participant.currentPages)}</td>
                    <td className="py-4 pr-4">
                      {participant.missedPages.length ? (
                        <PagePill tone="red">{formatPagesList(participant.missedPages)}</PagePill>
                      ) : (
                        <span className="text-figma-blue/45">{t.none}</span>
                      )}
                    </td>
                    <td className="py-4 text-figma-blue/70">{participant.deceased_name || t.none}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!participantSummaries.length ? (
            <div className="rounded-[20px] bg-white px-8 py-8 text-center text-sm text-figma-blue/60 shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
              {t.noParticipants}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
