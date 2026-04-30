"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import Confetti from "react-confetti";
import DayimLogo from "@/components/DayimLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TOTAL_PAGES } from "@/lib/constants";
import { type SessionSettings } from "@/lib/sessionSettings";

const statusColors: Record<string, string> = {
  available: "#c8c8c8",
  assigned: "#f2c94c",
  completed: "#27ae60"
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
  sessionSettings: SessionSettings;
};

const COPY = {
  backToMenu: "← Мәзірге",
  scanPrompt: "Скан жасап, хатымға қатыс!",
  completedCount: "аяқталды",
  perUserLimit: "Бір адамға бет саны",
  pageTtl: "Бет TTL",
  pageDashboard: "Беттер панелі",
  participantDashboard: "Қатысушылар тізімі",
  available: "Бос",
  assigned: "Тағайындалған",
  completed: "Аяқталған",
  loading: "Хатым сессиясы жүктелуде...",
  reload: "Қайта жүктеу",
  confettiTitle: "Құттықтаймыз, хатым аяқталды!",
  confettiSubtitle: "Барлық 604 бет аяқталды.",
  startNewSession: "Жаңа хатым параметрлерін орнату",
  ringLabel: "аяқталды",
  ringCaption: "Хатым оқылуы"
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

function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="flex items-center gap-[10px] text-[14px] font-medium uppercase tracking-[0.02em] text-white/90 lg:text-[18px]">
      <span className="h-[18px] w-[18px] rounded-[3px]" style={{ backgroundColor: color }} />
      {label}: {count}
    </span>
  );
}

function FigmaProgressRing({ completed, total, label }: { completed: number; total: number; label: string }) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0;
  const percent = (ratio * 100).toFixed(2);
  const size = 236;
  const stroke = 20;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-[236px] w-[236px]">
        <svg className="-rotate-90" width={size} height={size} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e9ebf5"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e14339"
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        {ratio > 0 ? (
          <span className="absolute left-1/2 top-[2px] h-[22px] w-[22px] -translate-x-1/2 rounded-full bg-[#e14339]" />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[42px] font-bold leading-none tracking-[-1.26px] text-white">{percent}%</div>
          <div className="mt-3 text-[13px] font-medium uppercase tracking-[0.36em] text-white/70">{label}</div>
        </div>
      </div>
      <div className="text-[18px] font-medium uppercase tracking-[0.45em] text-white/70">Хатым оқылуы</div>
    </div>
  );
}

export default function KioskClient({ sessionId, sessionSettings }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [pages, setPages] = useState<HatymPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState("");
  const { width, height } = useWindowSize();
  const t = COPY;

  useEffect(() => {
    const override = process.env.NEXT_PUBLIC_KIOSK_BASE_URL;
    const origin = override ? override.replace(/\/$/, "") : window.location.origin;
    setQrValue(`${origin}/s/${sessionId}/claim?auto=1`);
  }, [sessionId]);

  useEffect(() => {
    let isMounted = true;

    async function fetchPages(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      await supabase.rpc("release_expired_assignments", {
        p_session_id: sessionId
      });

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

  if (loading) {
    return (
      <main className="min-h-screen bg-figma-stage text-white">
        <AppHeader />
        <section className="flex min-h-[calc(100svh-72px)] items-center justify-center px-6 text-center text-[20px] font-semibold lg:min-h-[calc(100vh-111px)] lg:text-[22px]">
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

  if (isComplete) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-figma-stage text-white">
        <Confetti width={width} height={height} numberOfPieces={350} recycle={false} />
        <AppHeader />
        <div className="pointer-events-none absolute inset-0 top-[72px] overflow-hidden lg:top-[111px]">
          <img
            alt=""
            className="absolute left-1/2 top-[-110px] h-[640px] w-[640px] -translate-x-1/2 object-cover opacity-35 lg:h-[900px] lg:w-[900px]"
            src="/figma/quran-open.png"
          />
        </div>
        <div className="relative z-10 flex min-h-[calc(100svh-72px)] flex-col items-center justify-center gap-6 px-5 text-center lg:min-h-[calc(100vh-111px)]">
          <div className="max-w-3xl rounded-[20px] bg-white px-6 py-8 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)] sm:px-8 sm:py-10">
            <div className="text-[30px] font-semibold tracking-[-0.9px] lg:text-[50px] lg:tracking-[-1.02px]">{t.confettiTitle}</div>
            <div className="mt-4 text-[18px] font-medium text-figma-blue/70">{t.confettiSubtitle}</div>
          </div>
          <button
            className="h-[50px] rounded-full bg-white px-8 text-[15px] font-semibold uppercase tracking-[0.08em] text-figma-blue transition hover:opacity-85"
            onClick={() => {
              window.location.href = "/kiosk";
            }}
          >
            {t.startNewSession}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-figma-stage text-white">
      <AppHeader />

      <section className="relative overflow-hidden px-5 pb-10 pt-6 sm:px-6 lg:min-h-[913px] lg:px-8 lg:pb-20 lg:pt-9 xl:px-0">
        <img
          alt=""
          className="pointer-events-none absolute right-[-210px] top-[-155px] h-[520px] w-[520px] object-cover opacity-30 sm:right-[-140px] lg:left-0 lg:right-auto lg:top-[-61px] lg:h-[974px] lg:w-[974px] lg:opacity-80"
          src="/figma/quran-open.png"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] bg-[#384995]/45 lg:block" />

        <div className="relative z-10 mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[540px_minmax(0,731px)] lg:gap-[47px]">
          <section className="flex flex-col items-center">
            <div className="mb-5 flex w-full flex-wrap items-center gap-3">
              <Link
                href="/kiosk"
                className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-figma-blue shadow-[0_6px_18px_rgba(13,22,85,0.16)] transition hover:opacity-85 sm:px-6 sm:py-3 sm:text-[15px]"
              >
                {t.backToMenu}
              </Link>
              <Link
                href={`/kiosk/${sessionId}/participants`}
                className="rounded-full bg-white px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-figma-blue shadow-[0_6px_18px_rgba(13,22,85,0.16)] transition hover:opacity-85 sm:px-6 sm:py-3 sm:text-[15px]"
              >
                {t.participantDashboard}
              </Link>
            </div>

            <div className="flex w-full flex-col items-center rounded-[20px] bg-white px-4 pb-5 pt-6 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)] sm:px-7 lg:min-h-[581px]">
              <h1 className="text-center text-[22px] font-semibold leading-[1.2] tracking-[-0.66px] sm:text-[24px] lg:text-[28px] lg:tracking-[-0.72px]">
                {t.scanPrompt}
              </h1>
              <div className="mt-6 w-full max-w-[446px] rounded-[18px] bg-white p-3 shadow-[0_14px_38px_rgba(0,0,0,0.18)] sm:mt-8 sm:rounded-[20px] sm:p-4">
                <QRCodeCanvas
                  value={qrValue}
                  size={512}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  style={{ display: "block", height: "auto", width: "100%" }}
                />
              </div>
              <div className="mt-6 text-[24px] font-semibold leading-[1.2] tracking-[-0.72px] sm:mt-7 sm:text-[28px] sm:tracking-[-0.84px]">
                {counts.completed} / {TOTAL_PAGES} {t.completedCount}
              </div>
            </div>

            <div className="mt-5 flex w-full max-w-[540px] flex-col items-center gap-2 rounded-[18px] bg-white px-5 py-4 text-center text-[11px] font-medium uppercase tracking-[0.28em] text-figma-blue/55 shadow-[0_10px_30px_rgba(13,22,85,0.16)] sm:px-6 sm:text-[13px] sm:tracking-[0.42em]">
              <div>
                {t.perUserLimit}: {sessionSettings.pagesPerUser}
              </div>
              <div>
                {t.pageTtl}: {sessionSettings.pageTtlMinutes} мин
              </div>
            </div>
          </section>

          <section className="flex flex-col">
            <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 sm:mb-7 lg:pl-[59px]">
              <LegendItem color={statusColors.available} label={t.available} count={counts.available} />
              <LegendItem color={statusColors.assigned} label={t.assigned} count={counts.assigned} />
              <LegendItem color={statusColors.completed} label={t.completed} count={counts.completed} />
            </div>

            <div
              className="grid gap-[3px] rounded-[20px] bg-white p-3 shadow-[0_18px_60px_rgba(13,22,85,0.22)]"
              style={{ gridTemplateColumns: "repeat(31, minmax(0, 1fr))" }}
            >
              {pages.map((page) => (
                <div
                  key={page.page_number}
                  className="aspect-square rounded-[3px]"
                  style={{ backgroundColor: statusColors[page.status] }}
                  title={`Page ${page.page_number}: ${page.status}`}
                />
              ))}
            </div>

            <div className="mt-9 flex justify-center lg:mt-[54px]">
              <FigmaProgressRing completed={counts.completed} total={TOTAL_PAGES} label={t.ringLabel} />
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
