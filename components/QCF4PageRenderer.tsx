"use client";

import { useEffect, useState } from "react";
import { QCF4Line, QCF4PageData, QCF4Word, qcf4FontName, loadQCF4FontsForPage } from "@/lib/qcf4";

interface Props {
  data: QCF4PageData;
  variant?: "Hafs" | "Warsh";
  className?: string;
}

function WordSpan({ word, variant }: { word: QCF4Word; variant: "Hafs" | "Warsh" }) {
  return (
    <span style={{ fontFamily: `"${qcf4FontName(word.p, variant)}"` }}>
      {String.fromCodePoint(word.c)}
    </span>
  );
}

function QCF4Line({ line, variant }: { line: QCF4Line; variant: "Hafs" | "Warsh" }) {
  const type = line.type?.toLowerCase() ?? "verse";
  const isHeader = type === "header" || type === "surah_name" || type === "chapter_name";
  const isBismillah = type === "bismillah" || type === "basmala";

  const words = line.words.map((word, i) => (
    <span key={i}>
      <WordSpan word={word} variant={variant} />
      {i < line.words.length - 1 ? " " : ""}
    </span>
  ));

  if (isHeader) {
    return (
      <div className="flex justify-center py-2">
        <div className="rounded-full border border-slate-300/80 bg-white/90 px-8 py-2 text-center shadow-sm dark:border-white/30 dark:bg-white/5">
          <span style={{ fontSize: "2rem" }}>{words}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={isBismillah ? "text-center" : "text-right"}
      style={{ fontSize: isBismillah ? "2.2rem" : "2rem", lineHeight: "3rem" }}
    >
      {words}
    </div>
  );
}

export default function QCF4PageRenderer({ data, variant = "Hafs", className }: Props) {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    setFontsReady(false);
    loadQCF4FontsForPage(data.lines, variant).then(() => {
      if (alive) setFontsReady(true);
    });
    return () => {
      alive = false;
    };
  }, [data, variant]);

  return (
    <div
      dir="rtl"
      lang="ar"
      className={className}
      style={{ opacity: fontsReady ? 1 : 0.08, transition: "opacity 0.3s ease" }}
    >
      {data.lines.map((line, i) => (
        <QCF4Line key={i} line={line} variant={variant} />
      ))}
    </div>
  );
}
