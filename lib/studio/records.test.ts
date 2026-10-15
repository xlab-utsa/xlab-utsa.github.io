// What a submission commits for one record. Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRecordFiles, serializeRecord } from "./records";
import { entityByKey } from "./entities";

const people = entityByKey("people")!;
const posts = entityByKey("posts")!;

describe("serializeRecord", () => {
  it("drops empty strings, empty arrays and empty objects so diffs stay clean", () => {
    const yaml = serializeRecord(people, {
      id: "jane-doe",
      name: "Jane Doe",
      bio: "",
      secondaryTitles: [],
      links: { email: "", scholar: undefined },
      labTenure: { joinedYear: 2024 },
    });
    assert.equal(yaml, "id: jane-doe\nname: Jane Doe\nlabTenure:\n  joinedYear: 2024\n");
  });

  it("writes posts as frontmatter + markdown body", () => {
    const mdx = serializeRecord(posts, { id: "hello", kind: "news", title: "Hi", body: "# Heading\n\ntext" });
    assert.equal(mdx, "---\nid: hello\nkind: news\ntitle: Hi\n---\n\n# Heading\n\ntext\n");
  });
});

describe("buildRecordFiles", () => {
  it("puts the record and its uploaded images in one payload", () => {
    const files = buildRecordFiles(
      people,
      { id: "jane-doe", name: "Jane Doe", photo: "/images/people/jane-doe.jpg" },
      { "public/images/people/jane-doe.jpg": "AAAA" }
    );
    assert.deepEqual(
      files.map((f) => f.path),
      ["content/people/jane-doe.yaml", "public/images/people/jane-doe.jpg"]
    );
    assert.equal(files[1].contentBase64, "AAAA");
    assert.match(files[0].content ?? "", /^id: jane-doe\n/);
  });
});
