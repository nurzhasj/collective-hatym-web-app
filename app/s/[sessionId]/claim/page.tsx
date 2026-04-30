import ClaimClient from "@/components/ClaimClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ auto?: string; more?: string }>;
};

export default async function ClaimPage({ params, searchParams }: Props) {
  const { sessionId } = await params;
  const query = await searchParams;
  const autoClaim = query.auto === "1" || query.more === "1";
  return <ClaimClient sessionId={sessionId} autoClaim={autoClaim} />;
}
