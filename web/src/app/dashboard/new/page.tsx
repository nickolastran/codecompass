import type { Metadata } from "next";
import { NewOrganizationForm } from "@/components/dashboard/organizations/new-organization-form";

export const metadata: Metadata = { title: "New Organization" };

export default function NewOrganizationPage() {
  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <NewOrganizationForm />
    </div>
  );
}
