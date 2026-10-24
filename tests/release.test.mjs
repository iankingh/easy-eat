import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  archiveHash,
  checkRelease,
  startRelease,
  finishRelease,
  validateArchive,
} from "../scripts/release.mjs";
import { mainRuleset, protectMain } from "../scripts/protect-main.mjs";
import { createGithubClient } from "../scripts/github.mjs";

const gh = "a".repeat(40),
  site = "b".repeat(40),
  tree = "c".repeat(40);
const link = {
  github: "https://github.com/owner/repo.git",
  branch: "main",
  project_id: "fixture-project",
  site_source_remote: "https://fixture.invalid/repo.git",
  live_url: "https://fixture.example/",
};
function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "easy-eat-release-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const archive = path.join(dir, "site.tar.gz");
  writeFileSync(archive, "fixture artifact");
  const source = {
    project_id: link.project_id,
    checkout_path: dir,
    commit_sha: site,
    archive,
  };
  const calls = [],
    deployments = [],
    statuses = new Map();
  const flags = {
    success: true,
    spoof: false,
    main: gh,
    failWrite: false,
    failRead: false,
  };
  const run = {
    id: 41,
    run_number: 8,
    run_attempt: 1,
    head_sha: gh,
    head_branch: "main",
    event: "push",
    status: "completed",
    conclusion: "success",
    html_url: "https://github.com/owner/repo/actions/runs/41",
  };
  let ruleset;
  const api = (method, endpoint, body) => {
    calls.push({ method, endpoint, body });
    if (method === "GET" && endpoint.endsWith("/branches/main"))
      return { commit: { sha: flags.main, commit: { tree: { sha: tree } } } };
    if (endpoint.includes("/actions/workflows/ci.yml/runs?"))
      return {
        workflow_runs: [
          {
            ...run,
            status: flags.success ? "completed" : "in_progress",
            conclusion: flags.success ? "success" : null,
          },
        ],
      };
    if (endpoint.includes("/actions/runs/41/jobs?"))
      return {
        jobs: [
          {
            name: "verify",
            conclusion: "success",
            check_run_url:
              "https://api.github.com/repos/owner/repo/check-runs/7",
          },
        ],
      };
    if (endpoint.endsWith("/check-runs/7"))
      return {
        name: "verify",
        head_sha: gh,
        conclusion: "success",
        app: {
          id: 15368,
          slug: flags.spoof ? "another-app" : "github-actions",
        },
      };
    if (endpoint === "repos/owner/repo")
      return { permissions: { admin: true } };
    if (endpoint === "repos/owner/repo/rulesets") {
      if (method === "GET")
        return ruleset
          ? [{ id: 8, name: ruleset.name, source_type: "Repository" }]
          : [];
      ruleset = { ...body, id: 8 };
      return ruleset;
    }
    if (endpoint === "repos/owner/repo/rulesets/8") {
      if (method === "PUT") ruleset = { ...body, id: 8 };
      return structuredClone(ruleset);
    }
    if (method === "GET" && endpoint.includes("/deployments?"))
      return deployments;
    if (method === "POST" && endpoint === "repos/owner/repo/deployments") {
      const d = {
        id: deployments.length + 1,
        sha: body.ref,
        environment: body.environment,
        payload: body.payload,
      };
      deployments.push(d);
      statuses.set(d.id, []);
      return d;
    }
    const match = endpoint.match(/\/deployments\/(\d+)(\/statuses)?/);
    if (match) {
      const id = Number(match[1]);
      if (!match[2]) {
        if (flags.failRead) throw new Error("fixture read failure");
        return deployments.find((d) => d.id === id);
      }
      if (method === "GET") return statuses.get(id).slice(0, 1);
      if (flags.failWrite) throw new Error("fixture write failure");
      statuses.get(id).unshift(body);
      return body;
    }
    throw new Error(`unexpected fixture API: ${method} ${endpoint}`);
  };
  const git = (args) => {
    const command = args.join(" ");
    return command === "status --porcelain"
      ? ""
      : command === "remote get-url origin"
        ? link.site_source_remote
        : command === "rev-parse HEAD"
          ? site
          : command === "rev-parse HEAD^{tree}"
            ? tree
            : assert.fail(command);
  };
  const check = () =>
    checkRelease({ source, link, api, git, validate: () => {} });
  const savedVersion = {
    project_id: link.project_id,
    id: "fixture-version",
    version_number: 19,
    source: { commit_sha: site },
  };
  const result = {
    id: "fixture-deployment",
    project_id: link.project_id,
    version_id: savedVersion.id,
    type: "publish",
    status: "succeeded",
    url: link.live_url,
  };
  return {
    dir,
    archive,
    source,
    api,
    git,
    calls,
    deployments,
    statuses,
    flags,
    check,
    savedVersion,
    result,
  };
}
test("release gate rejects pending CI, a spoofed provider, wrong source tree and dirty checkout", (t) => {
  const f = fixture(t);
  f.flags.success = false;
  assert.throws(f.check, /CI/);
  f.flags.success = true;
  f.flags.spoof = true;
  assert.throws(f.check, /GitHub Actions/);
  f.flags.spoof = false;
  assert.throws(
    () =>
      checkRelease({
        source: f.source,
        link,
        api: f.api,
        git: (args) =>
          args.join(" ") === "rev-parse HEAD^{tree}"
            ? "d".repeat(40)
            : f.git(args),
      }),
    /不相同/,
  );
  assert.throws(
    () =>
      checkRelease({
        source: f.source,
        link,
        api: f.api,
        git: (args) => (args[0] === "status" ? " M worker" : f.git(args)),
      }),
    /尚未提交/,
  );
  assert.equal(f.deployments.length, 0);
});
test("release start rejects a changed artifact, changed main, and a mismatched saved version", (t) => {
  const f = fixture(t),
    check = f.check();
  const start = () =>
    startRelease({ check, savedVersion: f.savedVersion, link, api: f.api });
  writeFileSync(f.archive, "tampered");
  assert.throws(start, /封裝檔已變更/);
  writeFileSync(f.archive, "fixture artifact");
  f.flags.main = "d".repeat(40);
  assert.throws(start, /CI|main/);
  f.flags.main = gh;
  assert.throws(
    () =>
      startRelease({
        check,
        savedVersion: { ...f.savedVersion, source: { commit_sha: gh } },
        link,
        api: f.api,
      }),
    /save_site_version/,
  );
  assert.equal(f.deployments.length, 0);
});
test("deployment start and success recording are idempotent and preserve both commit identities", (t) => {
  const f = fixture(t),
    check = f.check();
  const start = () =>
    startRelease({ check, savedVersion: f.savedVersion, link, api: f.api });
  const release = start();
  assert.equal(start().deploymentId, release.deploymentId);
  assert.equal(f.deployments.length, 1);
  assert.equal(release.payload.githubCommit, gh);
  assert.equal(release.payload.sitesCommit, site);
  assert.equal(release.payload.archiveSha256, archiveHash(f.archive));
  assert.equal("archive" in release.payload, false);
  const finish = () =>
    finishRelease({ release, result: f.result, link, api: f.api });
  assert.equal(finish().deployed, true);
  finish();
  assert.equal(f.statuses.get(release.deploymentId).length, 2); // pending + one success
  assert.equal(start().alreadySucceeded, true);
  assert.throws(
    () =>
      finishRelease({
        release,
        result: { ...f.result, status: "building" },
        link,
        api: f.api,
      }),
    /舊狀態/,
  );
});
test("published Site with a GitHub read/write failure reports record pending; retry never creates a deployment", (t) => {
  const f = fixture(t),
    release = startRelease({
      check: f.check(),
      savedVersion: f.savedVersion,
      link,
      api: f.api,
    });
  for (const failure of ["failRead", "failWrite"]) {
    f.flags[failure] = true;
    assert.throws(
      () => finishRelease({ release, result: f.result, link, api: f.api }),
      (error) => error.recordPending && /不要重新部署/.test(error.message),
    );
    f.flags[failure] = false;
  }
  assert.equal(
    finishRelease({ release, result: f.result, link, api: f.api }).recorded,
    true,
  );
  assert.equal(f.deployments.length, 1);
});
test("failed native deployment is recorded as failure; unrelated results are rejected", (t) => {
  const f = fixture(t),
    release = startRelease({
      check: f.check(),
      savedVersion: f.savedVersion,
      link,
      api: f.api,
    });
  assert.throws(
    () =>
      finishRelease({
        release,
        result: { ...f.result, version_id: "another" },
        link,
        api: f.api,
      }),
    /同一 Site/,
  );
  assert.throws(
    () =>
      finishRelease({
        release,
        result: { ...f.result, url: "https://unrelated.invalid/" },
        link,
        api: f.api,
      }),
    /正式網址/,
  );
  assert.equal(
    finishRelease({
      release,
      result: { ...f.result, status: "failed", url: null },
      link,
      api: f.api,
    }).state,
    "failure",
  );
});
test("archive gate validates native project identity and build provenance, without extracting files", (t) => {
  const f = fixture(t),
    stage = path.join(f.dir, "dist");
  mkdirSync(path.join(stage, ".openai"), { recursive: true });
  mkdirSync(path.join(stage, "server"));
  writeFileSync(
    path.join(stage, ".openai/hosting.json"),
    JSON.stringify({ project_id: link.project_id }),
  );
  writeFileSync(
    path.join(stage, "server/index.js"),
    `// Source-Commit: ${site}\n// Source-Tree: ${tree}\nexport default {};`,
  );
  execFileSync("tar", ["-czf", f.archive, "-C", f.dir, "dist"]);
  validateArchive(f.archive, { commit_sha: site, tree }, link);
  assert.throws(
    () => validateArchive(f.archive, { commit_sha: gh, tree }, link),
    /指定 Sites commit/,
  );
  assert.throws(
    () =>
      validateArchive(
        f.archive,
        { commit_sha: site, tree },
        { ...link, project_id: "other" },
      ),
    /project ID/,
  );
});
test("main rules require PR, current verify from Actions, no approvals and no bypass, and apply is repeatable", (t) => {
  const f = fixture(t),
    rules = mainRuleset(15368);
  assert.deepEqual(rules.bypass_actors, []);
  assert.equal(
    rules.rules.find((r) => r.type === "pull_request").parameters
      .required_approving_review_count,
    0,
  );
  assert.deepEqual(
    rules.rules.find((r) => r.type === "pull_request").parameters
      .allowed_merge_methods,
    ["merge"],
  );
  const checks = rules.rules.find(
    (r) => r.type === "required_status_checks",
  ).parameters;
  assert.equal(checks.strict_required_status_checks_policy, true);
  assert.deepEqual(checks.required_status_checks, [
    { context: "verify", integration_id: 15368 },
  ]);
  assert.equal(protectMain(f.api, "owner/repo", false).apply, false);
  assert.equal(protectMain(f.api, "owner/repo", true).applied, true);
  assert.equal(protectMain(f.api, "owner/repo", true).rulesetId, 8);
  assert.equal(
    f.calls.filter(
      (c) => c.method === "POST" && c.endpoint.endsWith("/rulesets"),
    ).length,
    1,
  );
});
test("GitHub client uses structured stdin and refuses other repositories", () => {
  let invocation;
  const api = createGithubClient("owner/repo", (command, args, options) => {
    invocation = { command, args, options };
    return "{}";
  });
  const body = { title: "literal `$(text)`\nsecond line" };
  api("POST", "repos/owner/repo/pulls", body);
  assert.equal(invocation.command, "gh");
  assert.equal(invocation.options.input, JSON.stringify(body));
  assert.equal(invocation.args.includes(body.title), false);
  assert.throws(() => api("GET", "repos/other/repo/pulls"), /其他 repository/);
});

test("lost GitHub creation response is reconciled before a retry creates another record", (t) => {
  const f = fixture(t),
    check = f.check();
  let loseReply = true;
  const api = (method, endpoint, body) => {
    const result = f.api(method, endpoint, body);
    if (
      loseReply &&
      method === "POST" &&
      endpoint === "repos/owner/repo/deployments"
    ) {
      loseReply = false;
      throw new Error("fixture reply lost after successful creation");
    }
    return result;
  };
  const start = () =>
    startRelease({ check, savedVersion: f.savedVersion, link, api });
  assert.throws(start, /reply lost/);
  assert.equal(start().deploymentId, 1);
  assert.equal(f.deployments.length, 1);
});
