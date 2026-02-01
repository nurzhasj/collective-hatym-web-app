"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export default function ClaimClient({ sessionId }: Props) {
  const supabase = getSupabaseBrowserClient();
  const [userId, setUserId] = useState("");
  const [pageNumber, setPageNumber] = useState<number | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "assigned" | "finished" | "completed" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);
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
      <div className="min-h-screen flex items-center justify-center bg-white text-hatym-ink">
        Claiming your page...
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center text-hatym-ink">
        <div className="text-2xl font-semibold">Hatym already completed.</div>
        <div className="text-sm text-hatym-ink/70">Please scan the kiosk QR for a new session.</div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-white text-center text-hatym-ink">
        <div className="text-2xl font-semibold">Done.</div>
        <div className="text-sm text-hatym-ink/70">Scan the QR again to get another page.</div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-center text-hatym-ink">
        <div className="text-lg">{error ?? "Something went wrong."}</div>
        <button
          className="rounded-full border border-hatym-ink px-6 py-2 text-sm uppercase tracking-wide"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-white px-6 text-center text-hatym-ink">
      <div className="text-sm uppercase tracking-[0.3em] text-hatym-ink/60">Your page</div>
      <div className="text-6xl font-semibold">{pageNumber}</div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href={pageNumber ? `/read/${sessionId}/${pageNumber}` : "#"}
          className={`rounded-full bg-hatym-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white ${
            pageNumber ? "" : "pointer-events-none opacity-50"
          }`}
        >
          Open Mushaf
        </Link>
        <button
          className="rounded-full border border-hatym-ink px-6 py-3 text-sm font-semibold uppercase tracking-wide"
          onClick={handleComplete}
        >
          Mark as completed
        </button>
      </div>
      <div className="text-xs text-hatym-ink/60">
        If you close this page, scan again to resume your assignment.
      </div>
    </div>
  );
}
