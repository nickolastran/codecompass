import LandingPage from "@/components/landing/landing-page";
import Navbar from "@/components/landing/navbar";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = !!user;

  // Show landing page for both authenticated and unauthenticated users
  return (
    <div className="bg-gray-50 dark:bg-gray-900">
      <Navbar isAuthenticated={isAuthenticated} />
      <LandingPage isAuthenticated={isAuthenticated} />
    </div>
  );
}
