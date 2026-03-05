// QCF4 — King Fahd Complex font rendering system
// Each Quran word is a glyph stored in one of 47 font files.
// Data format: { p: fontGroupIndex (1-47), c: unicode codepoint (0xF100+) }
// Font files: QCF4_Hafs_01_W.ttf … QCF4_Hafs_47_W.ttf
// Borrowed from: https://github.com/NaifAlsultan/typst-quran-package

export interface QCF4Word {
  p: number; // font group index (1–47 for Hafs)
  c: number; // unicode codepoint in that font (Private Use Area, e.g. 0xF100)
}

export interface QCF4Line {
  type?: string; // 'header' | 'bismillah' | 'basmala' | 'verse' | 'surah_name'
  words: QCF4Word[];
}

export interface QCF4PageData {
  lines: QCF4Line[];
}

/** Returns true if `data` looks like a QCF4 page JSON (has lines with {p,c} words). */
export function isQCF4Data(data: unknown): data is QCF4PageData {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.lines) || d.lines.length === 0) return false;
  const firstLine = d.lines[0] as Record<string, unknown>;
  if (!Array.isArray(firstLine.words) || firstLine.words.length === 0) return false;
  const firstWord = firstLine.words[0] as Record<string, unknown>;
  return typeof firstWord.p === "number" && typeof firstWord.c === "number";
}

/** Build the CSS font-family name for a given font group index. */
export function qcf4FontName(p: number, variant: "Hafs" | "Warsh" = "Hafs"): string {
  return `QCF4_${variant}_${String(p).padStart(2, "0")}_W`;
}

/** Set of font names that have already been loaded into document.fonts. */
const _loaded = new Set<string>();

/**
 * Lazily load a single QCF4 font file via the FontFace API.
 * Fonts are fetched from NEXT_PUBLIC_QCF4_FONTS_BASE_URL (default: /fonts/qcf4).
 * Expected path: {base}/{variant_lower}/{fontName}.ttf
 * e.g. /fonts/qcf4/hafs/QCF4_Hafs_01_W.ttf
 */
export async function loadQCF4Font(p: number, variant: "Hafs" | "Warsh" = "Hafs"): Promise<void> {
  const name = qcf4FontName(p, variant);
  if (_loaded.has(name) || typeof document === "undefined") return;
  const base = process.env.NEXT_PUBLIC_QCF4_FONTS_BASE_URL ?? "/fonts/qcf4";
  const url = `${base}/${variant.toLowerCase()}/${name}.ttf`;
  try {
    const face = new FontFace(name, `url(${url})`);
    await face.load();
    document.fonts.add(face);
    _loaded.add(name);
  } catch (e) {
    console.warn(`QCF4: could not load font ${name} from ${url}`, e);
  }
}

/** Load all font groups required to display the given lines. */
export async function loadQCF4FontsForPage(
  lines: QCF4Line[],
  variant: "Hafs" | "Warsh" = "Hafs"
): Promise<void> {
  const groups = new Set<number>();
  for (const line of lines) {
    for (const word of line.words) groups.add(word.p);
  }
  await Promise.all([...groups].map((p) => loadQCF4Font(p, variant)));
}
