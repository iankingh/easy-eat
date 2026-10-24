// Supply the short-lived native Sites credential through hidden stdin only.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createGithubClient, repositoryName } from "./github.mjs";

export function assertContentSyncSafe(
  localTree,
  sitesTree,
  baseTree,
  sitesIncluded = false,
) {
  if (sitesTree !== baseTree && localTree !== sitesTree && !sitesIncluded)
    throw new Error(
      "Sites 與 GitHub／本機都有不同修改，請先合併與測試；不會覆蓋任一端。",
    );
}
export function importSitesSnapshot(git, head, sites) {
  const tree = git(["rev-parse", `${sites}^{tree}`]).output;
  return git(
    ["commit-tree", tree, "-p", head, "-p", sites],
    false,
    false,
    `sync(sites): 取回點餐網站的原始碼修改\n\nSites-Commit: ${sites}\n`,
  ).output;
}
async function credentialInput() {
  if (process.stdin.isTTY) {
    process.stderr.write(
      "Ready for Sites credential JSON on stdin (input is hidden).\n",
    );
    process.stdin.setRawMode(true);
  }
  process.stdin.setEncoding("utf8");
  let input = "";
  try {
    for await (const chunk of process.stdin) {
      input += chunk;
      if (input.length > 65536) throw new Error("憑證輸入過長。");
      if (input.includes("\u0003")) throw new Error("已取消。");
      if (/[\r\n]/.test(input)) break;
    }
  } finally {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  const value = JSON.parse(input.trim());
  return value.credential || value;
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
    (!Number.isFinite(Date.parse(credential.token_expires_at)) ||
      Date.parse(credential.token_expires_at) <= Date.now())
  )
    throw new Error("Sites 憑證已過期，請重新取得。");
  const scrub = (value) =>
    String(value)
      .split(credential.token || "\u0000")
      .join("[redacted]");
  const git = (args, remote = false, allowFailure = false, input) => {
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
          "-c",
          "http.version=HTTP/1.1",
          "-c",
          "http.postBuffer=134217728",
          "-c",
          "http.lowSpeedLimit=1024",
          "-c",
          "http.lowSpeedTime=30",
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
      input,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 120000,
    });
    if (result.error)
      throw new Error(
        result.error.code === "ETIMEDOUT"
          ? "Git 連線逾時，請核對遠端狀態後重試。"
          : "無法執行 Git。",
      );
    if (result.status !== 0 && !allowFailure)
      throw new Error(scrub(result.stderr || "Git 操作未完成。"));
    return { ok: result.status === 0, output: result.stdout.trim() };
  };
  const result = syncRepositories({
    verb,
    git,
    link,
    api: createGithubClient(repositoryName(link)),
  });
  console.log(JSON.stringify(result, null, 2));
}

export function syncRepositories({ verb, git, link, api }) {
  const rev = (value) => git(["rev-parse", value]).output;
  const tree = (commit) => rev(`${commit}^{tree}`);
  const ancestor = (a, b) =>
    git(["merge-base", "--is-ancestor", a, b], false, true).ok;
  git(["symbolic-ref", "--short", "HEAD"]);
  if (git(["status", "--porcelain"]).output)
    throw new Error("本機有尚未提交的修改，請先保留或提交。");
  const origin = git(["remote", "get-url", "origin"]).output;
  if (
    origin !== link.github &&
    origin !== "git@github.com:iankingh/easy-eat.git"
  )
    throw new Error("origin 與連結的 GitHub 專案不符。");
  if (
    git(["ls-remote", "--get-url", link.site_source_remote]).output !==
    link.site_source_remote
  )
    throw new Error("Sites URL 被 Git 設定改寫，已停止。");
  process.stderr.write("正在讀取兩端最新提交…\n");
  git([
    "fetch",
    "--no-tags",
    "origin",
    `+refs/heads/${link.branch}:refs/remotes/origin/${link.branch}`,
  ]);
  const fetchSites = () =>
    git(
      [
        "fetch",
        "--no-tags",
        link.site_source_remote,
        `+refs/heads/${link.branch}:refs/remotes/sites/${link.branch}`,
      ],
      true,
    );
  fetchSites();
  let head = rev("HEAD");
  const github = rev(`refs/remotes/origin/${link.branch}`),
    sites = rev(`refs/remotes/sites/${link.branch}`);
  if (verb !== "status" && !ancestor(github, head)) {
    if (!ancestor(head, github))
      throw new Error("本機與 GitHub 歷史已分歧，請先合併。");
    if (verb === "pull" || verb === "push") {
      git(["merge", "--ff-only", github]);
      head = rev("HEAD");
    }
  }
  const anchor = git([
    "log",
    "-1",
    "--format=%H%n%B",
    "--grep=^GitHub-Commit:",
    sites,
  ]).output;
  const linkedGithub = anchor.match(/^GitHub-Commit: ([0-9a-f]{40})$/m)?.[1];
  let baseTree;
  if (linkedGithub) {
    if (!git(["cat-file", "-e", `${linkedGithub}^{commit}`], false, true).ok)
      throw new Error("找不到上次同步的 GitHub 版本，請先人工核對。");
    baseTree = tree(anchor.split("\n")[0]);
    if (baseTree !== tree(linkedGithub))
      throw new Error("上次同步的內容標記不一致，已停止。");
  } else {
    // First migration is allowed only from the recorded original Site or an already shared ancestor.
    if (sites !== link.imported_commit && !ancestor(sites, head))
      throw new Error("Sites 在初始化後另有修改，請先人工核對，不能覆蓋。");
    baseTree = tree(sites);
  }
  const localTree = tree(head),
    sitesTree = tree(sites);
  if (verb === "status") {
    return {
      githubCommit: github,
      localCommit: head,
      sitesCommit: sites,
      localTree,
      sitesTree,
      synchronized: head === github && localTree === sitesTree,
      deployed: false,
      state:
        head === github && localTree === sitesTree ? "synchronized" : "pending",
    };
  }
  if (verb === "pull") {
    if (
      sitesTree !== baseTree &&
      localTree !== sitesTree &&
      !ancestor(sites, head)
    ) {
      if (localTree !== baseTree)
        throw new Error("兩端都有不同內容，請先合併與測試；未修改本機檔案。");
      const imported = importSitesSnapshot(git, head, sites);
      git(["merge", "--ff-only", imported]);
      head = imported;
    }
    return {
      state: "pulled",
      localCommit: head,
      githubCommit: github,
      sitesCommit: sites,
      synchronized: head === github && tree(head) === sitesTree,
      deployed: false,
    };
  }
  assertContentSyncSafe(localTree, sitesTree, baseTree, ancestor(sites, head));
  if (head !== github) {
    const repository = repositoryName(link),
      prefix = `repos/${repository}`;
    const branch = `sync/${head.slice(0, 12)}`;
    git(["push", "origin", `${head}:refs/heads/${branch}`]);
    const prs = api(
      "GET",
      `${prefix}/pulls?state=open&base=${encodeURIComponent(link.branch)}&head=${encodeURIComponent(repository.split("/")[0] + ":" + branch)}`,
    );
    const pr =
      prs[0] ||
      api("POST", `${prefix}/pulls`, {
        title: "同步同事午餐團訂原始碼",
        head: branch,
        base: link.branch,
        body: `將提交 ${head} 經 PR 與 verify 檢查合併後，再同步 Sites。此次不部署網站。`,
      });
    return {
      state: "awaiting_merge",
      synchronized: false,
      deployed: false,
      githubCommit: github,
      localCommit: head,
      sitesCommit: sites,
      pullRequest: pr.html_url,
    };
  }
  // Re-read both refs immediately before the mutation. The Site push is also non-force.
  if (
    git(["ls-remote", "origin", `refs/heads/${link.branch}`]).output.split(
      /\s/,
    )[0] !== github ||
    git(
      ["ls-remote", link.site_source_remote, `refs/heads/${link.branch}`],
      true,
    ).output.split(/\s/)[0] !== sites
  )
    throw new Error("遠端已變動，未推送 Sites，請重新同步。");
  let sitesCommit = sites;
  if (sitesTree !== localTree || linkedGithub !== head) {
    // A content snapshot keeps Site history small without rewriting either repository.
    sitesCommit = git(
      ["commit-tree", localTree, "-p", sites],
      false,
      false,
      `sync(github): 同步同事午餐團訂原始碼\n\nGitHub-Commit: ${head}\nGitHub-Repository: ${link.github}\n`,
    ).output;
    process.stderr.write("正在同步 Sites 原始碼快照…\n");
    try {
      git(
        [
          "push",
          link.site_source_remote,
          `${sitesCommit}:refs/heads/${link.branch}`,
        ],
        true,
      );
    } catch (error) {
      throw new Error(
        `GitHub 已合併；Sites 尚未確認。請核對兩端狀態後重試。${error.message}`,
      );
    }
  }
  const githubAfter = git([
    "ls-remote",
    "origin",
    `refs/heads/${link.branch}`,
  ]).output.split(/\s/)[0];
  fetchSites();
  const sitesAfter = rev(`refs/remotes/sites/${link.branch}`);
  if (githubAfter !== head || tree(sitesAfter) !== localTree)
    throw new Error("同步後遠端再次變動，請重新核對。");
  return {
    state: "synchronized",
    synchronized: true,
    githubCommit: head,
    sitesCommit: sitesAfter,
    contentTree: localTree,
    identicalSource: true,
    deployed: false,
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
