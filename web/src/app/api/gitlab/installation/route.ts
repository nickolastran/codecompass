import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");
  const supabase = await createClient();

  if (error) {
    return NextResponse.redirect("/error?message=gitlab_auth_failed");
  }

  // Parse state parameter to get org_id
  let orgId: string | null = null;
  if (state) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      orgId = stateData.org_id || null;
    } catch (e) {
      console.error("Failed to parse state parameter:", e);
    }
  }

  //exchange code for token

  const tokenResponse = await fetch("https://gitlab.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_GITLAB_APP_CLIENT_ID,
      client_secret: process.env.GITLAB_APP_SECRET,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/gitlab/installation`,
    }),
  });

  if (!tokenResponse.ok) {
    console.error(await tokenResponse.text());
    return NextResponse.redirect("/error?message=token_exchange_failed");
  }

  const { access_token, refresh_token } = await tokenResponse.json();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: access_token_error } = await supabase
    .from("gitlab_installations")
    .insert({
      access_token,
      refresh_token,
      installed_by: user.id,
    });

  if (access_token_error) {
    console.error(access_token_error);
    return NextResponse.redirect("/error?message=installation_failed");
  }

  // Store projects info or redirect to selection UI
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/org/${orgId}/gitlab/select-repos`,
  );
}
