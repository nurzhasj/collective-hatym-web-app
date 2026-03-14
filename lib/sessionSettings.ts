import {
  DEFAULT_AUTO_COMPLETE_AFTER_MINUTES,
  DEFAULT_PAGE_TTL_MINUTES,
  DEFAULT_PAGES_PER_USER,
  MAX_AUTO_COMPLETE_AFTER_MINUTES,
  MAX_PAGE_TTL_MINUTES,
  MAX_PAGES_PER_USER,
  MIN_AUTO_COMPLETE_AFTER_MINUTES,
  MIN_PAGE_TTL_MINUTES,
  MIN_PAGES_PER_USER
} from "@/lib/constants";

export type SessionSettings = {
  pagesPerUser: number;
  pageTtlMinutes: number;
  autoCompleteAfterMinutes: number | null;
};

type SessionSettingsInput = {
  pagesPerUser?: unknown;
  pageTtlMinutes?: unknown;
  autoCompleteAfterMinutes?: unknown;
};

type SessionRowInput = {
  pages_per_user: unknown;
  page_ttl_minutes: unknown;
  auto_complete_after_minutes: unknown;
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseIntValue(value: unknown) {
  const next = typeof value === "string" ? Number(value) : value;
  if (typeof next !== "number" || !Number.isFinite(next)) {
    return null;
  }
  return Math.trunc(next);
}

export function normalizeSessionSettings(input?: SessionSettingsInput): SessionSettings {
  const parsedPages = parseIntValue(input?.pagesPerUser);
  const parsedTtl = parseIntValue(input?.pageTtlMinutes);
  const parsedAutoComplete = parseIntValue(input?.autoCompleteAfterMinutes);

  const pagesPerUser = clampInt(
    parsedPages ?? DEFAULT_PAGES_PER_USER,
    MIN_PAGES_PER_USER,
    MAX_PAGES_PER_USER
  );
  const pageTtlMinutes = clampInt(
    parsedTtl ?? DEFAULT_PAGE_TTL_MINUTES,
    MIN_PAGE_TTL_MINUTES,
    MAX_PAGE_TTL_MINUTES
  );

  let autoCompleteAfterMinutes = DEFAULT_AUTO_COMPLETE_AFTER_MINUTES;
  if (parsedAutoComplete !== null) {
    autoCompleteAfterMinutes =
      parsedAutoComplete <= 0
        ? null
        : clampInt(
            parsedAutoComplete,
            MIN_AUTO_COMPLETE_AFTER_MINUTES,
            MAX_AUTO_COMPLETE_AFTER_MINUTES
          );
  }

  return { pagesPerUser, pageTtlMinutes, autoCompleteAfterMinutes };
}

export function mapSessionRowToSettings(row: SessionRowInput): SessionSettings {
  return normalizeSessionSettings({
    pagesPerUser: row.pages_per_user,
    pageTtlMinutes: row.page_ttl_minutes,
    autoCompleteAfterMinutes: row.auto_complete_after_minutes
  });
}
