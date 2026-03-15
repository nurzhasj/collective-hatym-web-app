"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Fallback Unicode Arabic font while the QCF page font is loading
const FALLBACK_FONT = "var(--font-arabic, serif)";
const BASMALA_FALLBACK = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

// QCF v2 per-page fonts — self-hosted in Supabase Storage (falls back to quran.com CDN)
const QPC_FONTS_BASE =
  process.env.NEXT_PUBLIC_QPC_FONTS_BASE_URL ??
  "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";

const fontUrl = (page: number) => `${QPC_FONTS_BASE}/p${page}.woff2`;

const pageFontName = (page: number) => `p${page}-v2`;

// Madinah Mushaf: every page has exactly 15 lines.
const LINES_PER_PAGE = 15;
const LINE_START_PADDING_PX = 2;
const LINE_END_PADDING_PX = 2;
const COMPACT_FONT_BOOST = 1.08;

// ---- Types (matches the JSON format from the user's 604 files) ----

interface QPCWord {
  location: string;
  word: string; // plain Unicode Arabic — used as fallback
  qpcV2?: string; // QCF v2 glyph characters — authentic King Fahd rendering
}

interface QPCLine {
  line: number;
  type: string; // "surah-header" | "basmala" | "text"
  text?: string;
  words?: QPCWord[];
  qpcV2?: string; // line-level glyph string (used on basmala lines)
}

export interface QPCPageData {
  page: number;
  lines: QPCLine[];
}

export function isQPCData(data: unknown): data is QPCPageData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.page === "number" &&
    Array.isArray(d.lines) &&
    d.lines.length > 0 &&
    typeof (d.lines[0] as Record<string, unknown>).type === "string"
  );
}

// ---- Font loader ----

const _loaded = new Set<number>();

async function loadPageFont(page: number): Promise<void> {
  if (_loaded.has(page) || typeof document === "undefined") return;
  try {
    const face = new FontFace(pageFontName(page), `url(${fontUrl(page)})`, {
      display: "block",
    });
    await face.load();
    document.fonts.add(face);
    _loaded.add(page);
  } catch (e) {
    console.warn(`QPCPageRenderer: font load failed for page ${page}`, e);
  }
}

// ---- Sub-components ----
// All inherit fontSize from the grid container — no explicit font sizing needed.

function SurahHeader({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full border border-slate-300/60 bg-slate-100/80 px-6 py-1 text-center dark:border-white/20 dark:bg-white/10">
        <span style={{ fontFamily: FALLBACK_FONT, fontWeight: 600 }}>
          {text}
        </span>
      </div>
    </div>
  );
}

function BasmalaLine({
  qpcV2,
  fontLoaded,
  pageFont,
}: {
  qpcV2?: string;
  fontLoaded: boolean;
  pageFont: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        direction: "rtl",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        paddingInlineStart: `${LINE_START_PADDING_PX}px`,
        paddingInlineEnd: `${LINE_END_PADDING_PX}px`,
        overflow: "visible",
      }}
    >
      {fontLoaded && qpcV2 ? (
        <span
          dangerouslySetInnerHTML={{ __html: qpcV2 }}
          style={{ fontFamily: pageFont, whiteSpace: "nowrap", flexShrink: 0 }}
        />
      ) : (
        <span style={{ fontFamily: FALLBACK_FONT, whiteSpace: "nowrap", flexShrink: 0 }}>
          {BASMALA_FALLBACK}
        </span>
      )}
    </div>
  );
}

function TextLine({
  words,
  fontLoaded,
  pageFont,
  isShortLine,
  isCompactPage,
}: {
  words: QPCWord[];
  fontLoaded: boolean;
  pageFont: string;
  isShortLine: boolean;
  isCompactPage: boolean;
}) {
  if (!words.length) return null;
  const justify =
    isCompactPage
      ? "center"
      : words.length === 1
      ? "center"
      : isShortLine
        ? "center"
        : "space-between";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: justify,
        direction: "rtl",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        paddingInlineStart: `${LINE_START_PADDING_PX}px`,
        paddingInlineEnd: `${LINE_END_PADDING_PX}px`,
        overflow: "visible",
      }}
    >
      {words.map((w, i) =>
        fontLoaded && w.qpcV2 ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: w.qpcV2 }}
            style={{ fontFamily: pageFont, whiteSpace: "nowrap", flexShrink: 0 }}
          />
        ) : (
          <span key={i} style={{ fontFamily: FALLBACK_FONT, whiteSpace: "nowrap", flexShrink: 0 }}>
            {w.word}
          </span>
        )
      )}
    </div>
  );
}

// ---- Line preprocessing ----

// Merge single-word text lines (verse-end ornaments) into the previous text line.
function mergeOrnamentLines(lines: QPCLine[]): QPCLine[] {
  const result: QPCLine[] = [];
  for (const line of lines) {
    const prevIdx = result.length - 1;
    if (
      line.type === "text" &&
      line.words?.length === 1 &&
      prevIdx >= 0 &&
      result[prevIdx].type === "text" &&
      result[prevIdx].words?.length
    ) {
      result[prevIdx] = {
        ...result[prevIdx],
        words: [...(result[prevIdx].words ?? []), ...line.words],
      };
    } else {
      result.push(line);
    }
  }
  return result;
}

// ---- Main renderer ----

interface Props {
  data: QPCPageData;
  className?: string;
}

export default function QPCPageRenderer({ data, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const pageFont = pageFontName(data.page);

  const lines = useMemo(() => mergeOrnamentLines(data.lines), [data.lines]);
  const headerLine = lines.find((line) => line.type === "surah-header") ?? null;
  const contentLines = headerLine ? lines.filter((line) => line.type !== "surah-header") : lines;
  const reservedHeaderRows = headerLine ? 1 : 0;

  const lastTextLineIdx = contentLines.reduce<number>(
    (last, line, i) => (line.type === "text" && line.words?.length ? i : last),
    -1
  );

  const isCompactPage = useMemo(() => {
    const textLines = contentLines.filter((line) => line.type === "text" && line.words?.length);
    if (!textLines.length) return false;

    const totalWords = textLines.reduce((sum, line) => sum + (line.words?.length ?? 0), 0);
    const averageWords = totalWords / textLines.length;
    const maxWords = textLines.reduce((max, line) => Math.max(max, line.words?.length ?? 0), 0);

    return averageWords <= 8 && maxWords <= 10;
  }, [contentLines]);

  const leadingEmptyRows = useMemo(() => {
    if (!isCompactPage) return 0;
    const availableRows = LINES_PER_PAGE - reservedHeaderRows;
    return Math.max(0, Math.floor((availableRows - contentLines.length) / 2));
  }, [contentLines.length, isCompactPage, reservedHeaderRows]);

  const trailingEmptyRows = Math.max(
    0,
    LINES_PER_PAGE - reservedHeaderRows - contentLines.length - leadingEmptyRows
  );

  // Dynamic font sizing: measure actual container, pick the smaller of
  // width-based and height-based sizes so text never overflows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const byWidth = width * (isCompactPage ? 0.06 : 0.056);
      const byHeight = (height / LINES_PER_PAGE) * (isCompactPage ? 0.61 : 0.58);
      const nextSize = Math.max(12, Math.min(byWidth, byHeight));
      setFontSize(isCompactPage ? nextSize * COMPACT_FONT_BOOST : nextSize);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isCompactPage]);

  useEffect(() => {
    let alive = true;
    setFontLoaded(false);
    loadPageFont(data.page).then(() => {
      if (alive) setFontLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [data.page]);

  return (
    <div
      ref={containerRef}
      lang="ar"
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: `repeat(${LINES_PER_PAGE}, 1fr)`,
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        height: "100%",
        fontSize: `${fontSize}px`,
        lineHeight: 1.15,
        overflow: "visible",
        WebkitTextSizeAdjust: "100%",
      }}
    >
      {headerLine ? <SurahHeader key={headerLine.line} text={headerLine.text ?? ""} /> : null}

      {Array.from({ length: leadingEmptyRows }, (_, index) => (
        <div key={`leading-empty-${index}`} aria-hidden="true" />
      ))}

      {contentLines.map((line, idx) => {
        if (line.type === "basmala") {
          return (
            <BasmalaLine
              key={line.line}
              qpcV2={line.qpcV2}
              fontLoaded={fontLoaded}
              pageFont={pageFont}
            />
          );
        }

        if (line.type === "text" && line.words?.length) {
          const isShortLine = idx === lastTextLineIdx || line.words.length <= 2;
          return (
            <TextLine
              key={line.line}
              words={line.words}
              fontLoaded={fontLoaded}
              pageFont={pageFont}
              isShortLine={isShortLine}
              isCompactPage={isCompactPage}
            />
          );
        }

        const fallback = line.text?.trim();
        if (fallback) {
          return (
            <div
              key={line.line}
              dir="rtl"
              style={{
                textAlign: "center",
                fontFamily: FALLBACK_FONT,
              }}
            >
              {fallback}
            </div>
          );
        }

        return null;
      })}

      {Array.from({ length: trailingEmptyRows }, (_, index) => (
        <div key={`trailing-empty-${index}`} aria-hidden="true" />
      ))}
    </div>
  );
}
