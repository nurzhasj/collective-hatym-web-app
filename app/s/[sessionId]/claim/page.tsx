import ClaimClient from "@/components/ClaimClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default async function ClaimPage({ params }: Props) {
  const { sessionId } = await params;
  return <ClaimClient sessionId={sessionId} />;
}
