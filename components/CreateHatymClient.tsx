"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  DEFAULT_PAGE_TTL_MINUTES,
  DEFAULT_PAGES_PER_USER,
  MAX_PAGE_TTL_MINUTES,
  MAX_PAGES_PER_USER,
  MIN_PAGE_TTL_MINUTES,
  MIN_PAGES_PER_USER
} from "@/lib/constants";
import type { SessionSettings } from "@/lib/sessionSettings";

type ActiveSession = {
  id: string;
  createdAt: string;
  settings: SessionSettings;
};

type Props = {
  activeSession: ActiveSession | null;
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatMinutes(value: number | null) {
  if (value === null) return "Өшірулі";
  if (value % 60 === 0) {
    return `${value / 60} сағат`;
  }
  return `${value} минут`;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Almaty",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);

    const getPart = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";

    const day = getPart("day");
    const month = getPart("month");
    const year = getPart("year");
    const hour = getPart("hour");
    const minute = getPart("minute");
    const second = getPart("second");

    return `${day}.${month}.${year}, ${hour}:${minute}:${second}`;
  } catch {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    const second = String(date.getUTCSeconds()).padStart(2, "0");
    return `${day}.${month}.${year}, ${hour}:${minute}:${second} UTC`;
  }
}

export default function CreateHatymClient({ activeSession }: Props) {
  const [currentActiveSession, setCurrentActiveSession] = useState<ActiveSession | null>(activeSession);
  const [pagesPerUser, setPagesPerUser] = useState(DEFAULT_PAGES_PER_USER);
  const [pageTtlMinutes, setPageTtlMinutes] = useState(DEFAULT_PAGE_TTL_MINUTES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completingCurrent, setCompletingCurrent] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      pagesPerUser: clampInt(pagesPerUser, MIN_PAGES_PER_USER, MAX_PAGES_PER_USER),
      pageTtlMinutes: clampInt(pageTtlMinutes, MIN_PAGE_TTL_MINUTES, MAX_PAGE_TTL_MINUTES)
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

  async function handleCompleteCurrentSession() {
    if (!currentActiveSession || completingCurrent) return;

    const approved = window.confirm(
      "Ағымдағы хатымды толық аяқталған деп белгілеймін бе? Барлық беттер аяқталған болып белгіленеді."
    );
    if (!approved) return;

    setCompletingCurrent(true);
    setCompleteError(null);

    try {
      const response = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentActiveSession.id })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "Ағымдағы хатымды аяқтау мүмкін болмады");
      }

      setCurrentActiveSession(null);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Ағымдағы хатымды аяқтау мүмкін болмады");
    } finally {
      setCompletingCurrent(false);
    }
  }

  return (
    <main className="min-h-screen bg-hatym-cream px-4 py-10 text-hatym-ink sm:px-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm uppercase tracking-[0.3em] text-hatym-ink/60">Hatym Kiosk</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Жаңа хатым бастау</h1>
          <p className="mt-2 text-sm text-hatym-ink/70">
            Алдымен параметрлерді орнатыңыз, содан кейін киоск беті ашылады.
          </p>

          <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
            <label className="grid gap-2">
              <span className="text-sm font-medium">Бір қолданушыға берілетін бет саны</span>
              <input
                type="number"
                min={MIN_PAGES_PER_USER}
                max={MAX_PAGES_PER_USER}
                value={pagesPerUser}
                onChange={(event) => setPagesPerUser(Number(event.target.value))}
                className="h-12 rounded-2xl border border-black/15 px-4 text-base outline-none ring-hatym-ink/30 focus:ring"
                required
              />
              <span className="text-xs text-hatym-ink/60">Мысалы: 1, 3, 5</span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">Бір бетке берілетін минут саны</span>
              <input
                type="number"
                min={MIN_PAGE_TTL_MINUTES}
                max={MAX_PAGE_TTL_MINUTES}
                value={pageTtlMinutes}
                onChange={(event) => setPageTtlMinutes(Number(event.target.value))}
                className="h-12 rounded-2xl border border-black/15 px-4 text-base outline-none ring-hatym-ink/30 focus:ring"
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-hatym-ink px-6 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
            >
              {submitting ? "Басталуда..." : "Киоскты ашу"}
            </button>
            {error ? <div className="text-sm text-red-700">{error}</div> : null}
          </form>
        </section>

        {currentActiveSession ? (
          <section className="rounded-3xl border border-amber-300/60 bg-amber-50 p-6 sm:p-8">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-800/70">Белсенді сессия</div>
            <div className="mt-2 text-lg font-semibold text-amber-950">Ағымдағы хатым ашық тұр</div>
            <div className="mt-3 grid gap-1 text-sm text-amber-900/80">
              <div>Бет лимиті: {currentActiveSession.settings.pagesPerUser}</div>
              <div>Бет TTL: {formatMinutes(currentActiveSession.settings.pageTtlMinutes)}</div>
              <div>
                Ашылған уақыты: {formatCreatedAt(currentActiveSession.createdAt)}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/kiosk/${currentActiveSession.id}`}
                className="inline-flex rounded-full border border-amber-900/30 bg-white px-5 py-2 text-sm font-semibold uppercase tracking-wide text-amber-950"
              >
                Ағымдағы хатымды ашу
              </Link>
              <button
                type="button"
                onClick={handleCompleteCurrentSession}
                disabled={completingCurrent}
                className="inline-flex rounded-full bg-amber-900 px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
              >
                {completingCurrent ? "Аяқталуда..." : "Хатымды аяқтау"}
              </button>
            </div>
            {completeError ? <div className="mt-3 text-sm text-red-700">{completeError}</div> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
