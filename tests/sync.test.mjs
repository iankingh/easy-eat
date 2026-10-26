import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  syncRepositories,
  assertContentSyncSafe,
} from "../scripts/sync-repositories.mjs";

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "easy-eat-sync-gate-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const origin = path.join(dir, "github.git"),
    siteRemote = path.join(dir, "sites.git");
  const calls = [],
    prs = [];
  const flags = { race: false, failSitesPush: false, loseSitesReply: false };
  const link = {
    github: "https://github.com/owner/repo.git",
    branch: "main",
    site_source_remote: "https://sites.fixture/repo.git",
  };
  let activeDir = dir;
  const actual = (args, input) => {
    const result = spawnSync("git", args, {
      cwd: activeDir,
      input,
      encoding: "utf8",
    });
    return {
      ok: result.status === 0,
      output: result.stdout.trim(),
      error: result.stderr,
    };
  };
  const run = (args, input) => {
    const r = actual(args, input);
    assert.equal(r.ok, true, r.error);
    return r.output;
  };
  run(["init", "-q", "-b", "main"]);
  run(["config", "user.name", "Sync Fixture"]);
  run(["config", "user.email", "sync@example.invalid"]);
  writeFileSync(
    path.join(dir, ".git/info/exclude"),
    "github.git/\nsites.git/\nhome/\n",
  );
  writeFileSync(path.join(dir, "menu.txt"), "base menu\n");
  writeFileSync(path.join(dir, "notes.txt"), "base notes\n");
  run(["add", "menu.txt", "notes.txt"]);
  run(["commit", "-qm", "fixture base"]);
  const base = run(["rev-parse", "HEAD"]),
    baseTree = run(["rev-parse", "HEAD^{tree}"]);
  run(["init", "--bare", "-q", origin]);
  run(["remote", "add", "origin", origin]);
  run(["push", "-q", "origin", "HEAD:refs/heads/main"]);
  run(["init", "--bare", "-q", siteRemote]);
  const initialSite = run(
    ["commit-tree", baseTree],
    `fixture snapshot\n\nGitHub-Commit: ${base}\n`,
  );
  run(["push", "-q", siteRemote, `${initialSite}:refs/heads/main`]);
  link.imported_commit = initialSite;
  run(["switch", "-c", "work/test-sync"]);
  const git = (args, remote = false, allowFailure = false, input) => {
    calls.push({ args: [...args], remote });
    if (args.join(" ") === "remote get-url origin")
      return { ok: true, output: link.github };
    if (args[0] === "ls-remote" && args[1] === "--get-url")
      return { ok: true, output: link.site_source_remote };
    if (flags.race && args.join(" ") === "ls-remote origin refs/heads/main")
      return { ok: true, output: `${"d".repeat(40)}\trefs/heads/main` };
    if (
      flags.failSitesPush &&
      args[0] === "push" &&
      args[1] === link.site_source_remote
    )
      throw new Error("fixture network failure");
    const r = actual(
      args.map((a) => (a === link.site_source_remote ? siteRemote : a)),
      input,
    );
    if (
      r.ok &&
      flags.loseSitesReply &&
      args[0] === "push" &&
      args[1] === link.site_source_remote
    ) {
      flags.loseSitesReply = false;
      throw new Error("fixture reply lost after successful push");
    }
    if (!r.ok && !allowFailure) throw new Error(r.error);
    return r;
  };
  const api = (method, endpoint, body) => {
    if (method === "GET" && endpoint.includes("/pulls?")) {
      const query = new URL(`https://fixture.invalid/${endpoint}`).searchParams;
      return prs.filter(
        (pr) =>
          !pr.merged &&
          pr.head === query.get("head").split(":")[1] &&
          pr.base === query.get("base"),
      );
    }
    if (method === "POST" && endpoint.endsWith("/pulls")) {
      const pr = { ...body, html_url: "https://github.com/owner/repo/pull/1" };
      prs.push(pr);
      return pr;
    }
    assert.fail(`Unexpected GitHub API: ${method} ${endpoint}`);
  };
  const commit = (file, text) => {
    writeFileSync(path.join(activeDir, file), text);
    run(["add", file]);
    run(["commit", "-qm", `fixture edit ${file}`]);
    return run(["rev-parse", "HEAD"]);
  };
  const invoke = (verb = "push") => syncRepositories({ verb, git, link, api });
  const siteHead = () =>
    run(["--git-dir", siteRemote, "rev-parse", "refs/heads/main"]);
  return {
    dir,
    origin,
    cd: (next) => {
      activeDir = next;
    },
    run,
    base,
    baseTree,
    siteRemote,
    initialSite,
    calls,
    prs,
    flags,
    commit,
    invoke,
    siteHead,
  };
}
test("unmerged changes open/reuse a PR without pushing either main or Sites; merged changes synchronize once", (t) => {
  const f = fixture(t),
    candidate = f.commit("menu.txt", "changed menu\n");
  assert.equal(f.invoke().state, "awaiting_merge");
  assert.equal(f.invoke().pullRequest, "https://github.com/owner/repo/pull/1");
  assert.equal(f.prs.length, 1);
  assert.equal(f.siteHead(), f.initialSite);
  assert.equal(
    f.run(["ls-remote", "origin", "refs/heads/main"]).split(/\s/)[0],
    f.base,
  );
  assert.equal(
    f.calls.some(
      (c) =>
        c.args[0] === "push" &&
        c.args.includes("origin") &&
        c.args.at(-1).endsWith(":refs/heads/main"),
    ),
    false,
  );
  const merge = f.run(
    ["commit-tree", `${candidate}^{tree}`, "-p", f.base, "-p", candidate],
    "Merge fixture PR\n",
  );
  f.run(["push", "-q", "origin", `${merge}:refs/heads/main`]);
  f.run(["push", "origin", "--delete", "work/test-sync"]);
  const synced = f.invoke();
  assert.equal(synced.state, "synchronized");
  assert.equal(synced.githubCommit, merge);
  const site = f.siteHead();
  assert.equal(f.invoke().sitesCommit, site); // retry creates no duplicate snapshot
  assert.equal(synced.contentTree, f.run(["rev-parse", `${site}^{tree}`]));
  assert.equal(f.run(["ls-remote", "origin", "refs/heads/work/test-sync"]), "");
});
test("successive commits update one working branch, upstream and PR", (t) => {
  const f = fixture(t);
  f.commit("menu.txt", "first change\n");
  const first = f.invoke();
  const second = f.commit("notes.txt", "next change\n");
  assert.equal(f.invoke().pullRequest, first.pullRequest);
  assert.equal(f.prs.length, 1);
  assert.equal(f.prs[0].head, "work/test-sync");
  assert.equal(f.run(["rev-parse", "@{upstream}"]), second);
  assert.equal(f.run(["ls-remote", "--heads", "origin"]).split("\n").length, 2);
  assert.equal(
    f.run(["ls-remote", "origin", "refs/heads/work/test-sync"]).split(/\s/)[0],
    second,
  );
});
test("a second computer continues the same branch and the first pulls it without another PR", (t) => {
  const f = fixture(t);
  f.commit("menu.txt", "company change\n");
  const first = f.invoke();
  const home = path.join(f.dir, "home");
  f.run(["clone", "-q", "--branch", "work/test-sync", f.origin, home]);
  f.cd(home);
  f.run(["config", "user.name", "Home Fixture"]);
  f.run(["config", "user.email", "home@example.invalid"]);
  const latest = f.commit("notes.txt", "home change\n");
  assert.equal(f.invoke().pullRequest, first.pullRequest);
  f.cd(f.dir);
  const pulled = f.invoke("pull");
  assert.equal(pulled.localCommit, latest);
  assert.equal(f.run(["show", "HEAD:notes.txt"]), "home change");
  assert.equal(f.prs.length, 1);
  assert.equal(f.siteHead(), f.initialSite);
});
test("divergent work on two computers is preserved and rejected without force-pushing", (t) => {
  const f = fixture(t);
  const shared = f.commit("menu.txt", "shared change\n");
  f.invoke();
  const home = path.join(f.dir, "home");
  f.run(["clone", "-q", "--branch", "work/test-sync", f.origin, home]);
  f.cd(home);
  f.run(["config", "user.name", "Home Fixture"]);
  f.run(["config", "user.email", "home@example.invalid"]);
  const remote = f.commit("notes.txt", "home change\n");
  f.run(["push", "origin", "work/test-sync"]);
  f.cd(f.dir);
  const local = f.commit("notes.txt", "company change\n");
  assert.throws(() => f.invoke(), /工作分支.*分歧/);
  assert.equal(f.run(["rev-parse", "HEAD"]), local);
  assert.equal(
    f.run(["ls-remote", "origin", "refs/heads/work/test-sync"]).split(/\s/)[0],
    remote,
  );
  assert.notEqual(local, shared);
  assert.equal(f.siteHead(), f.initialSite);
});
test("unreviewed commits on main require a working branch and never create sync branches", (t) => {
  const f = fixture(t);
  f.run(["switch", "main"]);
  f.commit("menu.txt", "unreviewed main change\n");
  assert.throws(() => f.invoke(), /工作分支/);
  assert.equal(f.prs.length, 0);
  assert.equal(f.run(["ls-remote", "--heads", "origin"]).split("\n").length, 1);
});
test("simultaneous edits stop until latest Site commit is merged, then PR and sync preserve both edits", (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.dir, "menu.txt"), "site menu\n");
  f.run(["add", "menu.txt"]);
  const editedSite = f.run(
    ["commit-tree", f.run(["write-tree"]), "-p", f.initialSite],
    "Edit in Site\n",
  );
  f.run(["push", "-q", f.siteRemote, `${editedSite}:refs/heads/main`]);
  f.run(["restore", "--source=HEAD", "--staged", "--worktree", "menu.txt"]);
  f.commit("notes.txt", "github notes\n");
  assert.throws(() => f.invoke(), /合併與測試/);
  assert.equal(f.prs.length, 0);
  assert.equal(f.siteHead(), editedSite);
  // Histories are intentionally independent. Explicit merge preserves the Site parent.
  f.run([
    "merge",
    "--allow-unrelated-histories",
    "--no-commit",
    "-s",
    "ours",
    editedSite,
  ]);
  f.run([
    "restore",
    `--source=${editedSite}`,
    "--staged",
    "--worktree",
    "menu.txt",
  ]);
  f.run(["commit", "-qm", "Merge both source edits"]);
  const candidate = f.run(["rev-parse", "HEAD"]);
  assert.equal(f.invoke().state, "awaiting_merge");
  const merge = f.run(
    ["commit-tree", `${candidate}^{tree}`, "-p", f.base, "-p", candidate],
    "Merge fixture PR\n",
  );
  f.run(["push", "-q", "origin", `${merge}:refs/heads/main`]);
  assert.equal(f.invoke().state, "synchronized");
  const site = f.siteHead();
  assert.equal(f.run(["show", `${site}:menu.txt`]), "site menu");
  assert.equal(f.run(["show", `${site}:notes.txt`]), "github notes");
});
test("a ref race prevents the Site mutation; a failed Site push can be retried safely", (t) => {
  const f = fixture(t);
  f.flags.race = true;
  assert.throws(() => f.invoke(), /遠端已變動/);
  assert.equal(f.siteHead(), f.initialSite);
  f.flags.race = false;
  // Force only the need for a new correspondence snapshot, not a force-push.
  const next = f.commit("notes.txt", "main via fixture PR\n");
  f.run(["push", "-q", "origin", `${next}:refs/heads/main`]);
  f.flags.failSitesPush = true;
  assert.throws(() => f.invoke(), /Sites 尚未確認/);
  assert.equal(f.siteHead(), f.initialSite);
  f.flags.failSitesPush = false;
  assert.equal(f.invoke().state, "synchronized");
});
test("pull imports Site-only edits and requires a PR; unmerged snapshots are never advertised as synchronized", (t) => {
  const f = fixture(t);
  writeFileSync(path.join(f.dir, "menu.txt"), "site-only menu\n");
  f.run(["add", "menu.txt"]);
  const site = f.run(
    ["commit-tree", f.run(["write-tree"]), "-p", f.initialSite],
    "Site-only edit\n",
  );
  f.run(["push", "-q", f.siteRemote, `${site}:refs/heads/main`]);
  f.run(["restore", "--source=HEAD", "--staged", "--worktree", "menu.txt"]);
  const pulled = f.invoke("pull");
  assert.equal(pulled.synchronized, false);
  assert.equal(f.run(["show", "HEAD:menu.txt"]), "site-only menu");
  assert.equal(f.invoke().state, "awaiting_merge");
  assert.equal(f.siteHead(), site);
  assert.doesNotThrow(() =>
    assertContentSyncSafe("merged", "site-change", "base", true),
  );
  assert.throws(
    () => assertContentSyncSafe("merged", "site-change", "base"),
    /合併與測試/,
  );
});

test("lost Site push response is reconciled without duplicating a snapshot", (t) => {
  const f = fixture(t),
    next = f.commit("notes.txt", "merged fixture change\n");
  f.run(["push", "-q", "origin", `${next}:refs/heads/main`]);
  f.flags.loseSitesReply = true;
  assert.throws(() => f.invoke(), /Sites 尚未確認/);
  const written = f.siteHead();
  assert.notEqual(written, f.initialSite);
  assert.equal(f.invoke().sitesCommit, written);
});
test("Site-only changes are not imported directly into main", (t) => {
  const f = fixture(t);
  f.run(["switch", "main"]);
  writeFileSync(path.join(f.dir, "menu.txt"), "site-only menu\n");
  f.run(["add", "menu.txt"]);
  const site = f.run(
    ["commit-tree", f.run(["write-tree"]), "-p", f.initialSite],
    "Site-only edit\n",
  );
  f.run(["push", "-q", f.siteRemote, `${site}:refs/heads/main`]);
  f.run(["restore", "--source=HEAD", "--staged", "--worktree", "menu.txt"]);
  assert.throws(() => f.invoke("pull"), /工作分支/);
  assert.equal(f.run(["rev-parse", "HEAD"]), f.base);
  assert.equal(f.run(["show", "HEAD:menu.txt"]), "base menu");
});
