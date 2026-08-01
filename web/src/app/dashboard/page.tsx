"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "./dashboard-provider";
import { usePrefetchRoute } from "@/hooks/usePrefetchRoute";

export default function DashboardPage() {
  const { user } = useAuth();
  const { prefetchOrganizationsPage } = usePrefetchRoute();

  return (
    <div className="container py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Welcome to CodeCompass
          </h1>
          <p className="text-muted-foreground">
            Logged in as: <span className="text-foreground">{user?.email}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link href="/dashboard/organizations" prefetch={true}>
            <div
              className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer"
              onMouseEnter={() => prefetchOrganizationsPage()}
            >
              <h2 className="text-xl font-semibold text-card-foreground mb-2">
                Organizations
              </h2>
              <p className="text-muted-foreground mb-4">
                Manage your organizations and teams
              </p>
              <Button variant="outline">View Organizations</Button>
            </div>
          </Link>

          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary transition-colors cursor-pointer opacity-50">
            <h2 className="text-xl font-semibold text-card-foreground mb-2">
              Projects
            </h2>
            <p className="text-muted-foreground mb-4">
              Browse and manage your projects
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-card-foreground mb-4">
            Recent Activity
          </h2>
          <p className="text-muted-foreground">
            No recent activity to display.
          </p>
        </div>
      </div>
    </div>
  );
}
