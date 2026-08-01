import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Github } from "lucide-react";
import Link from "next/link";

type InstallGithubAppPageProps = {
  searchParams: Promise<{ org_id?: string }>;
};

export default async function InstallGithubAppPage({
  searchParams,
}: InstallGithubAppPageProps) {
  const { org_id } = await searchParams;

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/installation${org_id ? `?org_id=${org_id}` : ""}`;
  const githubInstallUrl = `https://github.com/apps/codecompass-app/installations/new?state=${encodeURIComponent(redirectUrl)}`;

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-muted p-4">
            <Github className="h-12 w-12" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Install GitHub App</h1>
            <p className="text-muted-foreground">
              To import repositories from GitHub, you need to install the
              CodeCompass GitHub App. This will allow us to access your
              repositories and generate documentation. (Hint: Select &apos;All
              Repositories&apos; when installing to avoid having to grant access
              to one repository at a time.)
            </p>
          </div>

          <div className="space-y-4 w-full">
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
              <p className="font-medium">The app will request permission to:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Read repository contents</li>
                <li>Access repository metadata</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full">
                <a href={githubInstallUrl}>
                  <Github className="mr-2 h-5 w-5" />
                  Install GitHub App
                </a>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full">
                <Link
                  href={
                    org_id
                      ? `/dashboard/new/${org_id}`
                      : "/dashboard/organizations"
                  }
                >
                  Cancel
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
