import type { Metadata } from "next";
import { DashboardNavbar } from "@/components/dashboard/navbar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboardSidebar";
import { DashboardProvider } from "./dashboardProvider";
import { User } from "@/app/types/supabase";
import { ScrollArea } from "@/components/dashboard/scrollArea";

export const metadata: Metadata = {
  // A plain string title would drop the root template for every dashboard page
  title: { default: "Dashboard", template: "%s | CodeCompass" },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected route
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardProvider initialUser={user as User}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <DashboardNavbar />
        <div className="flex flex-1 overflow-hidden">
          <DashboardSidebar />
          <ScrollArea>{children}</ScrollArea>
        </div>
      </div>
    </DashboardProvider>
  );
}
