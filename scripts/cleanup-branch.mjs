import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGithubClient, repositoryName } from "./github.mjs";

export function cleanupMergedBranch({
  api,
  repository,
  mainBranch,
  pullNumber,
}) {
  if (!Number.isSafeInteger(pullNumber) || pullNumber < 1)
    throw new Error("PR 編號不正確。");
  const prefix = `repos/${repository}`;
  const pr = api("GET", `${prefix}/pulls/${pullNumber}`);
  const branch = pr.head?.ref;
  const skip = (reason) => ({ deleted: false, branch, pullNumber, reason });
  if (!pr.merged || pr.base?.ref !== mainBranch)
    return skip("PR 尚未合併至 main。");
  if (
    pr.head?.repo?.full_name !== repository ||
    pr.base?.repo?.full_name !== repository
  )
    return skip("不刪除其他 repository 的分支。");
  if (!branch || branch === mainBranch) return skip("保留 main。");
  const ref = `refs/heads/${branch}`;
  const find = () =>
    api(
      "GET",
      `${prefix}/git/matching-refs/heads/${encodeURIComponent(branch)}`,
    ).find((item) => item.ref === ref);
  const actual = find();
  if (!actual) return skip("分支已刪除。");
  if (actual.object.sha !== pr.head.sha)
    return skip("分支在 PR 合併後有新提交，予以保留。");
  const main = api(
    "GET",
    `${prefix}/branches/${encodeURIComponent(mainBranch)}`,
  );
  const comparison = api(
    "GET",
    `${prefix}/compare/${actual.object.sha}...${main.commit.sha}`,
  );
  if (comparison.merge_base_commit?.sha !== actual.object.sha)
    return skip("分支仍有未包含於 main 的提交，予以保留。");
  // Re-read immediately before deletion to avoid removing newly resumed work.
  const latest = find();
  if (!latest || latest.object.sha !== actual.object.sha)
    return skip("分支在檢查期間已變動，予以保留。");
  api("DELETE", `${prefix}/git/refs/heads/${encodeURIComponent(branch)}`);
  return { deleted: true, branch, pullNumber, mergedHead: actual.object.sha };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const link = JSON.parse(
      readFileSync(new URL("../.openai/repository-link.json", import.meta.url)),
    );
    const repository = repositoryName(link);
    console.log(
      JSON.stringify(
        cleanupMergedBranch({
          api: createGithubClient(repository),
          repository,
          mainBranch: link.branch,
          pullNumber: Number(process.argv[2]),
        }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
