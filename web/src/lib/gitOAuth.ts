import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { providerRepoPath } from "@/lib/repoHref";

// OAuth apps used to read GitLab / Bitbucket repos (separate from Supabase sign-in)
export const OAUTH = {
  gitlab: {
    label: "GitLab",
    table: "gitlab_installations",
    clientId: process.env.NEXT_PUBLIC_GITLAB_APP_CLIENT_ID,
    secret: process.env.GITLAB_APP_SECRET,
    authorizeUrl: "https://gitlab.com/oauth/authorize",
    tokenUrl: "https://gitlab.com/oauth/token",
  },
  bitbucket: {
    label: "Bitbucket",
    table: "bitbucket_installations",
    clientId: process.env.BITBUCKET_APP_CLIENT_ID,
    secret: process.env.BITBUCKET_APP_SECRET,
    authorizeUrl: "https://bitbucket.org/site/oauth2/authorize",
    tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
  },
};

export type OAuthProvider = keyof typeof OAUTH;

export const isOAuthProvider = (p: string): p is OAuthProvider =>
  Object.hasOwn(OAUTH, p);

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL;
const redirectUri = (provider: OAuthProvider) =>
  `${appUrl()}/api/${provider}/installation`;

export function authorizeUrl(provider: OAuthProvider, orgId?: string) {
  const params = new URLSearchParams({
    client_id: OAUTH[provider].clientId ?? "",
    response_type: "code",
    state: JSON.stringify({ org_id: orgId ?? null }),
    // Picks which of the OAuth client's registered callback URLs to return to (localhost vs prod)
    redirect_uri: redirectUri(provider),
  });
  // Bitbucket uses the OAuth client's scopes instead
  if (provider === "gitlab") params.set("scope", "read_api read_repository");
  return `${OAUTH[provider].authorizeUrl}?${params}`;
}

async function requestToken(
  provider: OAuthProvider,
  params: Record<string, string>,
): Promise<{ access_token: string; refresh_token?: string } | null> {
  const { clientId, secret, tokenUrl } = OAUTH[provider];
  params.redirect_uri = redirectUri(provider);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });

  if (!res.ok) {
    console.error(`${provider} token request failed:`, await res.text());
    return null;
  }
  return res.json();
}

// Fresh access token for the current user, or null if they need to (re)connect.
// ponytail: refreshes on every call (GitLab/Bitbucket tokens expire after 2h); store expires_at if the round-trip matters
export async function getProviderToken(
  provider: OAuthProvider,
): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { table } = OAUTH[provider];
  const { data: row } = await supabase
    .from(table)
    .select("refresh_token")
    .eq("installed_by", user.id)
    .maybeSingle();
  if (!row?.refresh_token) return null;

  const tokens = await requestToken(provider, {
    grant_type: "refresh_token",
    refresh_token: row.refresh_token,
  });
  if (!tokens) return null;

  await supabase
    .from(table)
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
    })
    .eq("installed_by", user.id);

  return tokens.access_token;
}

// Canonical web URL of a repo the token can read, or null
export async function lookupRepo(
  provider: OAuthProvider,
  url: string,
  token: string,
): Promise<string | null> {
  const path = providerRepoPath(provider, url);
  if (!path) return null;

  const api =
    provider === "gitlab"
      ? `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}`
      : `https://api.bitbucket.org/2.0/repositories/${path}`;

  const res = await fetch(api, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  return provider === "gitlab" ? data.web_url : data.links.html.href;
}

// GET handler for /api/<provider>/installation (the OAuth redirect)
export function oauthCallback(provider: OAuthProvider) {
  return async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    let orgId: string | null = null;
    try {
      orgId = JSON.parse(searchParams.get("state") ?? "{}").org_id ?? null;
    } catch {}

    const fail = (message: string) =>
      NextResponse.redirect(`${appUrl()}/error?message=${message}`);

    if (!code) return fail(`${provider}_auth_failed`);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(`${appUrl()}/login`);

    const tokens = await requestToken(provider, {
      grant_type: "authorization_code",
      code,
    });
    if (!tokens) return fail("token_exchange_failed");

    // One connection per user; reconnecting replaces it
    const { table } = OAUTH[provider];
    await supabase.from(table).delete().eq("installed_by", user.id);
    const { error } = await supabase.from(table).insert({
      installed_by: user.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
    if (error) {
      console.error(error);
      return fail("installation_failed");
    }

    if (!orgId) return NextResponse.redirect(`${appUrl()}/dashboard/organizations`);
    const org = encodeURIComponent(orgId);
    return NextResponse.redirect(
      provider === "gitlab"
        ? `${appUrl()}/dashboard/org/${org}/gitlab/select-repos`
        : `${appUrl()}/dashboard/new/${org}`,
    );
  };
}
