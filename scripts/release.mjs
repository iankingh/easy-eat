// Native Sites tools own saving and publishing. This helper only validates and records.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createGithubClient,
  paginate,
  repositoryName,
  verifiedMain,
} from "./github.mjs";

export const archiveHash = (archive) =>
  createHash("sha256").update(readFileSync(archive)).digest("hex");
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};

export function validateArchive(archive, source, link, execute = execFileSync) {
  const manifest = JSON.parse(
    execute("tar", ["-xOf", archive, "dist/.openai/hosting.json"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    }),
  );
  requireValue(
    manifest.project_id === link.project_id,
    "封裝的 Sites project ID 不符。",
  );
  const worker = execute("tar", ["-xOf", archive, "dist/server/index.js"], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  requireValue(
    worker.includes(`// Source-Commit: ${source.commit_sha}\n`) &&
      worker.includes(`// Source-Tree: ${source.tree}\n`),
    "封裝不是從指定 Sites commit 建置；請在乾淨的 Sites checkout 重新建置封裝。",
  );
}

export function checkRelease({
  source,
  link,
  api,
  git,
  validate = validateArchive,
}) {
  requireValue(
    source?.project_id === link.project_id,
    "請提供同一個 Site 的原生 source workflow 封裝結果。",
  );
  requireValue(
    /^[0-9a-f]{40}$/.test(source.commit_sha),
    "Sites commit SHA 不正確。",
  );
  requireValue(
    path.isAbsolute(source.checkout_path || "") &&
      path.isAbsolute(source.archive || ""),
    "封裝結果須包含絕對 checkout_path 及 archive。",
  );
  requireValue(
    !git(["status", "--porcelain"]),
    "Sites checkout 有尚未提交的修改。",
  );
  requireValue(
    git(["remote", "get-url", "origin"]) === link.site_source_remote,
    "發布必須從原生 Sites checkout 準備。",
  );
  requireValue(
    git(["rev-parse", "HEAD"]) === source.commit_sha,
    "Sites HEAD 與封裝結果不符。",
  );
  const tree = git(["rev-parse", "HEAD^{tree}"]);
  const repository = repositoryName(link);
  const main = verifiedMain(api, repository, link.branch);
  requireValue(main.tree === tree, "Sites 與目前 GitHub main 原始碼不相同。");
  validate(source.archive, { ...source, tree }, link);
  return {
    schemaVersion: 1,
    repository,
    projectId: link.project_id,
    githubCommit: main.sha,
    sitesCommit: source.commit_sha,
    contentTree: tree,
    ciRunId: main.run.id,
    ciUrl: main.run.html_url,
    archive: realpathSync(source.archive),
    archiveSha256: archiveHash(source.archive),
  };
}

function payloadFor(check, savedVersion, link) {
  requireValue(
    check?.schemaVersion === 1 &&
      check.repository === repositoryName(link) &&
      check.projectId === link.project_id,
    "發布檢查與專案不符。",
  );
  for (const key of ["githubCommit", "sitesCommit", "contentTree"])
    requireValue(/^[0-9a-f]{40}$/.test(check[key]), `發布檢查缺少 ${key}。`);
  requireValue(
    savedVersion?.project_id === check.projectId &&
      savedVersion.source?.commit_sha === check.sitesCommit &&
      typeof savedVersion.id === "string" &&
      savedVersion.id.length > 0 &&
      Number.isSafeInteger(savedVersion.version_number) &&
      savedVersion.version_number > 0,
    "請提供與封裝完全對應的原生 save_site_version 結果。",
  );
  requireValue(/^[0-9a-f]{64}$/.test(check.archiveSha256), "封裝雜湊不正確。");
  return {
    schemaVersion: 1,
    releaseKey: `${check.projectId}:${savedVersion.id}`,
    projectId: check.projectId,
    githubCommit: check.githubCommit,
    sitesCommit: check.sitesCommit,
    contentTree: check.contentTree,
    sitesVersionId: savedVersion.id,
    sitesVersionNumber: savedVersion.version_number,
    archiveSha256: check.archiveSha256,
    ciRunId: check.ciRunId,
    ciUrl: check.ciUrl,
  };
}

export function startRelease({ check, savedVersion, link, api }) {
  const payload = payloadFor(check, savedVersion, link);
  requireValue(
    archiveHash(check.archive) === check.archiveSha256,
    "封裝檔已變更；停止發布並重新檢查。",
  );
  const main = verifiedMain(api, check.repository, link.branch);
  requireValue(
    main.sha === check.githubCommit && main.tree === check.contentTree,
    "GitHub main 已變動，請重新同步、建置及檢查。",
  );
  requireValue(
    main.run.id === check.ciRunId && main.run.html_url === check.ciUrl,
    "CI 紀錄已改變，請重新檢查。",
  );
  const prefix = `repos/${check.repository}`;
  const matches = paginate(
    api,
    `${prefix}/deployments?sha=${check.githubCommit}&environment=production`,
  ).filter((d) => deploymentPayload(d).releaseKey === payload.releaseKey);
  requireValue(matches.length <= 1, "同版本有重複部署紀錄，請先核對。");
  let deployment = matches[0];
  if (deployment)
    requireValue(
      samePayload(deploymentPayload(deployment), payload),
      "同一 Sites 版本已使用不同發布資料；不能覆寫紀錄。",
    );
  else
    deployment = api("POST", `${prefix}/deployments`, {
      ref: check.githubCommit,
      auto_merge: false,
      required_contexts: [],
      environment: "production",
      production_environment: true,
      transient_environment: false,
      description: `Sites v${savedVersion.version_number}`,
      payload,
    });
  requireValue(
    deployment.sha === check.githubCommit &&
      samePayload(deploymentPayload(deployment), payload),
    "GitHub 部署紀錄回應與指定 commit 不符。",
  );
  const statuses = api(
    "GET",
    `${prefix}/deployments/${deployment.id}/statuses?per_page=1`,
  );
  if (!statuses.length)
    api("POST", `${prefix}/deployments/${deployment.id}/statuses`, {
      state: "pending",
      description: "等待 Sites 原生發布",
      log_url: check.ciUrl,
      auto_inactive: false,
    });
  return {
    repository: check.repository,
    deploymentId: deployment.id,
    payload,
    alreadySucceeded: statuses[0]?.state === "success",
    url: `https://github.com/${check.repository}/deployments`,
  };
}
function deploymentPayload(deployment) {
  return typeof deployment.payload === "string"
    ? JSON.parse(deployment.payload)
    : deployment.payload || {};
}
function samePayload(a, b) {
  return Object.keys(b).every((key) => a[key] === b[key]);
}

export function finishRelease({ release, result, link, api }) {
  const repository = repositoryName(link),
    payload = release?.payload;
  requireValue(
    release?.repository === repository &&
      Number.isSafeInteger(release.deploymentId) &&
      release.deploymentId > 0 &&
      payload?.projectId === link.project_id,
    "發布紀錄與專案不符。",
  );
  requireValue(
    result?.project_id === payload.projectId &&
      result.version_id === payload.sitesVersionId &&
      typeof result.id === "string" &&
      result.id.length > 0 &&
      result.type === "publish",
    "請提供同一 Site／版本的原生發布結果。",
  );
  const states = {
    pending: "pending",
    building: "in_progress",
    publishing: "in_progress",
    succeeded: "success",
    failed: "failure",
  };
  requireValue(states[result.status], "Sites 發布狀態不正確。");
  if (result.status === "succeeded") {
    const url = new URL(result.url || "about:blank"),
      expected = new URL(link.live_url);
    requireValue(
      url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        url.origin === expected.origin,
      "Sites 成功結果缺少正確的正式網址。",
    );
  }
  const prefix = `repos/${repository}/deployments/${release.deploymentId}`;
  const description =
    `Sites v${payload.sitesVersionNumber}: ${result.status}; ${result.id}`.slice(
      0,
      140,
    );
  try {
    const actual = api("GET", prefix);
    requireValue(
      actual.sha === payload.githubCommit &&
        actual.environment === "production" &&
        samePayload(deploymentPayload(actual), payload),
      "GitHub 部署紀錄內容不符。",
    );
    const latest = api("GET", `${prefix}/statuses?per_page=1`)[0];
    if (latest?.state === "success" && states[result.status] !== "success")
      throw new Error(
        "此版本已記錄發布成功，拒絕以舊狀態覆蓋；請重新核對原生發布狀態。",
      );
    if (
      latest?.state !== states[result.status] ||
      latest?.description !== description
    )
      api("POST", `${prefix}/statuses`, {
        state: states[result.status],
        description,
        log_url: payload.ciUrl,
        ...(result.status === "succeeded"
          ? { environment_url: result.url }
          : {}),
        auto_inactive: false,
      });
  } catch (error) {
    if (result.status === "succeeded") {
      const pending = new Error(
        "網站已發布，GitHub 部署紀錄待補。請以相同輸入重試 finish；不要重新部署網站。",
      );
      pending.recordPending = true;
      throw pending;
    }
    throw error;
  }
  return {
    recorded: true,
    deployed: result.status === "succeeded",
    state: states[result.status],
    githubCommit: payload.githubCommit,
    sitesCommit: payload.sitesCommit,
    sitesVersionId: payload.sitesVersionId,
    deploymentId: release.deploymentId,
    ...(result.status === "succeeded" ? { siteUrl: result.url } : {}),
    url: `https://github.com/${repository}/deployments`,
  };
}

async function main() {
  const command = process.argv[2];
  requireValue(
    ["check", "start", "finish"].includes(command),
    "Usage: node scripts/release.mjs check|start|finish < input.json",
  );
  let text = "";
  for await (const chunk of process.stdin) {
    text += chunk;
    requireValue(text.length <= 65536, "發布資料過長。");
  }
  const input = JSON.parse(text);
  const link = JSON.parse(
    readFileSync(new URL("../.openai/repository-link.json", import.meta.url)),
  );
  const api = createGithubClient(repositoryName(link));
  let result;
  if (command === "check") {
    const git = (args) =>
      execFileSync("git", args, {
        cwd: input.source?.checkout_path,
        encoding: "utf8",
        timeout: 60000,
      }).trim();
    result = checkRelease({ source: input.source, link, api, git });
  } else if (command === "start")
    result = startRelease({ ...input, link, api });
  else result = finishRelease({ ...input, link, api });
  console.log(JSON.stringify(result, null, 2));
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href)
  main().catch((error) => {
    console.error(
      JSON.stringify({
        error: error.message,
        recordPending: error.recordPending || false,
      }),
    );
    process.exitCode = 1;
  });
