import { execFileSync } from "node:child_process";

export function repositoryName(link) {
  const match = link.github.match(
    /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\.git$/,
  );
  if (!match) throw new Error("GitHub repository link 不正確。");
  return match[1];
}

export function createGithubClient(repository, execute = execFileSync) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error("Repository 不正確。");
  const prefix = `repos/${repository}`;
  return (method, endpoint, body) => {
    if (endpoint !== prefix && !endpoint.startsWith(`${prefix}/`))
      throw new Error("拒絕存取其他 repository。");
    const args = [
      "api",
      "--hostname",
      "github.com",
      "--method",
      method,
      "-H",
      "Accept: application/vnd.github+json",
      endpoint,
    ];
    if (body !== undefined) args.push("--input", "-");
    let output;
    try {
      output = execute("gh", args, {
        encoding: "utf8",
        input: body === undefined ? undefined : JSON.stringify(body),
        timeout: 60000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      throw new Error(
        `GitHub ${method} ${endpoint.split("?")[0]} 未完成；請核對登入、權限與遠端狀態後重試。`,
      );
    }
    return output.trim() ? JSON.parse(output) : null;
  };
}

export function paginate(api, endpoint, key) {
  const items = [];
  for (let page = 1; page <= 1000; page++) {
    const result = api(
      "GET",
      `${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
    );
    const batch = key ? result[key] : result;
    if (!Array.isArray(batch))
      throw new Error("GitHub pagination 回應不正確。");
    items.push(...batch);
    if (batch.length < 100) return items;
  }
  throw new Error("GitHub 回應頁數過多，請縮小查詢範圍。");
}

// Check the repository's workflow, not an unrelated check with the same name.
export function verifiedMain(api, repository, branch = "main") {
  const prefix = `repos/${repository}`;
  const main = api("GET", `${prefix}/branches/${encodeURIComponent(branch)}`);
  const sha = main.commit.sha;
  const runs = api(
    "GET",
    `${prefix}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`,
  ).workflow_runs;
  const run = runs
    .filter(
      (r) =>
        r.head_sha === sha && r.head_branch === branch && r.event === "push",
    )
    .sort(
      (a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt,
    )[0];
  if (!run || run.status !== "completed" || run.conclusion !== "success")
    throw new Error("目前 main 的 CI 尚未成功，不能發布或啟用發布保護。");
  const jobs = paginate(
    api,
    `${prefix}/actions/runs/${run.id}/jobs?filter=latest`,
    "jobs",
  );
  const job = jobs.find(
    (j) => j.name === "verify" && j.conclusion === "success",
  );
  const checkId = job?.check_run_url?.match(/\/check-runs\/(\d+)$/)?.[1];
  if (!checkId) throw new Error("缺少 verify 檢查。");
  const check = api("GET", `${prefix}/check-runs/${checkId}`);
  if (
    check.head_sha !== sha ||
    check.name !== "verify" ||
    check.conclusion !== "success" ||
    check.app?.slug !== "github-actions"
  )
    throw new Error("verify 不是此 main commit 的 GitHub Actions 檢查。");
  return {
    sha,
    tree: main.commit.commit.tree.sha,
    run,
    integrationId: check.app.id,
  };
}
