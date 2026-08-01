import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gitlab } from "@geist-ui/icons";
import Link from "next/link";

type InstallGitlabAppPageProps = {
  searchParams: Promise<{ org_id?: string }>;
};

export default async function InstallGitlabAppPage({
  searchParams,
}: InstallGitlabAppPageProps) {
  const { org_id } = await searchParams;

  const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/gitlab/installation`;

  // Build the GitLab OAuth URL with state parameter
  const stateParam = org_id
    ? encodeURIComponent(JSON.stringify({ org_id }))
    : "";
  const gitlabInstallUrl = `https://gitlab.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITLAB_APP_CLIENT_ID}&redirect_uri=${redirectUrl}&response_type=code&scope=read_api+read_repository${stateParam ? `&state=${stateParam}` : ""}`;

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-muted p-4">
            <Gitlab className="h-12 w-12" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              Authenticate using GitLab
            </h1>
            <p className="text-muted-foreground">
              To import repositories from GitLab, you need to verify using
              GitLab. This will allow us to access your repositories and
              generate documentation.
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
                <a href={gitlabInstallUrl}>
                  <Gitlab className="mr-2 h-5 w-5" />
                  Login with Gitlab
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
