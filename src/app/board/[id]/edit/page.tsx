import { notFound } from "next/navigation";
import { EditorView } from "../../../../components/editor-view";
import { plannerClient } from "../../../../lib/planner-client";

export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const plan = await plannerClient.getPlan(id);
  if (!plan) notFound();
  return <EditorView plan={plan} />;
}
