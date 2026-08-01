// src/lib/github/app.ts
import { App } from "@octokit/app";
import fs from "fs";

// Initialize GitHub App
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY_PATH
  ? fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8")
  : process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";

export const githubApp = new App({
  appId: process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID!,
  privateKey,
  oauth: {
    clientId: process.env.GITHUB_APP_CLIENT_ID!,
    clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
  },
});

/**
 * Generate an installation access token (valid for 1 hour)
 */
export async function getInstallationToken(
  installationId: number,
): Promise<string> {
  const octokit = await githubApp.getInstallationOctokit(installationId);

  const { data } = await octokit.request(
    "POST /app/installations/{installation_id}/access_tokens",
    {
      installation_id: installationId,
    },
  );

  return data.token;
}

/**
 * Get installation for a specific user/org
 */
export async function getInstallationByAccount(accountLogin: string) {
  try {
    const octokit = await githubApp.octokit;
    const { data: installation } = await octokit.request(
      "GET /users/{username}/installation",
      {
        username: accountLogin,
      },
    );
    return installation;
  } catch (error) {
    return null;
  }
}

/**
 * Check if a repo is accessible by an installation
 */
export async function checkRepoAccess(
  installationId: number,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    const octokit = await githubApp.getInstallationOctokit(installationId);
    await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    return true;
  } catch (error) {
    return false;
  }
}
