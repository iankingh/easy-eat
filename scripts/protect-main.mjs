import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createGithubClient, repositoryName, verifiedMain } from "./github.mjs";

export function mainRuleset(integrationId) {
  if (!Number.isSafeInteger(integrationId) || integrationId <= 0)
    throw new Error("GitHub Actions integration ID 不正確。");
  return {
    name: "easy-eat-main",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: true,
          allowed_merge_methods: ["merge"],
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: [
            { context: "verify", integration_id: integrationId },
          ],
        },
      },
    ],
  };
}

export function protectMain(api, repository, apply = false) {
  const prefix = `repos/${repository}`;
  const metadata = api("GET", prefix);
  if (!metadata.permissions?.admin)
    throw new Error("設定規則需要 GitHub repository 管理權限。");
  const main = verifiedMain(api, repository);
  const desired = mainRuleset(main.integrationId);
  if (!apply) return { apply: false, mainCommit: main.sha, ruleset: desired };
  const existing = api("GET", `${prefix}/rulesets`).find(
    (r) => r.name === desired.name && r.source_type === "Repository",
  );
  const saved = api(
    existing ? "PUT" : "POST",
    `${prefix}/rulesets${existing ? `/${existing.id}` : ""}`,
    desired,
  );
  const actual = api("GET", `${prefix}/rulesets/${saved.id}`);
  for (const key of [
    "target",
    "enforcement",
    "bypass_actors",
    "conditions",
    "rules",
  ]) {
    if (JSON.stringify(actual[key]) !== JSON.stringify(desired[key])) {
      // GitHub may reorder object keys. Compare canonical JSON below.
      if (canonical(actual[key]) !== canonical(desired[key]))
        throw new Error(`規則回讀不一致：${key}`);
    }
  }
  return {
    applied: true,
    mainCommit: main.sha,
    rulesetId: actual.id,
    url:
      actual._links?.html?.href ||
      `https://github.com/${repository}/rules/${actual.id}`,
  };
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(",")}]`;
  if (value && typeof value === "object")
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((k) => [k, JSON.parse(canonical(value[k]))]),
      ),
    );
  return JSON.stringify(value);
}
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    if (!["check", "apply"].includes(process.argv[2]))
      throw new Error("Usage: node scripts/protect-main.mjs check|apply");
    const link = JSON.parse(
      readFileSync(new URL("../.openai/repository-link.json", import.meta.url)),
    );
    const repository = repositoryName(link);
    console.log(
      JSON.stringify(
        protectMain(
          createGithubClient(repository),
          repository,
          process.argv[2] === "apply",
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
