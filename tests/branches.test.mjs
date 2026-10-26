import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanupMergedBranch } from "../scripts/cleanup-branch.mjs";

function fixture() {
  const head = "a".repeat(40),
    main = "b".repeat(40);
  const pr = {
    merged: true,
    base: { ref: "main", repo: { full_name: "owner/repo" } },
    head: {
      ref: "work/order-edit",
      sha: head,
      repo: { full_name: "owner/repo" },
    },
  };
  const flags = { missing: false, current: head, ancestor: head, moves: false };
  const calls = [];
  let reads = 0;
  const api = (method, endpoint) => {
    calls.push({ method, endpoint });
    if (endpoint.endsWith("/pulls/5")) return pr;
    if (endpoint.includes("/git/matching-refs/")) {
      if (flags.missing) return [];
      reads++;
      return [
        {
          ref: `refs/heads/${pr.head.ref}`,
          object: { sha: flags.moves && reads > 1 ? main : flags.current },
        },
      ];
    }
    if (endpoint.endsWith("/branches/main")) return { commit: { sha: main } };
    if (endpoint.includes("/compare/"))
      return { merge_base_commit: { sha: flags.ancestor } };
    assert.equal(method, "DELETE");
    flags.missing = true;
  };
  return {
    pr,
    flags,
    calls,
    invoke: () =>
      cleanupMergedBranch({
        api,
        repository: "owner/repo",
        mainBranch: "main",
        pullNumber: 5,
      }),
  };
}
test("cleanup deletes a merged working branch once and preserves main", () => {
  const f = fixture();
  assert.equal(f.invoke().deleted, true);
  assert.equal(f.invoke().deleted, false);
  assert.deepEqual(
    f.calls.filter((c) => c.method === "DELETE"),
    [
      {
        method: "DELETE",
        endpoint: "repos/owner/repo/git/refs/heads/work%2Forder-edit",
      },
    ],
  );
});
test("cleanup preserves unmerged, foreign and newly resumed branches", async (t) => {
  const changes = {
    unmerged: (f) => {
      f.pr.merged = false;
    },
    otherBase: (f) => {
      f.pr.base.ref = "develop";
    },
    fork: (f) => {
      f.pr.head.repo.full_name = "other/repo";
    },
    main: (f) => {
      f.pr.head.ref = "main";
    },
    newCommit: (f) => {
      f.flags.current = "c".repeat(40);
    },
    notAncestor: (f) => {
      f.flags.ancestor = "c".repeat(40);
    },
    changedDuringCheck: (f) => {
      f.flags.moves = true;
    },
  };
  for (const [name, change] of Object.entries(changes))
    await t.test(name, () => {
      const f = fixture();
      change(f);
      assert.equal(f.invoke().deleted, false);
      assert.equal(
        f.calls.some((c) => c.method === "DELETE"),
        false,
      );
    });
});
