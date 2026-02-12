"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Confetti from "react-confetti";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ASSIGNMENT_TTL_MINUTES, MAX_PAGES_PER_USER, TOTAL_PAGES } from "@/lib/constants";
import ProgressRing from "@/components/ProgressRing";

const statusColors: Record<string, string> = {
  available: "bg-hatym-gray",
  assigned: "bg-hatym-yellow",
  completed: "bg-hatym-green"
};

type HatymPage = {
  page_number: number;
  status: "available" | "assigned" | "completed";
  assigned_to: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  claim_token: string | null;
  session_id: string;
};

type Props = {
  sessionId: string;
};

const COPY = {
  scanPrompt: "Скан жасап, келесі бетті ал",
  completedCount: "аяқталды",
  perUserLimit: "Бір адамға бет саны",
  pageDashboard: "Беттер панелі",
  available: "Бос",
  assigned: "Тағайындалған",
  completed: "Аяқталған",
  loading: "Хатым сессиясы жүктелуде...",
  reload: "Қайта жүктеу",
  confettiTitle: "Құттықтаймыз, хатым аяқталды!",
  confettiSubtitle: "Барлық 604 бет аяқталды.",
  startNewSession: "Жаңа хатым сессиясын бастау",
  starting: "Басталуда...",
  ringLabel: "аяқталды",
  ringCaption: "Хатым орындалуы"
};

function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export default function KioskClient({ sessionId }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [pages, setPages] = useState<HatymPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState("");
  const [starting, setStarting] = useState(false);
  const { width, height } = useWindowSize();
  const t = COPY;

  useEffect(() => {
    const override = process.env.NEXT_PUBLIC_KIOSK_BASE_URL;
    const origin = override ? override.replace(/\/$/, "") : window.location.origin;
    setQrValue(`${origin}/s/${sessionId}/claim`);
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPages(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const { error: releaseError } = await supabase.rpc("release_expired_assignments", {
        p_session_id: sessionId,
        p_ttl_minutes: ASSIGNMENT_TTL_MINUTES
      });
      if (releaseError) {
        setError(releaseError.message);
        if (showLoading) {
          setLoading(false);
        }
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("hatym_pages")
        .select("session_id,page_number,status,assigned_to,assigned_at,completed_at,claim_token")
        .eq("session_id", sessionId)
        .order("page_number", { ascending: true });

      if (!isMounted) return;
      if (fetchError) {
        setError(fetchError.message);
        if (showLoading) {
          setLoading(false);
        }
        return;
      }
      setPages((data ?? []) as HatymPage[]);
      if (showLoading) {
        setLoading(false);
      }
    }

    fetchPages(true);
    const refreshTimer = window.setInterval(() => {
      void fetchPages(false);
    }, 10000);

    const channel = supabase
      .channel(`hatym_pages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hatym_pages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const next = payload.new as HatymPage;
          if (!next?.page_number) return;
          setPages((prev) => {
            if (!prev.length) return prev;
            const idx = prev.findIndex((page) => page.page_number === next.page_number);
            if (idx === -1) return prev;
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

  const counts = useMemo(() => {
    let available = 0;
    let assigned = 0;
    let completed = 0;
    for (const page of pages) {
      if (page.status === "available") available += 1;
      if (page.status === "assigned") assigned += 1;
      if (page.status === "completed") completed += 1;
    }
    return { available, assigned, completed };
  }, [pages]);

  const isComplete = counts.completed >= TOTAL_PAGES && pages.length > 0;

  async function handleStartNewSession() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/session/new", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Жаңа сессияны бастау мүмкін болмады");
      }
      const body = (await response.json()) as { sessionId: string };
      window.location.href = `/kiosk/${body.sessionId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жаңа сессияны бастау мүмкін болмады");
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-hatym-ink">
        {t.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-hatym-ink">
        <div className="text-lg">{error}</div>
        <button
          className="rounded-full border border-hatym-ink px-6 py-2 text-sm uppercase tracking-wide"
          onClick={() => window.location.reload()}
        >
          {t.reload}
        </button>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-hatym-dark text-white">
        <Confetti width={width} height={height} numberOfPieces={350} recycle={false} />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 text-center">
          <div className="text-5xl font-semibold tracking-tight">{t.confettiTitle}</div>
          <div className="text-lg text-white/80">{t.confettiSubtitle}</div>
          <button
            className="rounded-full bg-white px-8 py-3 text-sm font-semibold uppercase tracking-wide text-hatym-dark transition hover:scale-[1.02]"
            onClick={handleStartNewSession}
            disabled={starting}
          >
            {starting ? t.starting : t.startNewSession}
          </button>
          {error ? <div className="text-sm text-red-200">{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-0">
      <section className="flex flex-col items-center justify-center gap-6 px-10 py-12 bg-white/70">
        <div className="text-2xl font-semibold tracking-tight text-hatym-ink">
          {t.scanPrompt}
        </div>
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-xl">
          <QRCodeCanvas value={qrValue} size={320} bgColor="#ffffff" fgColor="#111111" />
        </div>
        <div className="text-xl font-semibold text-hatym-ink">
          {counts.completed} / {TOTAL_PAGES} {t.completedCount}
        </div>
        <div className="text-xs uppercase tracking-[0.3em] text-hatym-ink/60">
          {t.perUserLimit}: {MAX_PAGES_PER_USER}
        </div>
      </section>

      <section className="flex flex-col gap-6 px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xl font-semibold text-hatym-ink">{t.pageDashboard}</div>
          <div className="flex flex-wrap items-center gap-4 text-sm uppercase tracking-wide text-hatym-ink/70">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-hatym-gray" /> {t.available}: {counts.available}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-hatym-yellow" /> {t.assigned}: {counts.assigned}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-hatym-green" /> {t.completed}: {counts.completed}
            </span>
          </div>
        </div>

        <div
          className="grid gap-[2px] rounded-2xl border border-black/10 bg-white/80 p-2"
          style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}
        >
          {pages.map((page) => (
            <div
              key={page.page_number}
              className={`aspect-square rounded-[2px] ${statusColors[page.status]}`}
              title={`Page ${page.page_number}: ${page.status}`}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 pt-4">
          <ProgressRing completed={counts.completed} total={TOTAL_PAGES} label={t.ringLabel} />
          <div className="text-xs uppercase tracking-[0.35em] text-hatym-ink/60">
            {t.ringCaption}
          </div>
        </div>
      </section>
    </div>
  );
}
