/* eslint-disable @typescript-eslint/no-require-imports */
// Self-check for src/lib/repoHref.ts: node scripts/checkRepoHref.js
const ts = require("typescript"), fs = require("fs"), path = require("path"), os = require("os");
const assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../src/lib/repoHref.ts"), "utf8");
const out = path.join(os.tmpdir(), "repo-href.check.js");
fs.writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText);
const { githubSlug, repoHref, providerRepoPath } = require(out);

const id = "94a8d5c8";
assert.deepStrictEqual(githubSlug("https://github.com/nickolastran/portfolio"), ["nickolastran", "portfolio"]);
assert.deepStrictEqual(githubSlug("https://github.com/a/b.git"), ["a", "b"]);
assert.deepStrictEqual(githubSlug("https://github.com/a/b/"), ["a", "b"]);
assert.deepStrictEqual(githubSlug("https://www.github.com/A/my.repo"), ["A", "my.repo"]);
assert.strictEqual(githubSlug("https://gitlab.com/a/b"), null);
assert.strictEqual(githubSlug("https://github.com/a/b/tree/main"), null);
assert.strictEqual(githubSlug(null), null);
assert.strictEqual(githubSlug("https://github.com/org/b"), null); // reserved owner
assert.strictEqual(repoHref({ id, repo_url: "https://github.com/nickolastran/portfolio" }), "/dashboard/nickolastran/portfolio");
assert.strictEqual(repoHref({ id, repo_url: null }), `/dashboard/repo/${id}`);
assert.strictEqual(repoHref({ id, repo_url: "https://github.com/new/x" }), `/dashboard/repo/${id}`);
assert.strictEqual(providerRepoPath("gitlab", "https://gitlab.com/g/sub/repo"), "g/sub/repo");
assert.strictEqual(providerRepoPath("gitlab", "https://gitlab.com/g/repo/-/tree/main?x=1"), "g/repo");
assert.strictEqual(providerRepoPath("gitlab", "git@gitlab.com:g/repo.git"), "g/repo");
assert.strictEqual(providerRepoPath("gitlab", "https://gitlab.com/g"), null);
assert.strictEqual(providerRepoPath("gitlab", "https://github.com/a/b"), null);
assert.strictEqual(providerRepoPath("bitbucket", "https://bitbucket.org/ws/repo/src/main/"), "ws/repo");
assert.strictEqual(providerRepoPath("bitbucket", "https://user@bitbucket.org/ws/repo.git"), "ws/repo");
assert.strictEqual(providerRepoPath("bitbucket", "git@bitbucket.org:ws/repo.git"), "ws/repo");
assert.strictEqual(providerRepoPath("bitbucket", "https://gitlab.com/a/b"), null);
console.log("repo-href checks ok");
