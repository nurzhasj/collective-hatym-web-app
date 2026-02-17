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

function getPageFilenameVariants(pageNumber: number) {
  const page = String(pageNumber);
  const padded = padPage(pageNumber);
  return [`page-${padded}.json`, `${page}.json`, `${padded}.json`, `page-${page}.json`];
}

function ensureTrailingSlash(pathname: string) {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function replaceLastSegment(pathname: string, fileName: string) {
  const lastSlash = pathname.lastIndexOf("/");
  if (lastSlash < 0) return `/${fileName}`;
  return `${pathname.slice(0, lastSlash + 1)}${fileName}`;
}

function buildUrlWithPath(url: URL, pathname: string) {
  const next = new URL(url.toString());
  next.pathname = pathname;
  return toHttpUrl(next.toString());
}

function getFolderVariants(folderPath: string) {
  const variants: string[] = [folderPath];
  const swaps: Array<[string, string]> = [
    ["/mushaf-img/", "/mushaf-json/"],
    ["/mushaf-image/", "/mushaf-json/"],
    ["/mushaf-images/", "/mushaf-json/"],
    ["/mushaf-pages/", "/mushaf-json/"],
    ["/images/", "/mushaf-json/"],
    ["/img/", "/mushaf-json/"]
  ];

  for (const [from, to] of swaps) {
    if (folderPath.includes(from)) {
      variants.push(folderPath.replace(from, to));
    }
  }

  if (!folderPath.includes("/mushaf-json/") && /\/mushaf-[^/]+\//.test(folderPath)) {
    variants.push(folderPath.replace(/\/mushaf-[^/]+\//, "/mushaf-json/"));
  }

  return Array.from(new Set(variants));
}

function fromTemplate(template: string, pageNumber: number) {
  const padded = padPage(pageNumber);
  const next = template
    .replaceAll("{page}", String(pageNumber))
    .replaceAll("{page_padded}", padded)
    .replaceAll("{page3}", padded);
  const resolved = toHttpUrl(next);
  return resolved ? [resolved] : [];
}

function fromBase(baseUrl: string, pageNumber: number) {
  try {
    const base = new URL(baseUrl);
    const hasFileLikeName = /\.[A-Za-z0-9]+$/.test(base.pathname);
    const folder = ensureTrailingSlash(
      hasFileLikeName ? base.pathname.slice(0, base.pathname.lastIndexOf("/") + 1) : base.pathname
    );
    const candidates: string[] = [];
    for (const fileName of getPageFilenameVariants(pageNumber)) {
      const next = buildUrlWithPath(base, `${folder}${fileName}`);
      if (next) candidates.push(next);
    }
    return candidates;
  } catch {
    return [];
  }
}

function inferFromStoredUrl(storedUrl: string, pageNumber: number) {
  const jsonUrl = toHttpUrl(storedUrl);
  if (!jsonUrl) return [];

  try {
    const url = new URL(jsonUrl);
    const imageExtPattern = /\.(png|jpe?g|webp|avif|gif)$/i;
    const candidates: string[] = [];

    const lastSlash = url.pathname.lastIndexOf("/");
    const folder = lastSlash >= 0 ? url.pathname.slice(0, lastSlash + 1) : "/";
    const fileName = lastSlash >= 0 ? url.pathname.slice(lastSlash + 1) : url.pathname;

    const fileNameVariants: string[] = [];
    if (fileName.toLowerCase().endsWith(".json")) {
      fileNameVariants.push(fileName);
    }
    if (imageExtPattern.test(fileName)) {
      fileNameVariants.push(fileName.replace(imageExtPattern, ".json"));
    }
    fileNameVariants.push(...getPageFilenameVariants(pageNumber));

    const uniqueFileNames = Array.from(new Set(fileNameVariants));
    const folderVariants = getFolderVariants(folder);

    for (const folderVariant of folderVariants) {
      for (const candidateName of uniqueFileNames) {
        const nextPath = replaceLastSegment(`${folderVariant}${candidateName}`, candidateName);
        const next = buildUrlWithPath(url, nextPath);
        if (next) candidates.push(next);
      }
    }

    return Array.from(new Set(candidates));
  } catch {
    return [];
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
    for (const viaTemplate of fromTemplate(template, pageNumber)) {
      pushUnique(candidates, viaTemplate);
    }
  }

  const base = process.env.NEXT_PUBLIC_MUSHAF_JSON_BASE_URL;
  if (base) {
    for (const viaBase of fromBase(base, pageNumber)) {
      pushUnique(candidates, viaBase);
    }
  }

  for (const viaStored of inferFromStoredUrl(value ?? "", pageNumber)) {
    pushUnique(candidates, viaStored);
  }

  return candidates;
}

export function resolveMushafUrl(value: string | null | undefined, pageNumber: number) {
  return resolveMushafUrls(value, pageNumber)[0] ?? null;
}
