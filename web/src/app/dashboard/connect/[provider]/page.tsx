import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Gitlab } from "@geist-ui/icons";
import { BitbucketIcon } from "@/components/bitbucketIcon";
import Link from "next/link";
import { OAUTH, authorizeUrl, isOAuthProvider } from "@/lib/gitOAuth";

const ICONS = { gitlab: Gitlab, bitbucket: BitbucketIcon };

type ConnectPageProps = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ org_id?: string }>;
};

export async function generateMetadata({
  params,
}: ConnectPageProps): Promise<Metadata> {
  const { provider } = await params;
  return {
    title: isOAuthProvider(provider) ? `Connect ${OAUTH[provider].label}` : "Connect",
  };
}

export default async function ConnectProviderPage({
  params,
  searchParams,
}: ConnectPageProps) {
  const { provider } = await params;
  const { org_id } = await searchParams;
  if (!isOAuthProvider(provider)) notFound();

  const { label } = OAUTH[provider];
  const Icon = ICONS[provider];

  return (
    <div className="container mx-auto py-16 px-4 max-w-2xl">
      <Card className="p-8">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="rounded-full bg-muted p-4">
            <Icon className="h-12 w-12" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              Authenticate using {label}
            </h1>
            <p className="text-muted-foreground">
              To import repositories from {label}, you need to verify using{" "}
              {label}. This will allow us to access your repositories and
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
                <a href={authorizeUrl(provider, org_id)}>
                  <Icon className="mr-2 h-5 w-5" />
                  Login with {label}
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
