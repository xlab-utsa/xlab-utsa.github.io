// Build a self-link submission (SPEC.md §9.3): the paper's current file text with exactly one
// line added — `personId: <id>` under the claimed author. The Worker accepts a member's edit
// to a paper that does not name them ONLY in this shape (isSelfLinkOnly in
// workers/xlab-gate/src/roster.ts), so this must not re-serialize the record: re-serializing
// would reformat lines and turn a one-line claim into a rejected rewrite.
//
// CLIENT-SAFE: pure string manipulation.

/**
 * Insert `personId: <personId>` under the `authorIndex`-th entry of the top-level `authors:`
 * list. Throws when the text does not have that shape, or the slot is already linked —
 * callers show the error rather than submitting something the Worker would refuse.
 */
export function insertSelfLink(text: string, authorIndex: number, personId: string): string {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^authors:\s*$/.test(l));
  if (start === -1) throw new Error("this file has no authors list");

  let seen = -1;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() && !/^\s/.test(line)) break; // left the authors block
    const item = line.match(/^(\s*)-\s+name:\s*\S/);
    if (!item) continue;
    seen++;
    if (seen !== authorIndex) continue;

    const indent = item[1].length + 2;
    const next = lines[i + 1] ?? "";
    if (new RegExp(`^\\s{${indent}}personId:`).test(next)) throw new Error("that author is already linked");
    lines.splice(i + 1, 0, `${" ".repeat(indent)}personId: ${personId}`);
    return lines.join(eol);
  }
  throw new Error(`author #${authorIndex + 1} was not found in this file`);
}
