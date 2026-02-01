"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Open_Sans } from "next/font/google";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ASSIGNMENT_TTL_MINUTES } from "@/lib/constants";
import { clearClaimToken, getOrCreateUserId, storeClaimToken } from "@/lib/browserStorage";

type ClaimResponse = {
  page_number: number | null;
  mushaf_url: string | null;
  claim_token: string | null;
  status: string | null;
};

type CompleteResponse = {
  status: string | null;
  completed_count: number | null;
  finished: boolean | null;
};

type Props = {
  sessionId: string;
};

type Language = "en" | "kk";

const LANG_KEY = "hatym_kiosk_lang";

const COPY: Record<
  Language,
  {
    yourPage: string;
    openMushaf: string;
    markCompleted: string;
    resumeHint: string;
    claiming: string;
    hatymDone: string;
    scanNewSession: string;
    done: string;
    scanAgain: string;
    tryAgain: string;
  }
> = {
  en: {
    yourPage: "Your page",
    openMushaf: "Open Mushaf",
    markCompleted: "Mark as completed",
    resumeHint: "If you close this page, scan again to resume your assignment.",
    claiming: "Claiming your page...",
    hatymDone: "Hatym already completed.",
    scanNewSession: "Please scan the kiosk QR for a new session.",
    done: "Done.",
    scanAgain: "Refresh the page get another quranic page.",
    tryAgain: "Try again"
  },
  kk: {
    yourPage: "Сіздің бетіңіз",
    openMushaf: "Мұсхафты ашу",
    markCompleted: "Аяқталды деп белгілеу",
    resumeHint: "Бұл бетті жапсаңыз, жаңа бет алу үшін бетті жаңартыңыз.",
    claiming: "Бетіңіз тағайындалуда...",
    hatymDone: "Хатым аяқталған.",
    scanNewSession: "Жаңа сессия үшін киоск QR-кодын сканерлеңіз.",
    done: "Оқылды.",
    scanAgain: "Келесі бетті алу үшін бетті жаңартыңыз.",
    tryAgain: "Қайта көріңіз"
  }
};

const kkSans = Open_Sans({
  subsets: ["cyrillic"],
  weight: ["400", "600"],
  display: "swap"
});

export default function ClaimClient({ sessionId }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [lang, setLang] = useState<Language>("en");
  const [userId, setUserId] = useState("");
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "assigned" | "finished" | "completed" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const t = COPY[lang];

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "kk") {
      setLang(stored);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;

    async function claimPage() {
      setStatus("loading");
      setError(null);
      const { data, error: claimError } = await supabase.rpc("claim_next_page", {
        p_session_id: sessionId,
        p_user_id: userId,
        p_ttl_minutes: ASSIGNMENT_TTL_MINUTES
      });

      if (!isMounted) return;
      if (claimError) {
        setError(claimError.message);
        setStatus("error");
        return;
      }

      const row = (data?.[0] ?? null) as ClaimResponse | null;
      if (!row || row.status === "finished") {
        setStatus("finished");
        return;
      }

      const nextPageNumber = row.page_number ?? null;
      const nextClaimToken = row.claim_token ?? null;

      setPageNumber(nextPageNumber);
      setClaimToken(nextClaimToken);
      if (nextPageNumber && nextClaimToken) {
        storeClaimToken(sessionId, nextPageNumber, nextClaimToken);
      }
      setStatus("assigned");
    }

    claimPage();

    return () => {
      isMounted = false;
    };
  }, [sessionId, supabase, userId]);

  const canComplete = useMemo(() => {
    return status === "assigned" && pageNumber && claimToken;
  }, [status, pageNumber, claimToken]);

  async function handleComplete() {
    if (!canComplete || !pageNumber || !claimToken) return;
    setStatus("loading");
    setError(null);

    const { data, error: completeError } = await supabase.rpc("complete_page", {
      p_session_id: sessionId,
      p_page_number: pageNumber,
      p_user_id: userId,
      p_claim_token: claimToken
    });

    if (completeError) {
      setError(completeError.message);
      setStatus("error");
      return;
    }

    const row = (data?.[0] ?? null) as CompleteResponse | null;
    if (!row || row.status !== "completed") {
      setError("Unable to complete this page. Please scan again.");
      setStatus("error");
      return;
    }

    if (pageNumber) {
      clearClaimToken(sessionId, pageNumber);
    }
    setStatus("completed");
  }

  if (status === "loading" || status === "idle") {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-white text-hatym-ink ${
          lang === "kk" ? kkSans.className : ""
        }`}
      >
        {t.claiming}
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center text-hatym-ink ${
          lang === "kk" ? kkSans.className : ""
        }`}
      >
        <div className="text-2xl font-semibold">{t.hatymDone}</div>
        <div className="text-sm text-hatym-ink/70">{t.scanNewSession}</div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center text-hatym-ink ${
          lang === "kk" ? kkSans.className : ""
        }`}
      >
        <div className="text-2xl font-semibold">{t.done}</div>
        <div className="text-sm text-hatym-ink/70">{t.scanAgain}</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-center text-hatym-ink ${
          lang === "kk" ? kkSans.className : ""
        }`}
      >
        <div className="text-lg">{error ?? "Something went wrong."}</div>
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
    <div
      className={`min-h-screen flex flex-col items-center justify-center gap-6 bg-white px-6 text-center text-hatym-ink ${
        lang === "kk" ? kkSans.className : ""
      }`}
    >
      <div className="w-full flex justify-center">
        <div className="flex items-center gap-1 rounded-full border border-black/10 bg-white/80 p-1 text-xs uppercase tracking-[0.3em] text-hatym-ink/70">
          <button
            className={`rounded-full px-3 py-1 ${lang === "en" ? "bg-hatym-ink text-white" : ""}`}
            onClick={() => {
              setLang("en");
              window.localStorage.setItem(LANG_KEY, "en");
            }}
          >
            EN
          </button>
          <button
            className={`rounded-full px-3 py-1 ${lang === "kk" ? "bg-hatym-ink text-white" : ""}`}
            onClick={() => {
              setLang("kk");
              window.localStorage.setItem(LANG_KEY, "kk");
            }}
          >
            ҚАЗ
          </button>
        </div>
      </div>
      <div className="text-sm uppercase tracking-[0.3em] text-hatym-ink/60">{t.yourPage}</div>
      <div className="text-6xl font-semibold">{pageNumber}</div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href={pageNumber ? `/read/${sessionId}/${pageNumber}` : "#"}
          className={`rounded-full bg-hatym-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white ${
            pageNumber ? "" : "pointer-events-none opacity-50"
          }`}
        >
          {t.openMushaf}
        </Link>
        <button
          className="rounded-full border border-hatym-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide"
          onClick={handleComplete}
        >
          {t.markCompleted}
        </button>
      </div>
      <div className="text-xs text-hatym-ink/60">{t.resumeHint}</div>
    </div>
  );
}
