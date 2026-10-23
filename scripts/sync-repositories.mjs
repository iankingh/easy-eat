// No credentials are stored. Supply the native Sites credential as one JSON line on stdin.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
export function syncPlan(head, github, sites, ancestor) {
  if (ancestor(github, head) && ancestor(sites, head))
    return { target: head, fastForward: false, publishable: true };
  let newest;
  if (ancestor(github, sites)) newest = sites;
  else if (ancestor(sites, github)) newest = github;
  else
    throw new Error(
      "GitHub 與 Sites 的歷史已分歧；請先合併並解決衝突，不會覆蓋任一端。",
    );
  if (ancestor(head, newest))
    return {
      target: newest,
      fastForward: head !== newest,
      publishable: head === newest,
    };
  if (ancestor(newest, head))
    return { target: head, fastForward: false, publishable: true };
  throw new Error("本機與遠端已分歧；請先合併並解決衝突，不會覆蓋任一端。");
}
async function credentialInput() {
  if (process.stdin.isTTY) {
    process.stderr.write(
      "Ready for Sites credential JSON on stdin (input is hidden).\n",
    );
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding("utf8");
  let value = "";
  for await (const chunk of process.stdin) {
    value += chunk;
    if (value.includes("\u0003")) throw new Error("已取消。");
    if (/[\r\n]/.test(value)) break;
  }
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
  const parsed = JSON.parse(value.trim());
  return parsed.credential || parsed;
}
async function main() {
  const verb = process.argv[2];
  if (!["status", "pull", "push"].includes(verb))
    throw new Error(
      "Usage: node scripts/sync-repositories.mjs status|pull|push",
    );
  const root = path.resolve(import.meta.dirname, ".."),
    link = JSON.parse(
      readFileSync(path.join(root, ".openai/repository-link.json")),
    );
  const credential = await credentialInput();
  if (
    credential.remote_url !== link.site_source_remote ||
    credential.branch !== link.branch
  )
    throw new Error("憑證與本專案 Sites ID／分支不符。");
  if (!["http_extra_header", "work_proxy"].includes(credential.auth_mode))
    throw new Error("需要 Sites 原生工具回傳的 Git 憑證。");
  if (
    credential.auth_mode === "http_extra_header" &&
    (typeof credential.token !== "string" ||
      !credential.token ||
      /[\r\n\0]/.test(credential.token))
  )
    throw new Error("Sites 憑證格式不正確。");
  if (
    credential.token_expires_at &&
    Date.parse(credential.token_expires_at) <= Date.now()
  )
    throw new Error("Sites 憑證已過期，請透過原生工具重新取得。");
  const scrub = (value) =>
    String(value)
      .split(credential.token || "\u0000")
      .join("[redacted]");
  const git = (args, remote = false, allowFailure = false) => {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
    for (const key of Object.keys(env))
      if (key.startsWith("GIT_TRACE") || key === "GIT_CURL_VERBOSE")
        delete env[key];
    const flags = remote
      ? [
          "-c",
          "credential.helper=",
          "-c",
          "http.extraHeader=",
          "-c",
          "http.followRedirects=false",
        ]
      : [];
    if (remote && credential.auth_mode === "http_extra_header") {
      env.EASY_EAT_SITES_AUTH = `Authorization: Bearer ${credential.token}`;
      flags.push(
        `--config-env=http.${credential.remote_url}.extraHeader=EASY_EAT_SITES_AUTH`,
      );
    }
    const result = spawnSync("git", [...flags, ...args], {
      cwd: root,
      env,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (result.error) throw new Error("無法執行 Git。");
    if (result.status !== 0 && !allowFailure)
      throw new Error(scrub(result.stderr || "Git 操作未完成。"));
    return { ok: result.status === 0, output: result.stdout.trim() };
  };
  if (git(["symbolic-ref", "--short", "HEAD"]).output !== link.branch)
    throw new Error("請先切換到 main，再執行同步。");
  if (git(["status", "--porcelain"]).output)
    throw new Error("本機有尚未提交的修改，請先保留或提交，再同步。");
  const origin = git(["remote", "get-url", "origin"]).output;
  if (
    origin !== link.github &&
    origin !== "git@github.com:iankingh/easy-eat.git"
  )
    throw new Error("origin 與連結的 GitHub 專案不符。");
  const rewritten = git([
    "ls-remote",
    "--get-url",
    credential.remote_url,
  ]).output;
  if (rewritten !== credential.remote_url)
    throw new Error("Sites remote URL 被 Git 設定改寫，已停止同步。");
  git([
    "fetch",
    "--no-tags",
    "origin",
    `+refs/heads/${link.branch}:refs/remotes/origin/${link.branch}`,
  ]);
  git(
    [
      "fetch",
      "--no-tags",
      credential.remote_url,
      `+refs/heads/${link.branch}:refs/remotes/sites/${link.branch}`,
    ],
    true,
  );
  const head = git(["rev-parse", "HEAD"]).output,
    github = git(["rev-parse", `refs/remotes/origin/${link.branch}`]).output,
    sites = git(["rev-parse", `refs/remotes/sites/${link.branch}`]).output;
  const ancestor = (a, b) =>
    git(["merge-base", "--is-ancestor", a, b], false, true).ok;
  const plan = syncPlan(head, github, sites, ancestor);
  if (verb === "status") {
    console.log(
      JSON.stringify(
        {
          head,
          github,
          sites,
          ...plan,
          synchronized: head === github && head === sites,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (verb === "pull") {
    if (plan.fastForward) git(["merge", "--ff-only", plan.target]);
    console.log(
      `已取回兩端最新原始碼：${git(["rev-parse", "HEAD"]).output}。尚未發布網站。`,
    );
    return;
  }
  if (plan.fastForward)
    throw new Error("遠端有較新提交，請先執行 sync:pull，再檢查與測試。");
  // Each push uses Git's normal fast-forward check. Never force-push either repository.
  git(["push", "origin", `HEAD:refs/heads/${link.branch}`]);
  try {
    git(
      ["push", credential.remote_url, `HEAD:refs/heads/${link.branch}`],
      true,
    );
  } catch (error) {
    throw new Error(
      `GitHub 已推送；Sites 尚未確認同步。請保留本機提交，重新讀取兩端狀態後重試。${error.message}`,
    );
  }
  const githubAfter = git([
    "ls-remote",
    "origin",
    `refs/heads/${link.branch}`,
  ]).output.split(/\s/)[0];
  const sitesAfter = git(
    ["ls-remote", credential.remote_url, `refs/heads/${link.branch}`],
    true,
  ).output.split(/\s/)[0];
  if (githubAfter !== head || sitesAfter !== head)
    throw new Error("推送後遠端再次變動，請重新檢查兩端狀態。");
  console.log(
    JSON.stringify(
      {
        synchronized: true,
        commit: head,
        github: link.github,
        sites: link.project_id,
        deployed: false,
      },
      null,
      2,
    ),
  );
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
