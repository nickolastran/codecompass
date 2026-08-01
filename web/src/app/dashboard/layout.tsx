import { DashboardNavbar } from "@/components/dashboard/navbar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardProvider } from "./dashboard-provider";
import { User } from "@/app/types/supabase";
import { ScrollArea } from "@/components/dashboard/scroll-area";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  //protected route
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
