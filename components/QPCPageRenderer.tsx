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
    <div style={{ textAlign: "center", direction: "rtl" }}>
      {fontLoaded && qpcV2 ? (
        <span
          dangerouslySetInnerHTML={{ __html: qpcV2 }}
          style={{ fontFamily: pageFont }}
        />
      ) : (
        <span style={{ fontFamily: FALLBACK_FONT }}>{BASMALA_FALLBACK}</span>
      )}
    </div>
  );
}

function TextLine({
  words,
  fontLoaded,
  pageFont,
  isShortLine,
}: {
  words: QPCWord[];
  fontLoaded: boolean;
  pageFont: string;
  isShortLine: boolean;
}) {
  if (!words.length) return null;
  const justify =
    words.length === 1
      ? "center"
      : isShortLine
        ? "flex-start"
        : "space-between";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        justifyContent: justify,
        direction: "rtl",
      }}
    >
      {words.map((w, i) =>
        fontLoaded && w.qpcV2 ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: w.qpcV2 }}
            style={{ fontFamily: pageFont }}
          />
        ) : (
          <span key={i} style={{ fontFamily: FALLBACK_FONT }}>
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

  const lastTextLineIdx = lines.reduce<number>(
    (last, line, i) => (line.type === "text" && line.words?.length ? i : last),
    -1
  );

  // Dynamic font sizing: measure actual container, pick the smaller of
  // width-based and height-based sizes so text never overflows.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const byWidth = width * 0.056;
      const byHeight = (height / LINES_PER_PAGE) * 0.58;
      setFontSize(Math.max(12, Math.min(byWidth, byHeight)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
        gridTemplateRows: `repeat(${LINES_PER_PAGE}, 1fr)`,
        alignItems: "center",
        height: "100%",
        fontSize: `${fontSize}px`,
        lineHeight: 1.15,
        overflow: "hidden",
      }}
    >
      {lines.map((line, idx) => {
        if (line.type === "surah-header") {
          return <SurahHeader key={line.line} text={line.text ?? ""} />;
        }

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
    </div>
  );
}
