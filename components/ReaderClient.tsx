"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Noto_Naskh_Arabic } from "next/font/google";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getClaimToken, getOrCreateUserId, clearClaimToken } from "@/lib/browserStorage";
import { resolveMushafUrl } from "@/lib/mushaf";
import MushafPageRenderer from "@/components/MushafPageRenderer";

type CompleteResponse = {
  status: string | null;
  completed_count: number | null;
  finished: boolean | null;
};

type Props = {
  sessionId: string;
  pageNumber: number;
};

const arabicFont = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "600"],
  display: "swap"
});

export default function ReaderClient({ sessionId, pageNumber }: Props) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [mushafData, setMushafData] = useState<unknown | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "completed">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    setUserId(getOrCreateUserId());
    setClaimToken(getClaimToken(sessionId, pageNumber));
  }, [sessionId, pageNumber]);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setStatus("loading");
      setError(null);

      const { data, error: pageError } = await supabase
        .from("quran_pages")
        .select("page_number,mushaf_url,render_type")
        .eq("page_number", pageNumber)
        .single();

      if (!isMounted) return;
      if (pageError || !data) {
        setError(pageError?.message || "Unable to load the mushaf page.");
        setStatus("error");
        return;
      }

      if (data.render_type && data.render_type !== "json") {
        setError("Unsupported render type for this page.");
        setStatus("error");
        return;
      }

      const resolvedUrl = resolveMushafUrl(data.mushaf_url);
      if (!resolvedUrl) {
        setError("Invalid mushaf URL for this page.");
        setStatus("error");
        return;
      }

      try {
        const response = await fetch(resolvedUrl, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to fetch mushaf JSON (HTTP ${response.status})`);
        }
        const json = (await response.json()) as unknown;
        if (!isMounted) return;
        setMushafData(json);
        setStatus("ready");
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Unable to fetch mushaf JSON.");
        setStatus("error");
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [pageNumber, supabase]);

  const canComplete = useMemo(() => {
    return Boolean(claimToken && userId && status === "ready" && !isCompleting);
  }, [claimToken, userId, status, isCompleting]);

  async function handleComplete() {
    if (!canComplete || !claimToken) return;
    setIsCompleting(true);
    setError(null);

    const { data, error: completeError } = await supabase.rpc("complete_page", {
      p_session_id: sessionId,
      p_page_number: pageNumber,
      p_user_id: userId,
      p_claim_token: claimToken
    });

    if (completeError) {
      setError(completeError.message);
      setIsCompleting(false);
      return;
    }

    const row = (data?.[0] ?? null) as CompleteResponse | null;
    if (!row || row.status !== "completed") {
      setError("Unable to complete this page. Please scan again.");
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
        <div className="text-2xl font-semibold">Completed.</div>
        <div className="text-sm text-hatym-ink/70 dark:text-slate-300">Scan QR again to get the next page.</div>
        <button
          onClick={handleBack}
          className="rounded-full border border-hatym-ink px-6 py-2 text-sm uppercase tracking-wide dark:border-white"
        >
          Back
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
              Mushaf page
            </div>
            <div className="text-3xl font-semibold">{pageNumber}</div>
          </div>

          {status === "loading" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-center text-sm text-hatym-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              Loading page…
            </div>
          ) : null}

          {status === "error" ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-50 p-5 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200">
              {error ?? "Unable to load this page."}
            </div>
          ) : null}

          {status === "ready" && mushafData ? (
            <div className="rounded-[2.5rem] border border-black/10 bg-white/95 p-6 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-10">
              <MushafPageRenderer data={mushafData} className={arabicFont.className} />
            </div>
          ) : null}

          {!claimToken ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
              This page is not assigned to you. Please go back and claim it again.
            </div>
          ) : null}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-black/10 bg-white/90 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            onClick={handleBack}
            className="flex-1 rounded-full border border-hatym-ink px-4 py-3 text-xs font-semibold uppercase tracking-wide dark:border-white"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={!canComplete}
            className="flex-[1.4] rounded-full bg-hatym-ink px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {isCompleting ? "Completing..." : "Mark as completed"}
          </button>
        </div>
      </div>
    </div>
  );
}
