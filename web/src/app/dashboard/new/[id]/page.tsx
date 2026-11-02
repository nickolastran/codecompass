import type { Metadata } from "next";
import { NewProjectForm } from "@/components/dashboard/repos/new-repo-form";

export const metadata: Metadata = { title: "New Repository" };

type NewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NewPage({ params }: NewPageProps) {
  const { id } = await params;

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <NewProjectForm orgId={id} />
    </div>
  );
}
