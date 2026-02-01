const USER_ID_KEY = "hatym_user_id";
const CLAIM_PREFIX = "hatym_claim";

function generateUuid() {
  if (typeof window === "undefined") return "";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const fallback = Math.random().toString(36).slice(2);
  return `fallback-${Date.now()}-${fallback}`;
}

export function getOrCreateUserId() {
  if (typeof window === "undefined") return "";
  let userId = window.localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUuid();
    window.localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

export function storeClaimToken(sessionId: string, pageNumber: number, claimToken: string) {
  if (typeof window === "undefined") return;
  const key = `${CLAIM_PREFIX}:${sessionId}:${pageNumber}`;
  window.localStorage.setItem(key, claimToken);
}

export function getClaimToken(sessionId: string, pageNumber: number) {
  if (typeof window === "undefined") return null;
  const key = `${CLAIM_PREFIX}:${sessionId}:${pageNumber}`;
  return window.localStorage.getItem(key);
}

export function clearClaimToken(sessionId: string, pageNumber: number) {
  if (typeof window === "undefined") return;
  const key = `${CLAIM_PREFIX}:${sessionId}:${pageNumber}`;
  window.localStorage.removeItem(key);
}
