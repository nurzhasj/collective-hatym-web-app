import { useMemo } from "react";

export type MushafPageRendererProps = {
  data: unknown;
  className?: string;
};

type RenderLine = {
  text: string;
  isCentered: boolean;
  isHeader: boolean;
  isBasmala: boolean;
  lineType?: string | null;
};

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractTextFromFragments(value: unknown): string {
  if (!Array.isArray(value)) return "";
  const parts = value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      if (typeof item.text === "string") return item.text;
      if (typeof item.glyph === "string") return item.glyph;
      if (typeof item.char === "string") return item.char;
      if (typeof item.content === "string") return item.content;
      if (typeof item.word === "string") return item.word;
      return "";
    })
    .filter(Boolean);
  return parts.join(" ").trim();
}

function normalizeLine(line: unknown): RenderLine | null {
  if (typeof line === "string") {
    const trimmed = line.trim();
    if (!trimmed) return null;
    return {
      text: trimmed,
      isCentered: false,
      isHeader: false,
      isBasmala: false,
      lineType: null
    };
  }

  if (!isRecord(line)) return null;

  const lineTypeRaw =
    (typeof line.line_type === "string" && line.line_type) ||
    (typeof line.type === "string" && line.type) ||
    (typeof line.kind === "string" && line.kind) ||
    (typeof line.role === "string" && line.role) ||
    (typeof line.tag === "string" && line.tag) ||
    null;

  const lineType = lineTypeRaw ? lineTypeRaw.toLowerCase() : null;

  const isCentered = Boolean(
    line.is_centered === true ||
      line.centered === true ||
      line.center === true ||
      line.align === "center" ||
      (lineType && (lineType.includes("header") || lineType.includes("surah") || lineType.includes("basmala")))
  );

  const isHeader = Boolean(lineType && (lineType.includes("header") || lineType.includes("surah")));
  const isBasmala = Boolean(lineType && lineType.includes("basmala"));

  let text = "";
  if (typeof line.text === "string") text = line.text;
  if (!text && typeof line.content === "string") text = line.content;
  if (!text && typeof line.line === "string") text = line.line;
  if (!text && typeof line.value === "string") text = line.value;
  if (!text && Array.isArray(line.spans)) text = extractTextFromFragments(line.spans);
  if (!text && Array.isArray(line.words)) text = extractTextFromFragments(line.words);
  if (!text && Array.isArray(line.glyphs)) text = extractTextFromFragments(line.glyphs);
  if (!text && Array.isArray(line.segments)) text = extractTextFromFragments(line.segments);
  text = text.trim();

  if (!text) return null;

  return {
    text,
    isCentered,
    isHeader,
    isBasmala,
    lineType
  };
}

function looksLikeLine(value: unknown) {
  if (typeof value === "string") return true;
  if (!isRecord(value)) return false;
  return (
    typeof value.text === "string" ||
    typeof value.line === "string" ||
    typeof value.content === "string" ||
    typeof value.line_type === "string" ||
    typeof value.type === "string" ||
    Array.isArray(value.spans) ||
    Array.isArray(value.words) ||
    Array.isArray(value.glyphs)
  );
}

function findLineArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];

  const directKeys = ["lines", "content", "rows", "page_lines", "pageLines"] as const;
  for (const key of directKeys) {
    const value = data[key];
    if (Array.isArray(value)) return value;
  }

  if (isRecord(data.page)) {
    const nested = findLineArray(data.page);
    if (nested.length) return nested;
  }

  if (isRecord(data.data)) {
    const nested = findLineArray(data.data);
    if (nested.length) return nested;
  }

  for (const value of Object.values(data)) {
    if (Array.isArray(value) && value.length && looksLikeLine(value[0])) {
      return value;
    }
  }

  return [];
}

function extractLines(data: unknown): RenderLine[] {
  const lineArray = findLineArray(data);
  const normalized: RenderLine[] = [];
  for (const line of lineArray) {
    const parsed = normalizeLine(line);
    if (parsed) normalized.push(parsed);
  }
  return normalized;
}

export default function MushafPageRenderer({ data, className }: MushafPageRendererProps) {
  const lines = useMemo(() => extractLines(data), [data]);

  if (!lines.length) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-center text-sm text-hatym-ink/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
        Unable to parse page content.
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      lang="ar"
      className={cx(
        "space-y-5 text-[1.8rem] leading-[3.2rem] text-slate-900 dark:text-slate-100",
        className
      )}
      style={{ textRendering: "optimizeLegibility" }}
    >
      {lines.map((line, index) => {
        const isCentered = line.isCentered || line.isHeader || line.isBasmala;
        const key = `${line.text.slice(0, 16)}-${index}`;

        if (line.isHeader) {
          return (
            <div key={key} className="flex justify-center py-2">
              <div className="rounded-full border border-slate-300/80 bg-white/90 px-8 py-3 text-center shadow-sm dark:border-white/30 dark:bg-white/5">
                <p className="text-[2.1rem] font-semibold leading-[3rem]">{line.text}</p>
              </div>
            </div>
          );
        }

        return (
          <p
            key={key}
            className={cx(
              "whitespace-pre-wrap",
              isCentered ? "text-center" : "text-right",
              line.isBasmala ? "text-[2rem] font-semibold leading-[3.4rem]" : "font-normal"
            )}
          >
            {line.text}
          </p>
        );
      })}
    </div>
  );
}
