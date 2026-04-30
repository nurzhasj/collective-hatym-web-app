import Link from "next/link";

type DayimLogoProps = {
  href?: string;
  tone?: "blue" | "white";
  className?: string;
};

export default function DayimLogo({ href = "/", tone = "blue", className = "" }: DayimLogoProps) {
  const isWhite = tone === "white";

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 ${isWhite ? "text-white" : "text-figma-blue"} ${className}`}
    >
      <img
        alt=""
        className={`h-[28px] w-[55px] sm:h-[31px] sm:w-[61px] ${isWhite ? "brightness-0 invert" : ""}`}
        src="/figma/dayim-logo.svg"
      />
      <span className="text-[24px] font-bold leading-[30px] sm:text-[28px] sm:leading-[34px]">DAYIM</span>
    </Link>
  );
}
