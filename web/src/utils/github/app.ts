
import { App } from "@octokit/app";
import fs from "fs";

let app: App | undefined;

// Lazily built so a missing GITHUB_APP_* env can't break "next build".
export function githubApp(): App {
  return (app ??= new App({
    appId: process.env.NEXT_PUBLIC_GITHUB_APP_CLIENT_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY_PATH
      ? fs.readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, "utf8")
      : process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    oauth: {
      clientId: process.env.GITHUB_APP_CLIENT_ID!,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
    },
  }));
}
