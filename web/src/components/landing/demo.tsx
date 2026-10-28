"use client";

import { useState } from "react";
import Image from "next/image";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const code = `import { Router } from "express";
import { verifyToken } from "./tokens";
import { db } from "../db";

export const auth = Router();

auth.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(email);
  if (!user || !(await user.checkPassword(password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  res.json({ token: user.issueToken() });
});

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).end();
  req.userId = payload.sub;
  next();
}`.split("\n");

// Answers use `backticks` for inline code; lines are 1-indexed
const examples = [
  {
    question: "Where is login handled?",
    answer:
      "In `auth.post(\"/login\")`. It looks up the user by email, checks the password, and returns a token from `user.issueToken()`. Bad credentials get a 401.",
    lines: [7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    question: "How are routes protected?",
    answer:
      "With the `requireAuth` middleware. It reads the bearer token from the Authorization header, verifies it with `verifyToken`, and sets `req.userId` before calling `next()`.",
    lines: [16, 17, 18, 19, 20, 21, 22],
  },
  {
    question: "Where do tokens come from?",
    answer:
      "They're created by `user.issueToken()` after a successful login, and checked by `verifyToken`, which is imported from `./tokens`.",
    lines: [2, 13, 18],
  },
];

const keyword =
  /("[^"]*"|\b(?:import|from|export|const|async|await|return|if|function)\b)/;

function CodeLine({ text }: { text: string }) {
  return (
    <>
      {text.split(keyword).map((part, i) =>
        part.startsWith('"') ? (
          <span key={i} className="text-amber-700 dark:text-amber-200/80">
            {part}
          </span>
        ) : keyword.test(part) ? (
          <span key={i} className="text-accent">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Answer({ text }: { text: string }) {
  return (
    <>
      {text.split(/`([^`]+)`/).map((part, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] text-accent">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function Demo() {
  const [active, setActive] = useState(0);
  const example = examples[active];

  return (
    <div className="rounded-md border border-border bg-card/40 overflow-hidden">
      {/* Window bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm text-muted-foreground">
        <Image src="/codecompass.png" alt="" width={16} height={16} className="h-4 w-4" />
        <span>test</span>
        <span>/</span>
        <span className="text-foreground">api-server</span>
      </div>

      <div className="grid lg:grid-cols-2">
        {/* Chat */}
        <div className="flex flex-col border-b lg:border-b-0 lg:border-r border-border p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {examples.map(({ question }, i) => (
              <button
                key={question}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent",
                  i === active
                    ? "border-accent/60 bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {question}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4 text-sm" aria-live="polite">
            <p className="ml-auto w-fit max-w-[85%] rounded-md bg-muted px-3 py-2">
              {example.question}
            </p>
            <p className="leading-relaxed text-muted-foreground">
              <Answer text={example.answer} />
            </p>
          </div>

          <div className="mt-auto pt-8">
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm text-muted-foreground">
              Ask CodeCompass
              <SendHorizontal className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Code */}
        <div className="min-w-0">
          <div className="border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">
            src/server/auth.ts
          </div>
          <pre className="overflow-x-auto py-3 font-mono text-xs leading-6">
            {code.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "flex pr-4 transition-colors",
                  example.lines.includes(i + 1) && "bg-accent/10",
                )}
              >
                <span
                  className={cn(
                    "w-10 shrink-0 select-none pr-3 text-right",
                    example.lines.includes(i + 1)
                      ? "text-accent"
                      : "text-muted-foreground/50",
                  )}
                >
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  <CodeLine text={line} />
                </span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
