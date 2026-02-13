"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MAX_PAGES_PER_USER } from "@/lib/constants";
import { clearClaimToken, getOrCreateUserId, storeClaimToken } from "@/lib/browserStorage";

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
};

const COPY = {
  yourPages: "Сіздің беттеріңіз",
  pageStatusAssigned: "Тағайындалған",
  pageStatusCompleted: "Аяқталды",
  openMushaf: "Мұсхафты ашу",
  resumeHint: "Бұл хатым сессиясында сізге ең көбі 3 бет беріледі. Қайта сканерлегенде тек осы беттер көрсетіледі.",
  claiming: "Беттеріңіз дайындалуда...",
  hatymDone: "Хатым аяқталған.",
  scanNewSession: "Жаңа сессия үшін киоск QR-кодын сканерлеңіз.",
  limitReached: "Бұл сессияда сізге 3 бет берілді.",
  limitHint: "Жаңа хатым сессиясы басталғанда ғана жаңа бет ала аласыз.",
  noPages: "Бұл сессияда сізге тиесілі белсенді беттер табылмады.",
  tryAgain: "Қайта көріңіз"
};

export default function ClaimClient({ sessionId }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState("");
  const [pages, setPages] = useState<ClaimedPage[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "assigned" | "finished" | "limit" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const t = COPY;

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
  }, []);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function claimPages() {
      setStatus("loading");
      setError(null);
      const { data, error: claimError } = await supabase.rpc("claim_next_page", {
        p_session_id: sessionId,
        p_user_id: userId
      });

      if (!isMounted) return;
      if (claimError) {
        setError(claimError.message);
        setStatus("error");
        return;
      }

      const rows = (data ?? []) as ClaimResponse[];
      const hasLimitRow = rows.some((row) => row.status === "limit_reached");
      const hasFinishedRow = rows.some((row) => row.status === "finished");

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
        setPages(nextPages.slice(0, MAX_PAGES_PER_USER));
        setStatus("assigned");
        return;
      }

      if (hasLimitRow) {
        setStatus("limit");
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
  }, [sessionId, supabase, userId]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-hatym-ink">
        {t.claiming}
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center text-hatym-ink">
        <div className="text-2xl font-semibold">{t.hatymDone}</div>
        <div className="text-sm text-hatym-ink/70">{t.scanNewSession}</div>
      </div>
    );
  }

  if (status === "limit") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white px-6 text-center text-hatym-ink">
        <div className="text-2xl font-semibold">{t.limitReached}</div>
        <div className="max-w-md text-sm text-hatym-ink/70">{t.limitHint}</div>
        <div className="text-xs text-hatym-ink/60">{t.noPages}</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-center text-hatym-ink">
        <div className="text-lg">{error ?? "Қате орын алды."}</div>
        <button
          className="rounded-full border border-hatym-ink px-6 py-2 text-sm uppercase tracking-wide"
          onClick={() => window.location.reload()}
        >
          {t.tryAgain}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white px-6 py-10 text-center text-hatym-ink">
      <div className="text-sm uppercase tracking-[0.3em] text-hatym-ink/60">
        {t.yourPages} ({pages.length} / {MAX_PAGES_PER_USER})
      </div>

      <div className="w-full max-w-sm space-y-3">
        {pages.map((page) => (
          <div key={page.pageNumber} className="rounded-3xl border border-black/10 bg-white px-5 py-4 shadow-sm">
            <div className="text-4xl font-semibold">{page.pageNumber}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.25em] text-hatym-ink/60">
              {page.status === "completed" ? t.pageStatusCompleted : t.pageStatusAssigned}
            </div>
            <Link
              href={page.status === "assigned" && page.claimToken ? `/read/${sessionId}/${page.pageNumber}` : "#"}
              className={`mt-4 inline-flex rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wide ${
                page.status === "assigned" && page.claimToken
                  ? "bg-hatym-ink text-white"
                  : "pointer-events-none border border-hatym-ink/30 text-hatym-ink/50"
              }`}
            >
              {t.openMushaf}
            </Link>
          </div>
        ))}
      </div>

      <div className="max-w-md text-xs text-hatym-ink/60">{t.resumeHint}</div>
    </div>
  );
}
