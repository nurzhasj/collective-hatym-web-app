"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_PAGE_TTL_MINUTES } from "@/lib/constants";
import { getClaimToken, getOrCreateUserId, clearClaimToken } from "@/lib/browserStorage";
import { resolveMushafUrls } from "@/lib/mushaf";
import MushafPageRenderer from "@/components/MushafPageRenderer";
import QPCPageRenderer, { isQPCData } from "@/components/QPCPageRenderer";

type CompleteResponse = {
  status: string | null;
  completed_count: number | null;
  finished: boolean | null;
};

type LiveAssignmentRow = {
  assigned_to: string | null;
  assigned_at: string | null;
  status: string | null;
  claim_token: string | null;
  last_expired_to: string | null;
  last_expired_at: string | null;
};

type Props = {
  sessionId: string;
  pageNumber: number;
};

const COPY = {
  mushafPage: "Мұсхаф беті",
  loading: "Бет жүктелуде…",
  loadError: "Мұсхаф бетін жүктеу мүмкін болмады.",
  invalidUrl:
    "Бұл бет үшін мушаф JSON URL табылмады. NEXT_PUBLIC_MUSHAF_JSON_BASE_URL немесе NEXT_PUBLIC_MUSHAF_JSON_URL_TEMPLATE орнатыңыз.",
  fetchError: "Мұсхаф JSON жүктеу мүмкін болмады.",
  notAssigned: "Бұл бет қазір сізге тағайындалмаған. Беттер тізіміне қайтыңыз.",
  notAssignedTitle: "Бет тағайындалмаған.",
  assignmentChecking: "Тағайындау тексерілуде...",
  timeLimit: "Бір бетке берілген уақыт",
  timeRemaining: "Қалған уақыт",
  timeExpiredTitle: "Уақыт аяқталды.",
  timeExpiredHint: "Бұл бет қайтадан босатылды. Беттер тізіміне оралып, қолжетімді беттерді көріңіз.",
  completedTitle: "Аяқталды.",
  completedHint: "Осы сессиядағы қалған беттерді ашу үшін артқа қайтыңыз.",
  back: "Артқа",
  readMore: "Тағы оқу",
  markCompleted: "Аяқталды деп белгілеу",
  completing: "Белгіленуде...",
  completeError: "Бұл бетті аяқтау мүмкін болмады. Тағайындау мерзімі өтіп кеткен болуы мүмкін."
};

export default function ReaderClient({ sessionId, pageNumber }: Props) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [mushafData, setMushafData] = useState<unknown | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "completed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showBar, setShowBar] = useState(true);
  const [assignmentStatus, setAssignmentStatus] = useState<"checking" | "valid" | "expired" | "invalid">("checking");
  const [assignedAt, setAssignedAt] = useState<string | null>(null);
  const [pageTtlMinutes, setPageTtlMinutes] = useState(DEFAULT_PAGE_TTL_MINUTES);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const t = COPY;

  useEffect(() => {
    setUserId(getOrCreateUserId());
    setClaimToken(getClaimToken(sessionId, pageNumber));
  }, [sessionId, pageNumber]);

  useEffect(() => {
    let isMounted = true;

    async function loadSessionSettings() {
      const { data } = await supabase
        .from("hatym_sessions")
        .select("page_ttl_minutes")
        .eq("id", sessionId)
        .maybeSingle();

      if (!isMounted) return;
      const nextTtl = typeof data?.page_ttl_minutes === "number" ? data.page_ttl_minutes : DEFAULT_PAGE_TTL_MINUTES;
      setPageTtlMinutes(Math.max(1, nextTtl));
    }

    loadSessionSettings();

    return () => {
      isMounted = false;
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setStatus("loading");
      setError(null);
      setMushafData(null);

      const { data, error: pageError } = await supabase
        .from("quran_pages")
        .select("page_number,mushaf_url")
        .eq("page_number", pageNumber)
        .single();

      if (!isMounted) return;
      if (pageError || !data) {
        setError(pageError?.message || t.loadError);
        setStatus("error");
        return;
      }

      const resolvedUrls = resolveMushafUrls(data.mushaf_url, pageNumber);
      if (!resolvedUrls.length) {
        setError(t.invalidUrl);
        setStatus("error");
        return;
      }

      let lastHttpStatus: number | null = null;
      let lastFailedUrl: string | null = null;
      let parseErrorSeen = false;

      for (const url of resolvedUrls) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) {
            lastHttpStatus = response.status;
            lastFailedUrl = url;
            continue;
          }

          const json = (await response.json()) as unknown;
          if (!isMounted) return;
          setMushafData(json);
          setStatus("ready");
          return;
        } catch {
          parseErrorSeen = true;
        }
      }

      if (!isMounted) return;
      if (lastHttpStatus) {
        const suffix = lastFailedUrl ? `\nURL: ${lastFailedUrl}` : "";
        setError(`${t.fetchError} (HTTP ${lastHttpStatus})${suffix}`);
      } else if (parseErrorSeen) {
        setError(`${t.fetchError} (JSON parse error)`);
      } else {
        setError(t.fetchError);
      }
      setStatus("error");
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [pageNumber, supabase]);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function syncLiveClaimToken() {
      await supabase.rpc("release_expired_assignments", {
        p_session_id: sessionId
      });

      const { data, error: tokenError } = await supabase
        .from("hatym_pages")
        .select("assigned_to,assigned_at,status,claim_token,last_expired_to,last_expired_at")
        .eq("session_id", sessionId)
        .eq("page_number", pageNumber)
        .maybeSingle();

      if (!isMounted || tokenError) return;
      const row = (data ?? null) as LiveAssignmentRow | null;
      if (row?.status === "assigned" && row.assigned_to === userId && row.claim_token) {
        setAssignmentStatus("valid");
        setAssignedAt(row.assigned_at);
        setClaimToken(row.claim_token);
        return;
      }

      if (row?.last_expired_to === userId) {
        setAssignmentStatus("expired");
        setAssignedAt(null);
        setClaimToken(null);
        return;
      }

      setAssignmentStatus("invalid");
      setAssignedAt(null);
      setClaimToken(null);
    }

    syncLiveClaimToken();
    const refreshTimer = window.setInterval(syncLiveClaimToken, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [pageNumber, sessionId, supabase, userId]);

  const remainingMs = useMemo(() => {
    if (!assignedAt) return null;
    const assignedAtMs = new Date(assignedAt).getTime();
    if (Number.isNaN(assignedAtMs)) return null;
    return Math.max(0, assignedAtMs + pageTtlMinutes * 60 * 1000 - nowMs);
  }, [assignedAt, nowMs, pageTtlMinutes]);

  const canComplete = useMemo(() => {
    const hasTimeRemaining = remainingMs === null || remainingMs > 0;
    return Boolean(
      claimToken &&
        userId &&
        status === "ready" &&
        !isCompleting &&
        assignmentStatus === "valid" &&
        hasTimeRemaining
    );
  }, [assignmentStatus, claimToken, isCompleting, remainingMs, status, userId]);

  function formatRemaining(ms: number) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function handleComplete() {
    if (!canComplete) return;
    setIsCompleting(true);
    setError(null);

    const { data: claimData, error: claimError } = await supabase
      .from("hatym_pages")
      .select("assigned_to,assigned_at,status,claim_token,last_expired_to,last_expired_at")
      .eq("session_id", sessionId)
      .eq("page_number", pageNumber)
      .maybeSingle();

    if (claimError) {
      setError(claimError.message);
      setIsCompleting(false);
      return;
    }

    const claimRow = (claimData ?? null) as LiveAssignmentRow | null;
    if (!claimRow || claimRow.status !== "assigned" || claimRow.assigned_to !== userId || !claimRow.claim_token) {
      setClaimToken(null);
      setAssignmentStatus(claimRow?.last_expired_to === userId ? "expired" : "invalid");
      setError(t.notAssigned);
      setIsCompleting(false);
      return;
    }

    setClaimToken(claimRow.claim_token);
    setAssignedAt(claimRow.assigned_at);
    setAssignmentStatus("valid");

    const { data, error: completeError } = await supabase.rpc("complete_page", {
      p_session_id: sessionId,
      p_page_number: pageNumber,
      p_user_id: userId,
      p_claim_token: claimRow.claim_token
    });

    if (completeError) {
      setError(completeError.message);
      setIsCompleting(false);
      return;
    }

    const row = (data?.[0] ?? null) as CompleteResponse | null;
    if (!row || row.status !== "completed") {
      setError(t.completeError);
      setIsCompleting(false);
      return;
    }

    clearClaimToken(sessionId, pageNumber);
    setAssignmentStatus("invalid");
    setStatus("completed");
    setIsCompleting(false);
  }

  function handleBack() {
    router.push(`/s/${sessionId}/claim`);
  }

  function handleReadMore() {
    router.push(`/s/${sessionId}/claim?auto=1`);
  }

  if (status === "completed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-figma-stage px-6 text-center text-white">
        <div className="rounded-[20px] bg-white px-6 py-8 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
          <div className="text-2xl font-semibold">{t.completedTitle}</div>
          <div className="mt-2 text-sm text-figma-blue/70">{t.completedHint}</div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={handleBack}
            className="h-11 rounded-full bg-white px-6 text-sm font-semibold uppercase tracking-wide text-figma-blue"
          >
            {t.back}
          </button>
          <button
            onClick={handleReadMore}
            className="h-11 rounded-full bg-white px-6 text-sm font-semibold uppercase tracking-wide text-figma-blue"
          >
            {t.readMore}
          </button>
        </div>
      </div>
    );
  }

  if (assignmentStatus === "expired" || assignmentStatus === "invalid") {
    const isExpired = assignmentStatus === "expired";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-figma-stage px-6 text-center text-white">
        <div className="rounded-[20px] bg-white px-6 py-8 text-figma-blue shadow-[0_18px_60px_rgba(13,22,85,0.22)]">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-figma-blue/50">
            {t.mushafPage} {pageNumber}
          </div>
          <div className="mt-3 text-2xl font-semibold">
            {isExpired ? t.timeExpiredTitle : t.notAssignedTitle}
          </div>
          <div className="mt-3 max-w-sm text-sm text-figma-blue/70">
            {isExpired ? t.timeExpiredHint : t.notAssigned}
          </div>
        </div>
        <button
          onClick={handleBack}
          className="h-11 rounded-full bg-white px-6 text-sm font-semibold uppercase tracking-wide text-figma-blue"
        >
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh min-w-0 flex-col bg-white text-figma-blue">
      {/* Page number header */}
      <div className="shrink-0 pb-1 pt-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-figma-blue/50">
          {t.mushafPage}
        </div>
        <div className="text-2xl font-semibold">{pageNumber}</div>
        <div className="mt-1 text-xs font-medium text-figma-blue/50">
          {t.timeLimit}: {pageTtlMinutes} мин
        </div>
      </div>

      {/* Loading state */}
      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center text-sm text-figma-blue/70">
          {t.loading}
        </div>
      ) : null}

      {/* Error state */}
      {status === "error" ? (
        <div className="mx-4 my-3 rounded-2xl border border-red-500/40 bg-red-50 p-5 text-sm text-red-700">
          {error ?? t.loadError}
        </div>
      ) : null}

      {/* Mushaf — fills 100% of remaining space; tap toggles footer */}
      {status === "ready" && mushafData ? (
        <div
          className="relative min-h-0 min-w-0 flex-1 basis-0 overflow-visible px-4"
          onClick={() => setShowBar((v) => !v)}
        >
          {isQPCData(mushafData) ? (
            <QPCPageRenderer data={mushafData} className="h-full w-full" />
          ) : (
            <MushafPageRenderer data={mushafData} className="h-full w-full font-serif" />
          )}
        </div>
      ) : null}

      {/* Bottom action bar — fixed overlay, slides in/out on tap */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-figma-blue/10 bg-white/95 px-4 pt-4 shadow-[0_-12px_40px_rgba(13,22,85,0.12)] backdrop-blur"
        style={{
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
          transform: showBar ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s ease-in-out",
        }}
      >
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-xs font-medium text-figma-blue/60">
            <span>
              {t.timeLimit}: {pageTtlMinutes} мин
            </span>
            {assignmentStatus === "checking" ? <span>{t.assignmentChecking}</span> : null}
            {remainingMs !== null && assignmentStatus === "valid" ? (
              <span>
                {t.timeRemaining}: {formatRemaining(remainingMs)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex-1 rounded-full border border-figma-blue px-4 py-3 text-xs font-semibold uppercase tracking-wide text-figma-blue"
            >
              {t.back}
            </button>
            <button
              onClick={handleComplete}
              disabled={!canComplete}
              className="flex-[1.4] rounded-full bg-figma-blue px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {isCompleting ? t.completing : t.markCompleted}
            </button>
          </div>
          {status !== "error" && error ? (
            <div className="mt-2 text-center text-xs text-red-700">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
