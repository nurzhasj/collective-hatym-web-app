"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import DayimLogo from "@/components/DayimLogo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_PAGE_TTL_MINUTES, DEFAULT_PAGES_PER_USER } from "@/lib/constants";
import {
  clearClaimToken,
  getOrCreateUserId,
  getStoredParticipantProfile,
  storeClaimToken,
  storeParticipantProfile
} from "@/lib/browserStorage";
import { mapSessionRowToSettings, type SessionSettings } from "@/lib/sessionSettings";

type ClaimResponse = {
  page_number: number | null;
  mushaf_url: string | null;
  claim_token: string | null;
  status: string | null;
};

type ClaimedPage = {
  pageNumber: number;
  claimToken: string | null;
  status: "assigned" | "completed";
};

type Props = {
  sessionId: string;
  autoClaim?: boolean;
};

const COPY = {
  yourPages: "Сіздің беттеріңіз",
  pageStatusAssigned: "Тағайындалған",
  pageStatusCompleted: "Аяқталды",
  openMushaf: "Мұсхафты ашу",
  checkingSession: "Сессия тексерілуде...",
  claiming: "Беттеріңіз дайындалуда...",
  hatymDone: "Хатым аяқталған.",
  scanNewSession: "Жаңа сессия үшін киоск QR-кодын сканерлеңіз.",
  noPages: "Әзірге оқылған беттер жоқ.",
  tryAgain: "Қайта көріңіз",
  profileTitle: "Хатымға қатысу",
  profileHint: "Бет берілмес бұрын есіміңізді енгізіңіз.",
  readerName: "Есіміңіз",
  readerNamePlaceholder: "Мысалы: Асылбек",
  deceasedName: "Өмірден озған жақыныңыздың есімі",
  deceasedNamePlaceholder: "Мысалы: Айша апа",
  deceasedOptional: "Міндетті емес. Имам хатым дұғасында осы есімді атай алады.",
  pageTime: "Бір бетке берілетін уақыт",
  startClaim: "Беттерді алу",
  readMore: "Тағы оқу",
  nameRequired: "Есіміңізді енгізіңіз."
};

function ClaimShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-figma-stage px-5 py-6 text-white">
      <img
        alt=""
        className="pointer-events-none absolute right-[-230px] top-[-140px] h-[560px] w-[560px] object-cover opacity-30"
        src="/figma/quran-open.png"
      />
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-md flex-col">
        <DayimLogo tone="white" />
        {children}
      </div>
    </main>
  );
}

function StatusCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <ClaimShell>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="w-full rounded-[20px] bg-white px-6 py-8 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.78px]">{title}</h1>
          {subtitle ? <p className="mt-3 text-[14px] font-medium leading-relaxed text-figma-blue/65">{subtitle}</p> : null}
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </div>
    </ClaimShell>
  );
}

export default function ClaimClient({ sessionId, autoClaim = false }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState("");
  const [pages, setPages] = useState<ClaimedPage[]>([]);
  const [status, setStatus] = useState<"checking" | "profile" | "loading" | "assigned" | "finished" | "error">("checking");
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileSubmitted, setProfileSubmitted] = useState(false);
  const [readerName, setReaderName] = useState("");
  const [deceasedName, setDeceasedName] = useState("");
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    pagesPerUser: DEFAULT_PAGES_PER_USER,
    pageTtlMinutes: DEFAULT_PAGE_TTL_MINUTES,
    autoCompleteAfterMinutes: null
  });
  const t = COPY;

  useEffect(() => {
    const id = getOrCreateUserId();
    const profile = getStoredParticipantProfile(sessionId);
    setUserId(id);
    setReaderName(profile.readerName);
    setDeceasedName(profile.deceasedName);
    setProfileSubmitted(autoClaim && Boolean(profile.readerName.trim()));
  }, [autoClaim, sessionId]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      setStatus("checking");
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase
        .from("hatym_sessions")
        .select("is_active,pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
        .eq("id", sessionId)
        .maybeSingle();

      if (!isMounted) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus("error");
        return;
      }
      if (!sessionData || sessionData.is_active !== true) {
        setStatus("finished");
        return;
      }

      const resolvedSettings = mapSessionRowToSettings(sessionData);
      setSessionSettings(resolvedSettings);
      setSessionReady(true);
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    if (status === "checking" && sessionReady && !profileSubmitted && !readerName.trim()) {
      setStatus("profile");
    }
  }, [profileSubmitted, readerName, sessionReady, status]);

  useEffect(() => {
    if (!userId || !sessionReady || autoClaim || profileSubmitted || !readerName.trim()) return;
    let isMounted = true;

    async function loadUserPages() {
      setStatus("loading");
      setError(null);

      await supabase.rpc("release_expired_assignments", {
        p_session_id: sessionId
      });

      const { data, error: pagesError } = await supabase
        .from("hatym_pages")
        .select("page_number,status,claim_token")
        .eq("session_id", sessionId)
        .eq("assigned_to", userId)
        .in("status", ["assigned", "completed"])
        .order("page_number", { ascending: true });

      if (!isMounted) return;
      if (pagesError) {
        setError(pagesError.message);
        setStatus("error");
        return;
      }

      const nextPages = (data ?? [])
        .filter((row) => row.status === "assigned" || row.status === "completed")
        .map((row) => ({
          pageNumber: row.page_number,
          claimToken: row.status === "assigned" ? row.claim_token ?? null : null,
          status: row.status as "assigned" | "completed"
        }));

      for (const page of nextPages) {
        if (page.claimToken) {
          storeClaimToken(sessionId, page.pageNumber, page.claimToken);
        } else {
          clearClaimToken(sessionId, page.pageNumber);
        }
      }

      setPages(nextPages);
      setStatus("assigned");
    }

    loadUserPages();

    return () => {
      isMounted = false;
    };
  }, [autoClaim, profileSubmitted, readerName, sessionId, sessionReady, supabase, userId]);

  useEffect(() => {
    if (!userId || !sessionReady || !profileSubmitted) return;
    let isMounted = true;

    async function claimPages() {
      setStatus("loading");
      setError(null);

      const cleanReaderName = readerName.trim();
      const cleanDeceasedName = deceasedName.trim();
      if (!cleanReaderName) {
        setError(t.nameRequired);
        setStatus("profile");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("hatym_sessions")
        .select("is_active,pages_per_user,page_ttl_minutes,auto_complete_after_minutes")
        .eq("id", sessionId)
        .maybeSingle();

      if (!isMounted) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus("error");
        return;
      }
      if (!sessionData || sessionData.is_active !== true) {
        setStatus("finished");
        return;
      }

      const resolvedSettings = mapSessionRowToSettings(sessionData);
      setSessionSettings(resolvedSettings);

      const { data, error: claimError } = await supabase.rpc("claim_next_page", {
        p_session_id: sessionId,
        p_user_id: userId,
        p_reader_name: cleanReaderName,
        p_deceased_name: cleanDeceasedName || null
      });

      if (!isMounted) return;
      if (claimError) {
        setError(claimError.message);
        setStatus("error");
        return;
      }

      const rows = (data ?? []) as ClaimResponse[];
      const hasFinishedRow = rows.some((row) => row.status === "finished");
      const hasNameRequiredRow = rows.some((row) => row.status === "name_required");

      if (hasNameRequiredRow) {
        setError(t.nameRequired);
        setStatus("profile");
        return;
      }

      const nextPages: ClaimedPage[] = [];
      const seen = new Set<number>();
      for (const row of rows) {
        if (typeof row.page_number !== "number" || seen.has(row.page_number)) continue;
        seen.add(row.page_number);

        const pageStatus = row.status === "completed" ? "completed" : "assigned";
        nextPages.push({
          pageNumber: row.page_number,
          claimToken: pageStatus === "assigned" ? row.claim_token ?? null : null,
          status: pageStatus
        });
      }

      for (const page of nextPages) {
        if (page.claimToken) {
          storeClaimToken(sessionId, page.pageNumber, page.claimToken);
        } else {
          clearClaimToken(sessionId, page.pageNumber);
        }
      }

      if (nextPages.length > 0) {
        setPages(nextPages);
        setStatus("assigned");
        return;
      }

      if (hasFinishedRow) {
        setStatus("finished");
        return;
      }

      setError("Сұраныс нәтижесі түсініксіз.");
      setStatus("error");
    }

    claimPages();

    return () => {
      isMounted = false;
    };
  }, [deceasedName, profileSubmitted, readerName, sessionId, sessionReady, supabase, t.nameRequired, userId]);

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanReaderName = readerName.trim();
    const cleanDeceasedName = deceasedName.trim();

    if (!cleanReaderName) {
      setError(t.nameRequired);
      return;
    }

    setReaderName(cleanReaderName);
    setDeceasedName(cleanDeceasedName);
    storeParticipantProfile(sessionId, {
      readerName: cleanReaderName,
      deceasedName: cleanDeceasedName
    });
    setProfileSubmitted(true);
  }

  if (status === "checking") {
    return <StatusCard title={t.checkingSession} />;
  }

  if (status === "profile") {
    return (
      <ClaimShell>
        <div className="flex flex-1 flex-col justify-center py-8">
          <form
            className="rounded-[20px] bg-white p-5 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]"
            onSubmit={handleProfileSubmit}
          >
            <div className="mb-6">
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-figma-blue/55">
                {t.pageTime}: {sessionSettings.pageTtlMinutes} мин
              </div>
              <h1 className="mt-3 text-[30px] font-semibold leading-[1.08] tracking-[-0.9px]">{t.profileTitle}</h1>
              <p className="mt-2 text-[14px] font-medium leading-relaxed text-figma-blue/65">{t.profileHint}</p>
            </div>

            <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium">{t.readerName}</span>
              <input
                type="text"
                value={readerName}
                onChange={(event) => setReaderName(event.target.value)}
                placeholder={t.readerNamePlaceholder}
                className="h-12 rounded-full border border-[#c0c0c0] px-4 text-base text-black outline-none ring-figma-blue/20 focus:border-figma-blue focus:ring"
                autoComplete="name"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium">{t.deceasedName}</span>
              <input
                type="text"
                value={deceasedName}
                onChange={(event) => setDeceasedName(event.target.value)}
                placeholder={t.deceasedNamePlaceholder}
                className="h-12 rounded-full border border-[#c0c0c0] px-4 text-base text-black outline-none ring-figma-blue/20 focus:border-figma-blue focus:ring"
              />
              <span className="text-xs leading-relaxed text-figma-blue/55">{t.deceasedOptional}</span>
            </label>

            <button
              type="submit"
              className="mt-2 h-12 rounded-full bg-figma-blue px-5 text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90"
            >
              {t.startClaim}
            </button>
            {error ? <div className="text-sm text-red-700">{error}</div> : null}
            </div>
          </form>
        </div>
      </ClaimShell>
    );
  }

  if (status === "loading") {
    return <StatusCard title={t.claiming} />;
  }

  if (status === "finished") {
    return <StatusCard title={t.hatymDone} subtitle={t.scanNewSession} />;
  }

  if (status === "error") {
    return (
      <StatusCard title={error ?? "Қате орын алды."}>
        <button
          className="h-11 rounded-full border border-figma-blue px-6 text-sm font-semibold uppercase tracking-wide text-figma-blue"
          onClick={() => window.location.reload()}
        >
          {t.tryAgain}
        </button>
      </StatusCard>
    );
  }

  return (
    <ClaimShell>
      <div className="flex flex-1 flex-col justify-center gap-6 py-8 text-center">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
          {t.yourPages} ({pages.length} бет)
        </div>

        <div className="w-full space-y-3">
          {pages.length ? (
            pages.map((page) => (
              <div key={page.pageNumber} className="rounded-[20px] bg-white px-5 py-5 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
                <div className="text-[52px] font-semibold leading-none tracking-[-1.56px]">{page.pageNumber}</div>
                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-figma-blue/55">
                  {page.status === "completed" ? t.pageStatusCompleted : t.pageStatusAssigned}
                </div>
                <div className="mt-2 text-xs font-medium text-figma-blue/60">
                  {t.pageTime}: {sessionSettings.pageTtlMinutes} мин
                </div>
                <Link
                  href={page.status === "assigned" && page.claimToken ? `/read/${sessionId}/${page.pageNumber}` : "#"}
                  className={`mt-5 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold uppercase tracking-wide ${
                    page.status === "assigned" && page.claimToken
                      ? "bg-figma-blue text-white"
                      : "pointer-events-none border border-figma-blue/30 text-figma-blue/50"
                  }`}
                >
                  {t.openMushaf}
                </Link>
              </div>
            ))
          ) : (
            <div className="rounded-[20px] bg-white px-5 py-8 text-sm font-medium text-figma-blue/65 shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
              {t.noPages}
            </div>
          )}
        </div>

        <Link
          href={`/s/${sessionId}/claim?auto=1`}
          className="mx-auto inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-semibold uppercase tracking-wide text-figma-blue shadow-[0_10px_30px_rgba(13,22,85,0.16)]"
        >
          {t.readMore}
        </Link>

        <div className="text-xs font-medium leading-relaxed text-white/65">
          {`Алғашқыда ${sessionSettings.pagesPerUser} бет беріледі. Оларды аяқтаған соң QR-ды қайта сканерлеп немесе "${t.readMore}" батырмасын басып, келесі бос бетті бір-бірден ала аласыз.`}
        </div>
      </div>
    </ClaimShell>
  );
}
