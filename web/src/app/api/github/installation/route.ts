// src/app/api/github/installation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { githubApp } from "@/utils/github/app";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { installation_id, action, repositories, sender } = body;

  // Handle installation events
  if (action === "created") {
    // Store new installation
    const { error } = await supabase.from("github_installations").upsert({
      installation_id,
      account_login: sender.login,
      account_type: sender.type,
      installed_by: user.id,
      repositories_access: repositories ? "selected" : "all",
    });

    if (error) {
      console.error("Failed to store installation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === "deleted") {
    // Remove installation
    await supabase
      .from("github_installations")
      .delete()
      .eq("installation_id", installation_id);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: true });
}

// Handle GitHub webhook events (installation lifecycle)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const installation_id = searchParams.get("installation_id");
  const setup_action = searchParams.get("setup_action");
  const org_id = searchParams.get("org_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const baseUrl = new URL(request.url).origin;
  const redirectBase = org_id
    ? `/dashboard/new/${org_id}`
    : "/dashboard/organizations";

  if (!user) {
    return NextResponse.redirect(
      new URL("/sign-in?error=unauthorized", baseUrl),
    );
  }

  if (setup_action === "install" && installation_id) {
    // Fetch installation details from GitHub
    try {
      const octokit = githubApp.octokit;
      const { data: installation } = await octokit.request(
        "GET /app/installations/{installation_id}",
        {
          installation_id: parseInt(installation_id),
        },
      );

      // Store installation
      const account = installation.account as { login: string; type: string };
      await supabase.from("github_installations").upsert({
        installation_id: installation.id,
        account_login: account.login,
        account_type: account.type,
        installed_by: user.id,
        repositories_access: installation.repository_selection,
      });

      // Redirect to success page
      return NextResponse.redirect(
        new URL(`${redirectBase}?github_app=installed`, baseUrl),
      );
    } catch (error) {
      console.error("Failed to process installation:", error);
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=installation_failed`, baseUrl),
      );
    }
  }

  return NextResponse.redirect(new URL(redirectBase, baseUrl));
}
