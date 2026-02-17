"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getClaimToken, getOrCreateUserId, clearClaimToken } from "@/lib/browserStorage";
import { resolveMushafUrl } from "@/lib/mushaf";
import MushafPageRenderer from "@/components/MushafPageRenderer";
import MushafImageRenderer from "@/components/MushafImageRenderer";

type CompleteResponse = {
  status: string | null;
  completed_count: number | null;
  finished: boolean | null;
};

type LiveAssignmentRow = {
  assigned_to: string | null;
  status: string | null;
  claim_token: string | null;
};

type Props = {
  sessionId: string;
  pageNumber: number;
};

type MushafContent =
  | {
      kind: "image";
      src: string;
    }
  | {
      kind: "json";
      data: unknown;
    };

const COPY = {
  mushafPage: "Мұсхаф беті",
  loading: "Бет жүктелуде…",
  loadError: "Мұсхаф бетін жүктеу мүмкін болмады.",
  invalidUrl: "Бұл бет үшін мұсхаф URL дұрыс емес.",
  unsupported: "Бұл бет үшін көрсету форматының қолдауы жоқ.",
  fetchError: "Мұсхаф JSON жүктеу мүмкін болмады.",
  notAssigned: "Бұл бет қазір сізге тағайындалмаған. Беттер тізіміне қайтыңыз.",
  completedTitle: "Аяқталды.",
  completedHint: "Осы сессиядағы қалған беттерді ашу үшін артқа қайтыңыз.",
  back: "Артқа",
  markCompleted: "Аяқталды деп белгілеу",
  completing: "Белгіленуде...",
  completeError: "Бұл бетті аяқтау мүмкін болмады. Тағайындау мерзімі өтіп кеткен болуы мүмкін."
};

export default function ReaderClient({ sessionId, pageNumber }: Props) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [mushafContent, setMushafContent] = useState<MushafContent | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "completed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const t = COPY;

  useEffect(() => {
    setUserId(getOrCreateUserId());
    setClaimToken(getClaimToken(sessionId, pageNumber));
  }, [sessionId, pageNumber]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setStatus("loading");
      setError(null);
      setMushafContent(null);

      const { data, error: pageError } = await supabase
        .from("quran_pages")
        .select("page_number,mushaf_url,render_type")
        .eq("page_number", pageNumber)
        .single();

      if (!isMounted) return;
      if (pageError || !data) {
        setError(pageError?.message || t.loadError);
        setStatus("error");
        return;
      }

      const renderTypeRaw = typeof data.render_type === "string" ? data.render_type.trim().toLowerCase() : "";
      const renderType = renderTypeRaw || "image";

      if (renderType !== "image" && renderType !== "json") {
        setError(t.unsupported);
        setStatus("error");
        return;
      }

      const resolvedUrl = resolveMushafUrl(data.mushaf_url);
      if (!resolvedUrl) {
        setError(t.invalidUrl);
        setStatus("error");
        return;
      }

      if (renderType === "image") {
        setMushafContent({ kind: "image", src: resolvedUrl });
        setStatus("ready");
        return;
      }

      try {
        const response = await fetch(resolvedUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${t.fetchError} (HTTP ${response.status})`);
        }
        const json = (await response.json()) as unknown;
        if (!isMounted) return;
        setMushafContent({ kind: "json", data: json });
        setStatus("ready");
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : t.fetchError);
        setStatus("error");
      }
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
      const { data, error: tokenError } = await supabase
        .from("hatym_pages")
        .select("assigned_to,status,claim_token")
        .eq("session_id", sessionId)
        .eq("page_number", pageNumber)
        .maybeSingle();

      if (!isMounted || tokenError) return;
      const row = (data ?? null) as LiveAssignmentRow | null;
      if (!row || row.status !== "assigned" || row.assigned_to !== userId || !row.claim_token) {
        setClaimToken(null);
        return;
      }
      setClaimToken(row.claim_token);
    }

    syncLiveClaimToken();

    return () => {
      isMounted = false;
    };
  }, [pageNumber, sessionId, supabase, userId]);

  const canComplete = useMemo(() => {
    return Boolean(claimToken && userId && status === "ready" && !isCompleting);
  }, [claimToken, userId, status, isCompleting]);

  async function handleComplete() {
    if (!canComplete) return;
    setIsCompleting(true);
    setError(null);

    const { data: claimData, error: claimError } = await supabase
      .from("hatym_pages")
      .select("assigned_to,status,claim_token")
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
      setError(t.notAssigned);
      setIsCompleting(false);
      return;
    }

    setClaimToken(claimRow.claim_token);

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
    setStatus("completed");
    setIsCompleting(false);
  }

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(`/s/${sessionId}/claim`);
  }

  if (status === "completed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-6 text-center text-hatym-ink dark:bg-slate-950 dark:text-slate-100">
        <div className="text-2xl font-semibold">{t.completedTitle}</div>
        <div className="text-sm text-hatym-ink/70 dark:text-slate-300">{t.completedHint}</div>
        <button
          onClick={handleBack}
          className="rounded-full border border-hatym-ink px-6 py-2 text-sm uppercase tracking-wide dark:border-white"
        >
          {t.back}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-hatym-ink dark:bg-slate-950 dark:text-slate-100">
      <div className="px-5 pb-28 pt-8">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-hatym-ink/50 dark:text-slate-400">
              {t.mushafPage}
            </div>
            <div className="text-3xl font-semibold">{pageNumber}</div>
          </div>

          {status === "loading" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-center text-sm text-hatym-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              {t.loading}
            </div>
          ) : null}

          {status === "error" ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-50 p-5 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
              {error ?? t.loadError}
            </div>
          ) : null}

          {status === "ready" && mushafContent?.kind === "image" ? (
            <MushafImageRenderer src={mushafContent.src} pageNumber={pageNumber} />
          ) : null}

          {status === "ready" && mushafContent?.kind === "json" ? (
            <div className="rounded-[2.5rem] border border-black/10 bg-white/95 p-6 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-10">
              <MushafPageRenderer data={mushafContent.data} className="font-serif" />
            </div>
          ) : null}

          {!claimToken ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
              {t.notAssigned}
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white/90 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
        <div className="mx-auto max-w-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="flex-1 rounded-full border border-hatym-ink px-4 py-3 text-xs font-semibold uppercase tracking-wide dark:border-white"
            >
              {t.back}
            </button>
            <button
              onClick={handleComplete}
              disabled={!canComplete}
              className="flex-[1.4] rounded-full bg-hatym-ink px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              {isCompleting ? t.completing : t.markCompleted}
            </button>
          </div>
          {status !== "error" && error ? (
            <div className="mt-2 text-center text-xs text-red-700 dark:text-red-300">{error}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
