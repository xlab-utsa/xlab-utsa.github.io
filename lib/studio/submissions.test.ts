// Reading pending submissions out of the PR body the Worker writes. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filesChangedIn, pendingFor, relativeTime } from "./submissions";

// Exactly the body shape workers/xlab-gate/src/index.ts handleSubmit() produces.
const body = (files: string[], email = "jane@utsa.edu") =>
  `Submitted from Studio.\n\n---\n` +
  `Submitted by **Jane Doe** (${email}), role \`member\`.\n\n` +
  `Files changed:\n${files.map((f) => `- \`${f}\``).join("\n")}\n\n` +
  `<!-- studio:${JSON.stringify({ email, name: "Jane Doe" })} -->`;

describe("filesChangedIn", () => {
  it("parses every path from the Worker's bullet list", () => {
    const item = { body: body(["content/people/jane-doe.yaml", "public/images/people/jane-doe.jpg"]) };
    assert.deepEqual(filesChangedIn(item), ["content/people/jane-doe.yaml", "public/images/people/jane-doe.jpg"]);
  });

  it("ignores a deletion marker and prose that happens to contain backticks", () => {
    const item = { body: body(["content/posts/old.mdx"]).replace("- `content/posts/old.mdx`", "- `content/posts/old.mdx` (delete)") };
    assert.deepEqual(filesChangedIn(item), ["content/posts/old.mdx"]);
    assert.deepEqual(filesChangedIn({ body: "Mentions `content/people/x.yaml` in a sentence." }), []);
  });
});

describe("pendingFor", () => {
  it("finds the submission touching a path, oldest first", () => {
    const queue = [
      { number: 2, createdAt: "2026-10-12T10:00:00Z", body: body(["content/people/jane-doe.yaml"]) },
      { number: 1, createdAt: "2026-10-12T09:00:00Z", body: body(["content/people/jane-doe.yaml"]) },
      { number: 3, createdAt: "2026-10-12T11:00:00Z", body: body(["access/roster.json"]) },
    ];
    assert.equal(pendingFor(queue, "content/people/jane-doe.yaml")?.number, 1);
    assert.equal(pendingFor(queue, "access/roster.json")?.number, 3);
    assert.equal(pendingFor(queue, "content/people/someone-else.yaml"), undefined);
  });

  it("does not match a path by prefix", () => {
    const queue = [{ number: 1, createdAt: "2026-10-12T09:00:00Z", body: body(["content/people/jane-doe-2.yaml"]) }];
    assert.equal(pendingFor(queue, "content/people/jane-doe.yaml"), undefined);
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  it("rounds to the nearest readable unit", () => {
    assert.equal(relativeTime("2026-10-12T11:59:40Z", now), "just now");
    assert.equal(relativeTime("2026-10-12T11:30:00Z", now), "30 minutes ago");
    assert.equal(relativeTime("2026-10-12T09:00:00Z", now), "3 hours ago");
    assert.equal(relativeTime("2026-10-10T12:00:00Z", now), "2 days ago");
  });
  it("never goes negative for a clock slightly ahead of the server", () => {
    assert.equal(relativeTime("2026-10-12T12:00:30Z", now), "just now");
  });
});
