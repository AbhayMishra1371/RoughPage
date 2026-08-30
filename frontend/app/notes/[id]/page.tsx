import NotebookViewer from "@/components/NotebookViewer";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="pt-4">
      <NotebookViewer id={id} />
    </div>
  );
}
