import ReaderClient from "@/components/ReaderClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string; pageNumber: string }>;
};

export default async function ReadPage({ params }: Props) {
  const { sessionId, pageNumber: pageParam } = await params;
  const pageNumber = Number(pageParam);
  if (!Number.isFinite(pageNumber)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-hatym-ink">
        Invalid page number.
      </div>
    );
  }
  return <ReaderClient sessionId={sessionId} pageNumber={pageNumber} />;
}
