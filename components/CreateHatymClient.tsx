"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import DayimLogo from "@/components/DayimLogo";
import {
  DEFAULT_PAGE_TTL_MINUTES,
  DEFAULT_PAGES_PER_USER,
  MAX_PAGE_TTL_MINUTES,
  MAX_PAGES_PER_USER,
  MIN_PAGE_TTL_MINUTES,
  MIN_PAGES_PER_USER,
  TOTAL_PAGES
} from "@/lib/constants";
import type { SessionSettings } from "@/lib/sessionSettings";

export type HatymSessionSummary = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  isActive: boolean;
  settings: SessionSettings;
  completedPages: number;
  assignedPages: number;
  availablePages: number;
  participantCount: number;
  dedications: string[];
};

type Props = {
  sessions: HatymSessionSummary[];
  schemaWarning?: string | null;
  view?: "new" | "list";
};

type SessionFilter = "all" | "active" | "completed";

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat("kk-KZ", {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    }).format(date);
  } catch {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = String(date.getUTCFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  }
}

function getSessionStatus(session: HatymSessionSummary) {
  if (!session.isActive || session.completedAt) return "Аяқталды";
  if (session.completedPages > 0 || session.assignedPages > 0) return "Белсенді";
  return "Белсенді";
}

function getSessionNumber(session: HatymSessionSummary, index: number) {
  const idFragment = session.id.split("-")[0];
  const parsed = Number.parseInt(idFragment.slice(0, 3), 16);
  if (Number.isFinite(parsed)) {
    return (parsed % 99) + 1;
  }
  return index + 1;
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-30 h-[72px] bg-white shadow-[0_1px_0_rgba(54,66,132,0.08)] lg:h-[111px]">
      <div className="mx-auto flex h-full max-w-[1184px] items-center justify-between px-5 lg:px-6">
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

function BookIcon({ closed }: { closed: boolean }) {
  return (
    <span className="relative flex h-10 w-10 items-center justify-center">
      <span className={`absolute h-8 w-5 rounded-[6px] ${closed ? "bg-[#f6df47]" : "bg-[#ffe7a7]"} shadow-sm`} />
      <span
        className={`absolute h-7 w-5 rounded-[5px] border border-white/70 ${
          closed ? "bg-[#f3d94a]" : "left-2 rotate-[-18deg] bg-[#ffd983]"
        }`}
      />
      {!closed ? (
        <span className="absolute right-2 h-7 w-5 rotate-[18deg] rounded-[5px] border border-white/70 bg-[#ffe7a7]" />
      ) : null}
    </span>
  );
}

function BookOutlineIcon() {
  return (
    <span className="relative h-6 w-7">
      <span className="absolute left-1 top-1 h-4 w-3 rounded-[5px] border-[3px] border-[#0000b8]" />
      <span className="absolute right-1 top-1 h-4 w-3 rounded-[5px] border-[3px] border-[#0000b8]" />
      <span className="absolute left-[12px] top-2 h-4 w-[3px] bg-[#0000b8]" />
    </span>
  );
}

function UserIcon() {
  return (
    <span className="relative h-8 w-8">
      <span className="absolute left-[10px] top-[3px] h-[10px] w-[10px] rounded-full border-[3px] border-[#0000b8]" />
      <span className="absolute left-[6px] top-[18px] h-[11px] w-[18px] rounded-t-full border-[3px] border-[#0000b8] border-b-0" />
    </span>
  );
}

function CheckIcon() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#0000b8] text-[24px] font-semibold leading-none text-[#0000b8]">
      ✓
    </span>
  );
}

function ProgressBadge({ percent }: { percent: number }) {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full text-[11px] text-[#0000b8]"
      style={{
        background: `radial-gradient(circle at center, white 55%, transparent 57%), conic-gradient(#0000b8 ${percent}%, #d8dbff 0)`
      }}
    >
      {percent}%
    </span>
  );
}

export default function CreateHatymClient({ sessions: initialSessions, schemaWarning = null, view = "list" }: Props) {
  const [sessions, setSessions] = useState(initialSessions);
  const [pagesPerUser, setPagesPerUser] = useState(DEFAULT_PAGES_PER_USER);
  const [pageTtlMinutes, setPageTtlMinutes] = useState(DEFAULT_PAGE_TTL_MINUTES);
  const [sessionIntent, setSessionIntent] = useState("");
  const [filter, setFilter] = useState<SessionFilter>("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      const isCompleted = !session.isActive || Boolean(session.completedAt);
      if (filter === "active") return !isCompleted;
      if (filter === "completed") return isCompleted;
      return true;
    });
  }, [filter, sessions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      pagesPerUser: clampInt(pagesPerUser, MIN_PAGES_PER_USER, MAX_PAGES_PER_USER),
      pageTtlMinutes: clampInt(pageTtlMinutes, MIN_PAGE_TTL_MINUTES, MAX_PAGE_TTL_MINUTES),
      sessionIntent: sessionIntent.trim()
    };

    try {
      const response = await fetch("/api/session/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Жаңа хатым ашу мүмкін болмады");
      }

      const body = (await response.json()) as { sessionId: string };
      window.location.href = `/kiosk/${body.sessionId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жаңа хатым ашу мүмкін болмады");
      setSubmitting(false);
    }
  }

  async function handleCompleteSession(session: HatymSessionSummary) {
    if (completingSessionId) return;

    const approved = window.confirm(
      "Осы хатымды толық аяқталған деп белгілеймін бе? Барлық беттер аяқталған болып белгіленеді."
    );
    if (!approved) return;

    setCompletingSessionId(session.id);
    setCompleteError(null);

    try {
      const response = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Хатымды аяқтау мүмкін болмады");
      }

      const completedAt = new Date().toISOString();
      setSessions((current) =>
        current.map((item) =>
          item.id === session.id
            ? {
                ...item,
                isActive: false,
                completedAt,
                completedPages: TOTAL_PAGES,
                assignedPages: 0,
                availablePages: 0
              }
            : item
        )
      );
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Хатымды аяқтау мүмкін болмады");
    } finally {
      setCompletingSessionId(null);
    }
  }

  return (
    <main className="min-h-screen bg-figma-stage text-figma-blue">
      <AppHeader />

      {view === "new" ? (
        <section className="relative min-h-[calc(100svh-72px)] overflow-hidden bg-figma-stage lg:grid lg:min-h-[calc(100svh-111px)] lg:grid-cols-2">
          <img
            alt=""
            className="pointer-events-none absolute right-[-230px] top-[-80px] h-[560px] w-[560px] object-cover opacity-25 lg:hidden"
            src="/figma/quran-cover.png"
          />
          <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-figma-blue lg:block" />
          <div className="absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden lg:block">
            <img
              alt=""
              className="absolute -right-[90px] top-0 h-full w-[113%] max-w-none object-cover"
              src="/figma/quran-cover.png"
            />
          </div>

          <div className="relative z-10 flex min-h-[calc(100svh-72px)] items-center justify-center px-5 py-8 lg:min-h-[calc(100svh-111px)] lg:px-12 lg:py-12 xl:px-20">
            <form
              className="w-full max-w-[740px] rounded-[20px] bg-white p-7 shadow-[0_18px_60px_rgba(13,22,85,0.22)] sm:p-9 lg:rounded-[14px] lg:p-12 xl:p-[56px]"
              onSubmit={handleSubmit}
            >
              <h1 className="text-[28px] font-medium leading-[1.2] tracking-[0] text-black sm:text-[34px] lg:text-[38px]">
                Алдымен параметрлерді орнатыңыз:
              </h1>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:mt-9 lg:gap-x-7 lg:gap-y-7">
                <label className="grid gap-3">
                  <span className="pl-2 text-[18px] leading-[1.2] tracking-[0] text-black lg:text-[20px]">Бет саны</span>
                  <input
                    type="number"
                    min={MIN_PAGES_PER_USER}
                    max={MAX_PAGES_PER_USER}
                    value={pagesPerUser}
                    onChange={(event) => setPagesPerUser(Number(event.target.value))}
                    className="h-[54px] rounded-full border border-[#c0c0c0] px-5 text-[20px] tracking-[0] text-black outline-none focus:border-figma-blue lg:h-[58px]"
                    placeholder="1, 3, 5"
                    required
                  />
                </label>

                <label className="grid gap-3">
                  <span className="pl-2 text-[18px] leading-[1.2] tracking-[0] text-black lg:text-[20px]">Минут саны</span>
                  <input
                    type="number"
                    min={MIN_PAGE_TTL_MINUTES}
                    max={MAX_PAGE_TTL_MINUTES}
                    value={pageTtlMinutes}
                    onChange={(event) => setPageTtlMinutes(Number(event.target.value))}
                    className="h-[54px] rounded-full border border-[#c0c0c0] px-5 text-[20px] tracking-[0] text-black outline-none focus:border-figma-blue lg:h-[58px]"
                    placeholder="5, 7, 10"
                    required
                  />
                </label>

                <label className="grid gap-3 sm:col-span-2">
                  <span className="pl-2 text-[18px] leading-[1.2] tracking-[0] text-black lg:text-[20px]">Хатым ниеті:</span>
                  <input
                    type="text"
                    value={sessionIntent}
                    onChange={(event) => setSessionIntent(event.target.value)}
                    className="h-[54px] rounded-full border border-[#c0c0c0] px-5 text-[18px] tracking-[0] text-black outline-none focus:border-figma-blue placeholder:text-[#b5b5b5] lg:h-[58px]"
                    placeholder="ниетіңізді жазыңыз"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mx-auto mt-8 flex h-[64px] w-full max-w-[420px] items-center justify-center rounded-[24px] bg-figma-blue text-[24px] font-semibold tracking-[0] text-white transition hover:bg-[#2f3974] disabled:opacity-60 lg:mt-9 lg:h-[68px] lg:text-[30px]"
              >
                {submitting ? "Басталуда..." : "Жаңа хатым бастау"}
              </button>

              {error ? <div className="mt-4 text-center text-sm text-red-700">{error}</div> : null}
              {schemaWarning ? (
                <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {schemaWarning}
                </div>
              ) : null}
            </form>
          </div>
        </section>
      ) : null}

      {view === "list" ? (
        <section className="relative overflow-hidden bg-figma-stage px-5 py-10 sm:px-6 lg:min-h-[913px] lg:py-16">
        <img
          alt=""
          className="pointer-events-none absolute right-[-180px] top-[-160px] h-[520px] w-[520px] object-cover opacity-35 sm:right-[-120px] lg:right-0 lg:top-0 lg:h-[764px] lg:w-[764px] lg:opacity-60"
          src="/figma/quran-open.png"
        />

        <div className="relative z-10 mx-auto max-w-[1184px]">
          <div className="mb-5 flex items-center gap-4 text-white sm:gap-9">
            <span className="text-4xl leading-none sm:text-5xl">←</span>
            <h2 className="text-[22px] font-semibold uppercase leading-[1.1] tracking-[-0.66px] sm:text-[24px] sm:tracking-[-0.72px]">
              Құран хатым тізімі
            </h2>
          </div>

          <div className="mb-7 flex gap-3 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:gap-8 lg:gap-[45px]">
            {[
              ["all", "барлығы"],
              ["active", "белсенді"],
              ["completed", "аяқталды"]
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value as SessionFilter)}
                className={`h-[34px] min-w-[118px] rounded-full bg-white px-5 text-center text-[16px] sm:h-[30px] sm:w-[140px] sm:text-[18px] ${
                  filter === value
                    ? "border border-figma-blue font-semibold text-figma-blue"
                    : "font-normal text-figma-blue"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {completeError ? <div className="mb-4 text-sm font-semibold text-red-100">{completeError}</div> : null}

          <div className="grid gap-[10px]">
            {filteredSessions.map((session, index) => {
              const percent = Math.round((session.completedPages / TOTAL_PAGES) * 100);
              const isCompleted = !session.isActive || Boolean(session.completedAt);
              const status = getSessionStatus(session);
              const needsPrayer = isCompleted && percent >= 100;

              return (
                <div key={session.id} className="grid gap-3 lg:grid-cols-[1fr_300px] lg:gap-4">
                  <div className="rounded-[20px] bg-white p-4 text-[#0000b8] shadow-[0_8px_24px_rgba(9,15,74,0.08)] lg:flex lg:min-h-[73px] lg:items-center lg:px-4 lg:py-0">
                    <div className="flex items-start gap-3 lg:contents">
                      <BookIcon closed={isCompleted} />
                      <div className="min-w-0 flex-1 lg:ml-3">
                        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                          <Link
                            href={`/kiosk/${session.id}`}
                            className="text-[18px] font-medium leading-[1.2] tracking-[-0.54px] hover:underline sm:text-[20px] sm:tracking-[-0.6px]"
                          >
                            ҚҰРАН ХАТЫМ №{getSessionNumber(session, index)}
                          </Link>
                          {needsPrayer ? (
                            <span className="text-[13px] font-medium tracking-[-0.42px] text-red-600">
                              хатым дұғасын оқыңыз!
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 text-[12px] tracking-[-0.36px]">{formatCreatedAt(session.createdAt)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4 lg:ml-auto lg:mt-0 lg:justify-end">
                      <BookOutlineIcon />
                      <span className="min-w-[85px] text-[18px] font-medium tracking-[-0.54px] sm:min-w-[95px] sm:text-[20px] sm:tracking-[-0.6px]">
                        {status}
                      </span>
                      <button
                        type="button"
                        onClick={() => (isCompleted ? undefined : handleCompleteSession(session))}
                        disabled={isCompleted || completingSessionId === session.id}
                        className="disabled:cursor-default"
                        title={isCompleted ? "Аяқталған" : "Хатымды аяқтау"}
                      >
                        {isCompleted ? <CheckIcon /> : <ProgressBadge percent={Math.max(percent, 1)} />}
                      </button>
                    </div>
                  </div>

                  <Link
                    href={`/kiosk/${session.id}/participants`}
                    className="flex min-h-[64px] items-center rounded-[20px] bg-white px-5 text-[#0000b8] shadow-[0_8px_24px_rgba(9,15,74,0.08)] transition hover:-translate-y-0.5 lg:min-h-[73px] lg:px-7"
                  >
                    <UserIcon />
                    <span className="ml-4 text-[16px] tracking-[-0.48px] sm:text-[18px] sm:tracking-[-0.54px]">
                      қатысушылар тізімі
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>

          {!filteredSessions.length ? (
            <div className="mt-10 max-w-[540px] rounded-[20px] bg-white px-8 py-6 text-center text-figma-blue">
              Бұл бөлімде әзірге хатым жоқ.
            </div>
          ) : null}
        </div>
        </section>
      ) : null}
    </main>
  );
}
