import Link from "next/link";
import DayimLogo from "@/components/DayimLogo";

const actions = [
  {
    href: "/kiosk/new",
    label: "Жаңа хатым бастау",
    image: "/figma/mushaf-1.png",
    imageClassName: "scale-[1.65] object-[62%_48%]"
  },
  {
    href: "/kiosk/list",
    label: "Хатымдар тізімі",
    image: "/figma/mushaf-2.png",
    imageClassName: "scale-[1.5] object-[62%_43%]"
  }
];

function HomeHeader() {
  return (
    <header className="relative z-20 h-[72px] bg-white shadow-[0_1px_0_rgba(54,66,132,0.08)] sm:h-[102px]">
      <div className="mx-auto flex h-full max-w-[1216px] items-center justify-between px-5 lg:px-8">
        <DayimLogo />
        <nav className="hidden items-center gap-[54px] text-[20px] font-semibold leading-none text-figma-blue md:flex">
          <Link href="/kiosk/new" className="transition hover:opacity-70">
            Жаңа хатым
          </Link>
          <Link href="/kiosk/list" className="transition hover:opacity-70">
            Хатымдар тізімі
          </Link>
          <Link href="/" className="transition hover:opacity-70">
            Басты бет
          </Link>
        </nav>
      </div>
    </header>
  );
}

function ActionButton({ href, label, image, imageClassName }: (typeof actions)[number]) {
  return (
    <Link
      href={href}
      className="group flex h-[50px] w-full max-w-[410px] items-center rounded-full bg-white px-5 text-[18px] font-bold text-[#00008e] shadow-[0_10px_24px_rgba(11,18,83,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,18,83,0.18)] sm:h-[48px] sm:text-[22px]"
    >
      <span className="relative mr-4 h-[34px] w-[34px] shrink-0 overflow-hidden rounded-[7px]">
        <img alt="" className={`h-full w-full object-cover ${imageClassName}`} src={image} />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="ml-4 text-[28px] font-normal leading-none text-[#9ba2ff] transition group-hover:translate-x-1">›</span>
    </Link>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-figma-blue text-white">
      <div className="min-h-screen overflow-hidden bg-figma-blue">
        <HomeHeader />

        <section className="relative min-h-[calc(100svh-72px)] overflow-hidden bg-figma-blue sm:min-h-[calc(100svh-102px)]">
          <img
            alt=""
            className="pointer-events-none absolute bottom-[-118px] right-[-235px] w-[680px] max-w-none opacity-40 md:bottom-auto md:right-[-110px] md:top-0 md:w-[760px] md:opacity-100 lg:right-[-42px] lg:w-[820px] xl:right-0 xl:w-[900px]"
            src="/figma/mushaf-2.png"
          />

          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-72px)] max-w-[1216px] flex-col justify-center px-5 py-12 sm:min-h-[calc(100svh-102px)] sm:justify-start sm:py-0 lg:px-8">
            <div className="max-w-[555px] sm:pt-[136px] lg:pt-[156px]">
              <h1 className="text-[44px] font-semibold uppercase leading-[1.08] tracking-[0] text-white sm:text-[68px]">
                Құран хатым
              </h1>

              <p className="mt-9 max-w-[525px] text-[19px] font-medium leading-[1.45] tracking-[0] text-white sm:text-[24px]">
                Хадис шәрифте: «Адамдардың ең жақсысы - хатымды бітіргеннен кейін қайтадан бастаған адам», - делінген.
              </p>

              <div className="mt-[76px] grid gap-[26px]">
                {actions.map((action) => (
                  <ActionButton key={action.href} {...action} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
