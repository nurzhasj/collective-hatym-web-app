import KioskClient from "@/components/KioskClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function KioskPage({ params }: Props) {
  const { sessionId } = await params;
  return <KioskClient sessionId={sessionId} />;
}
