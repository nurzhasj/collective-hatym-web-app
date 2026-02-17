function toHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function padPage(pageNumber: number) {
  return String(pageNumber).padStart(3, "0");
}

function fromTemplate(template: string, pageNumber: number) {
  const padded = padPage(pageNumber);
  const next = template
    .replaceAll("{page}", String(pageNumber))
    .replaceAll("{page_padded}", padded)
    .replaceAll("{page3}", padded);
  return toHttpUrl(next);
}

function fromBase(baseUrl: string, pageNumber: number) {
  try {
    const base = new URL(baseUrl);
    const normalizedPath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    base.pathname = `${normalizedPath}page-${padPage(pageNumber)}.json`;
    return toHttpUrl(base.toString());
  } catch {
    return null;
  }
}

function inferFromStoredUrl(storedUrl: string, pageNumber: number) {
  const jsonUrl = toHttpUrl(storedUrl);
  if (!jsonUrl) return null;
  if (jsonUrl.toLowerCase().endsWith(".json")) return jsonUrl;

  try {
    const url = new URL(jsonUrl);
    const imageExtPattern = /\.(png|jpe?g|webp|avif|gif)$/i;

    if (imageExtPattern.test(url.pathname)) {
      // Common Supabase path swap: .../<images-folder>/page-001.png -> .../mushaf-json/page-001.json
      if (url.pathname.includes("/mushaf-images/")) {
        url.pathname = url.pathname.replace("/mushaf-images/", "/mushaf-json/");
      } else if (url.pathname.includes("/mushaf-pages/")) {
        url.pathname = url.pathname.replace("/mushaf-pages/", "/mushaf-json/");
      }

      // Keep file stem, normalize extension to .json, and align with page number.
      url.pathname = url.pathname.replace(imageExtPattern, ".json");
      url.pathname = url.pathname.replace(/page-\d{1,3}\.json$/i, `page-${padPage(pageNumber)}.json`);
      return toHttpUrl(url.toString());
    }

    return null;
  } catch {
    return null;
  }
}

function pushUnique(target: string[], candidate: string | null) {
  if (candidate && !target.includes(candidate)) {
    target.push(candidate);
  }
}

export function resolveMushafUrls(value: string | null | undefined, pageNumber: number) {
  const candidates: string[] = [];

  const template = process.env.NEXT_PUBLIC_MUSHAF_JSON_URL_TEMPLATE;
  if (template) {
    const viaTemplate = fromTemplate(template, pageNumber);
    pushUnique(candidates, viaTemplate);
  }

  const base = process.env.NEXT_PUBLIC_MUSHAF_JSON_BASE_URL;
  if (base) {
    const viaBase = fromBase(base, pageNumber);
    pushUnique(candidates, viaBase);
  }

  const viaStored = inferFromStoredUrl(value ?? "", pageNumber);
  pushUnique(candidates, viaStored);

  return candidates;
}

export function resolveMushafUrl(value: string | null | undefined, pageNumber: number) {
  return resolveMushafUrls(value, pageNumber)[0] ?? null;
}
