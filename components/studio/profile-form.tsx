"use client";

// A lab member's own page — edited as the card visitors will see, not as a form.
//
// Why: the schema-generated form showed seventeen labelled boxes and nothing changed as you
// filled them in except your patience. Here the member looks at their actual team card and
// clicks on it: the photo, the name, the title line, the bio, the link chips. Everything
// else — office, other titles, education, past appointments — waits under "More, when you
// feel like it". A rail on the right keeps a to-do list that strikes itself out, and makes
// concrete recommendations drawn from what lab-mates' records already contain (the usual
// title line for a position, the department most of them list, a real bio to imitate, the
// link visitors look for most).
//
// Still schema-driven underneath: the record is validated with PersonSchema before it is
// sent and committed through the same buildRecordFiles() as every other form, so this can
// never accept something CI would reject. Machine fields (id, status, updatedAt/By,
// sortWeight, _meta) are set here and never shown.
import { useEffect, useMemo, useRef, useState } from "react";
import { PersonSchema } from "@/lib/content/schema";
import { api, type Identity, type Snapshot } from "@/lib/studio/api";
import { assetPathFor, entityByKey, repoAssetPath } from "@/lib/studio/entities";
import { fieldsOf, validateRecord, type FieldSpec } from "@/lib/studio/schema-fields";
import { buildRecordFiles, prepareImage, profileTodos, type ProfileTodo } from "@/lib/studio/records";
import { draftKeyFor, forgetDraft, markSent, readDraft, writeDraft } from "@/lib/studio/drafts";
import { relativeTime } from "@/lib/studio/submissions";
import {
  initialsOf,
  LINK_KEYS,
  PERSON_TYPE_LABELS,
  profileRecommendations,
  type LinkKey,
} from "@/lib/studio/recommendations";
import { withBasePath } from "@/lib/base-path";
import { FieldInput } from "./field-input";
import { ActionButton, Notice } from "./notice";

type Rec = Record<string, unknown>;
type Path = (string | number)[];

const LINK_DEFS: Record<LinkKey, { label: string; glyph: string; hint: string }> = {
  email: { label: "Email", glyph: "@", hint: "you@utsa.edu" },
  scholar: { label: "Google Scholar", glyph: "S", hint: "https://scholar.google.com/citations?user=…" },
  website: { label: "Website", glyph: "W", hint: "https://…" },
  linkedin: { label: "LinkedIn", glyph: "in", hint: "https://www.linkedin.com/in/…" },
  github: { label: "GitHub", glyph: "gh", hint: "https://github.com/…" },
  universityProfile: { label: "University page", glyph: "U", hint: "https://…" },
};

/** Inline-editable text: looks like the card until hovered or focused. */
const inline =
  "w-full rounded-sm border border-transparent bg-transparent px-2 py-1 -mx-2 text-foreground outline-none transition-colors hover:border-border hover:bg-background focus:border-foreground focus:bg-background";
const chip = (on: boolean, active = false) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
    active
      ? "border-foreground bg-background text-foreground"
      : on
        ? "border-foreground bg-invert-bg text-invert-fg"
        : "border-border text-text-faint hover:border-foreground hover:text-foreground"
  }`;
const mono = "font-mono text-[10.5px] font-bold tracking-wider text-text-faint uppercase";

export function ProfileForm({
  identity,
  snapshot,
  initial,
  isNew,
  onCancel,
  onSubmitted,
}: {
  identity: Identity;
  snapshot: Snapshot;
  /** The existing record, or the roster seed `{ id, name }` on first sign-in. */
  initial: Rec;
  isNew: boolean;
  onCancel: () => void;
  onSubmitted: (pr: { number: number; url: string }) => void;
}) {
  const entity = entityByKey("people");
  const id = String(initial.id ?? identity.personId ?? "");

  const specs = useMemo(() => fieldsOf(PersonSchema), []);
  const spec = (key: string): FieldSpec =>
    specs.find((s) => s.key === key) ?? { key, label: key, kind: "string", optional: true, nullable: false };
  const sub = (parent: string, key: string): FieldSpec =>
    spec(parent).fields?.find((s) => s.key === key) ?? { key, label: key, kind: "string", optional: true, nullable: false };

  const [record, setRecord] = useState<Rec>(() => ({ ...initial }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const [openLink, setOpenLink] = useState<LinkKey>();
  const [showMore, setShowMore] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const deptRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  const baseline = useMemo<Rec>(() => ({ ...initial }), [initial]);
  const draftKey = draftKeyFor("people", isNew, id);
  const [draft, setDraft] = useState(() => readDraft(draftKey, baseline));
  useEffect(() => {
    const t = setTimeout(() => writeDraft(draftKey, record, baseline), 600);
    return () => clearTimeout(t);
  }, [draftKey, record, baseline]);

  useEffect(() => {
    if (openLink) linkRef.current?.focus();
  }, [openLink]);

  const get = (path: Path): unknown => getPath(record, path);
  const set = (path: Path) => (value: unknown) => setRecord((r) => setPath(r, path, value));
  const text = (path: Path) => {
    const v = get(path);
    return typeof v === "string" ? v : "";
  };
  const err = (path: Path) => errors[path.join(".")];

  const rec = useMemo(() => profileRecommendations(record, snapshot.content), [record, snapshot]);
  const todos = profileTodos(record);
  const done = todos.filter((t) => t.done).length;
  const pct = Math.round((done / todos.length) * 100);
  const first = String(record.name ?? "").trim().split(/\s+/)[0] || "you";
  const photo = typeof record.photo === "string" ? record.photo : undefined;
  const photoSrc = photo ? (assets[repoAssetPath(photo)] ? `data:image/*;base64,${assets[repoAssetPath(photo)]}` : withBasePath(photo)) : undefined;

  async function pickPhoto(file: File) {
    if (!entity) return;
    setPhotoBusy(true);
    setPhotoError(undefined);
    try {
      const { base64, ext, bytes } = await prepareImage(file);
      if (bytes > 4_000_000) throw new Error("That image is too large even after resizing — try a smaller one.");
      const assetPath = assetPathFor(entity, id, "photo", ext);
      setAssets((a) => ({ ...a, [repoAssetPath(assetPath)]: base64 }));
      set(["photo"])(assetPath);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Could not use that image.");
    } finally {
      setPhotoBusy(false);
    }
  }

  /** Jump to the control a to-do or recommendation is about. */
  function focusTodo(key: ProfileTodo["key"]) {
    switch (key) {
      case "photo":
        photoRef.current?.click();
        break;
      case "title":
        titleRef.current?.focus();
        break;
      case "bio":
        bioRef.current?.focus();
        break;
      case "email":
        setOpenLink("email");
        break;
      case "scholarOrSite":
        setOpenLink(rec.topLink === "website" ? "website" : "scholar");
        break;
      case "affiliation":
        deptRef.current?.focus();
        break;
      case "joinedYear":
        yearRef.current?.focus();
        break;
    }
  }

  async function submit() {
    if (!entity) return;
    setFailure(undefined);

    const candidate: Rec = {
      ...record,
      id,
      status: record.status ?? "published",
      updatedAt: new Date().toISOString().slice(0, 10),
      updatedBy: identity.email,
    };
    // The affiliation block is optional as a whole, but once an institution is chosen the
    // schema wants a role there too; the obvious default is the title line.
    const affs = Array.isArray(candidate.affiliations) ? ([...candidate.affiliations] as Rec[]) : [];
    if (affs[0]) {
      const a = { ...affs[0] };
      if (a.institutionId && !a.roleTitle && candidate.roleTitle) a.roleTitle = candidate.roleTitle;
      if (!a.institutionId && !a.department && !a.roleTitle) affs.shift();
      else affs[0] = a;
    }
    if (affs.length) candidate.affiliations = affs;
    else delete candidate.affiliations;

    const result = validateRecord(PersonSchema, candidate);
    if (!result.ok) {
      setErrors(result.errors);
      const keys = Object.keys(result.errors);
      setFailure(`${keys.length === 1 ? "One thing needs" : `${keys.length} things need`} a fix — see the notes on the card.`);
      if (keys.some((k) => /^links\./.test(k))) setOpenLink(keys.find((k) => /^links\./.test(k))!.split(".")[1] as LinkKey);
      if (keys.some((k) => !CARD_PATHS.some((p) => k.startsWith(p)))) setShowMore(true);
      return;
    }
    setErrors({});

    setBusy(true);
    try {
      const res = await api.submit({
        title: `${isNew ? "Add" : "Update"} profile: ${String(candidate.name ?? id)}`,
        summary: isNew ? "New member profile, submitted from their Studio page." : "Profile update, submitted by the member from their Studio page.",
        files: buildRecordFiles(entity, candidate, assets),
      });
      // Keep what was sent: if an admin returns it, the fix starts from here, not from zero.
      markSent(draftKey, candidate);
      onSubmitted(res.pr);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not send this for review. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (!entity) return null;

  const position = typeof record.personType === "string" ? record.personType : "";
  const links = (record.links ?? {}) as Partial<Record<LinkKey, string>>;
  const openDef = openLink ? LINK_DEFS[openLink] : undefined;
  const institutionId = text(["affiliations", 0, "institutionId"]);
  const department = text(["affiliations", 0, "department"]);
  const joinedYear = get(["labTenure", "joinedYear"]);

  // Recommendations: only ones that apply right now, most useful first, at most five.
  // `apply` only touches state; focusing a control is named by key and done in the click
  // handler, so no closure built here ever reads a ref during render.
  const tips: { id: string; text: React.ReactNode; action?: { label: string; apply?: () => void; focus?: ProfileTodo["key"] } }[] = [];
  if (!photo) tips.push({ id: "photo", text: <>Without a photo your card shows “{initialsOf(record.name)}”. A phone photo against a plain wall is fine — it&apos;s resized here.</>, action: { label: "Choose a photo", focus: "photo" } });
  if (!position) tips.push({ id: "position", text: <>Pick your position first — it decides where you appear on the team page, and it lets us suggest your title line.</> });
  if (position && !text(["roleTitle"]) && rec.titleLine) tips.push({ id: "title", text: <>The lab usually writes this position as <span className="text-foreground">“{rec.titleLine}”</span>.</>, action: { label: "Use it", apply: () => set(["roleTitle"])(rec.titleLine), focus: "title" } });
  if (!text(["bio"])) tips.push({ id: "bio", text: rec.bioExample ? <>Two or three sentences, third person. {rec.bioExample.name}&apos;s reads: <span className="text-foreground">“{rec.bioExample.bio.length > 160 ? rec.bioExample.bio.slice(0, 160) + "…" : rec.bioExample.bio}”</span></> : <>Two or three sentences, in the third person: what {first} works on, and why it matters.</>, action: { label: `Start with “${rec.bioStarter.trim()}…”`, apply: () => set(["bio"])(rec.bioStarter), focus: "bio" } });
  if (rec.topLink && !links[rec.topLink] && rec.memberCount > 0) tips.push({ id: "link", text: <>{rec.linkCounts[rec.topLink]} of {rec.memberCount} lab members list {LINK_DEFS[rec.topLink].label} — it&apos;s what visitors look for first.</>, action: { label: `Add ${LINK_DEFS[rec.topLink].label}`, apply: () => setOpenLink(rec.topLink) } });
  if (!institutionId && rec.institutionId) tips.push({ id: "aff", text: <>Most of the lab lists <span className="text-foreground">{rec.institutionName ?? rec.institutionId}{rec.department ? ` · ${rec.department}` : ""}</span>.</>, action: { label: "Use that", apply: () => { setRecord((r) => { let next = setPath(r, ["affiliations", 0, "institutionId"], rec.institutionId); if (rec.department && !department) next = setPath(next, ["affiliations", 0, "department"], rec.department); return next; }); } } });
  if (joinedYear === undefined) tips.push({ id: "year", text: <>Joined this year? One click. (The year is what moves you to alumni correctly later — not before.)</>, action: { label: `Set ${rec.currentYear}`, apply: () => set(["labTenure", "joinedYear"])(rec.currentYear) } });
  if (tips.length === 0) tips.push({ id: "done", text: <>Nothing left on the list. Education, office and other titles live under <em>More</em> whenever you feel like it.</> });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{isNew ? "Your card on the lab site" : "Your card"}</h2>
          <p className="mt-1 text-[13px] text-text-faint">
            This is what visitors see. <span className="font-medium text-foreground">Click anything to change it.</span>
          </p>
        </div>
        <button onClick={onCancel} className="font-mono text-[11px] text-text-faint hover:text-foreground">
          ← Back
        </button>
      </div>

      {draft && (
        <Notice
          kind="info"
          title={draft.sent ? `Start from the version you sent ${relativeTime(draft.savedAt)}?` : `You have unsaved edits from ${relativeTime(draft.savedAt)}`}
          actions={
            <>
              <ActionButton primary onClick={() => { setRecord(draft.record); setDraft(undefined); }}>
                {draft.sent ? "Yes, start from it" : "Restore them"}
              </ActionButton>
              <ActionButton onClick={() => { forgetDraft(draftKey); setDraft(undefined); }}>
                {draft.sent ? "No, start fresh" : "Discard"}
              </ActionButton>
            </>
          }
        >
          {draft.sent
            ? "It was kept in this browser so a returned submission can be fixed instead of retyped."
            : "They were kept in this browser when you left without submitting."}
        </Notice>
      )}

      {failure && <Notice kind="error" title={failure} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ---- the card ---- */}
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-background p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
            <div className="flex flex-wrap items-start gap-6">
              {/* photo */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  disabled={photoBusy}
                  aria-label={photo ? "Change photo" : "Add a photo"}
                  className="group relative size-32 shrink-0 overflow-hidden rounded-full bg-bg-alt text-3xl font-semibold text-text-placeholder"
                >
                  {photoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoSrc} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center">{initialsOf(record.name)}</span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/70 font-mono text-[10px] font-bold tracking-wider text-background uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {photoBusy ? "Resizing…" : photo ? "Change photo" : "Add photo"}
                  </span>
                </button>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void pickPhoto(f);
                    e.target.value = "";
                  }}
                />
                {photo && (
                  <button type="button" onClick={() => set(["photo"])(undefined)} className="font-mono text-[10px] text-text-faint hover:text-brand-orange">
                    remove
                  </button>
                )}
                {(photoError || err(["photo"])) && <p className="max-w-[160px] text-center text-[11px] text-brand-orange">{photoError ?? err(["photo"])}</p>}
              </div>

              {/* name, title, position */}
              <div className="min-w-0 flex-1 space-y-1" style={{ flexBasis: 280 }}>
                <input
                  ref={nameRef}
                  value={text(["name"])}
                  onChange={(e) => set(["name"])(e.target.value)}
                  aria-label="Your name"
                  placeholder="Your name"
                  className={`${inline} text-[28px] font-bold tracking-tight`}
                />
                {err(["name"]) && <p className="text-[11px] text-brand-orange">{err(["name"])}</p>}
                <input
                  ref={titleRef}
                  value={text(["roleTitle"])}
                  onChange={(e) => set(["roleTitle"])(e.target.value)}
                  aria-label="Title line"
                  placeholder={rec.titleLine ? `Title line — e.g. ${rec.titleLine}` : "Title line — e.g. PhD Student, Computer Science"}
                  className={`${inline} font-mono text-[12px] text-text-faint focus:text-foreground`}
                />
                {err(["roleTitle"]) && <p className="text-[11px] text-brand-orange">{err(["roleTitle"])}</p>}
                <div className="flex flex-wrap gap-1.5 pt-2" role="group" aria-label="Position">
                  {Object.entries(PERSON_TYPE_LABELS).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => set(["personType"])(value)} aria-pressed={position === value} className={chip(position === value)}>
                      {label}
                    </button>
                  ))}
                </div>
                {err(["personType"]) && <p className="text-[11px] text-brand-orange">{err(["personType"])}</p>}

                {/* affiliation line */}
                <div className="flex flex-wrap items-center gap-x-1 gap-y-1 pt-3 font-mono text-[12px] text-text-faint">
                  <span>at</span>
                  <select
                    value={institutionId}
                    onChange={(e) => set(["affiliations", 0, "institutionId"])(e.target.value || undefined)}
                    aria-label="Institution"
                    className={`${inline} w-auto max-w-[260px] cursor-pointer font-mono text-[12px] ${institutionId ? "text-foreground" : ""}`}
                  >
                    <option value="">— institution —</option>
                    {snapshot.content.institutions.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.shortName ? `${i.name} (${i.shortName})` : i.name}
                      </option>
                    ))}
                  </select>
                  <span>·</span>
                  <input
                    ref={deptRef}
                    value={department}
                    onChange={(e) => set(["affiliations", 0, "department"])(e.target.value || undefined)}
                    aria-label="Department"
                    placeholder={rec.department ? `department — e.g. ${rec.department}` : "department"}
                    className={`${inline} w-auto min-w-[140px] flex-1 font-mono text-[12px] ${department ? "text-foreground" : ""}`}
                  />
                  <span>· since</span>
                  <input
                    ref={yearRef}
                    type="number"
                    value={joinedYear === undefined || joinedYear === null ? "" : String(joinedYear)}
                    onChange={(e) => set(["labTenure", "joinedYear"])(e.target.value === "" ? undefined : Number(e.target.value))}
                    aria-label="Year you joined the lab"
                    placeholder={String(rec.currentYear)}
                    className={`${inline} w-[72px] font-mono text-[12px] ${joinedYear !== undefined ? "text-foreground" : ""}`}
                  />
                </div>
                {(err(["affiliations", 0, "institutionId"]) || err(["affiliations", 0, "department"]) || err(["labTenure", "joinedYear"])) && (
                  <p className="text-[11px] text-brand-orange">
                    {err(["affiliations", 0, "institutionId"]) ?? err(["affiliations", 0, "department"]) ?? err(["labTenure", "joinedYear"])}
                  </p>
                )}
              </div>
            </div>

            {/* bio */}
            <textarea
              ref={bioRef}
              value={text(["bio"])}
              onChange={(e) => set(["bio"])(e.target.value || undefined)}
              rows={3}
              aria-label="Short bio"
              placeholder={`Two or three sentences about ${first === "you" ? "your" : `${first}'s`} work, in the third person. Click here and just type.`}
              className={`${inline} mt-5 resize-y text-[15px] leading-relaxed`}
            />
            {err(["bio"]) && <p className="text-[11px] text-brand-orange">{err(["bio"])}</p>}

            {/* links */}
            <div className="mt-4 space-y-2.5 border-t border-hairline pt-4">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Links">
                {LINK_KEYS.map((k) => {
                  const filled = Boolean(links[k]);
                  return (
                    <button key={k} type="button" onClick={() => setOpenLink(openLink === k ? undefined : k)} aria-pressed={openLink === k} className={chip(filled, openLink === k)}>
                      <span className="w-4 text-center font-mono text-[10px]">{LINK_DEFS[k].glyph}</span>
                      {filled ? LINK_DEFS[k].label : `+ ${LINK_DEFS[k].label}`}
                    </button>
                  );
                })}
              </div>
              {openLink && openDef && (
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="profile-link" className={`${mono} min-w-[110px]`}>
                    {openDef.label}
                  </label>
                  <input
                    id="profile-link"
                    ref={linkRef}
                    value={links[openLink] ?? ""}
                    onChange={(e) => set(["links", openLink])(e.target.value || undefined)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setOpenLink(undefined);
                      }
                    }}
                    placeholder={openDef.hint}
                    className="min-w-[240px] flex-1 rounded-sm border border-foreground bg-background px-2.5 py-1.5 text-sm text-foreground outline-none"
                  />
                  {links[openLink] && (
                    <button type="button" onClick={() => { set(["links", openLink])(undefined); setOpenLink(undefined); }} className="font-mono text-[11px] text-text-faint hover:text-brand-orange">
                      Remove
                    </button>
                  )}
                  <ActionButton onClick={() => setOpenLink(undefined)}>Done</ActionButton>
                  {err(["links", openLink]) && <p className="w-full text-[11px] text-brand-orange">{err(["links", openLink])}</p>}
                </div>
              )}
            </div>
          </div>

          {/* more, when you feel like it */}
          <div className="rounded-sm border border-dashed border-border">
            <button type="button" onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
              <span className={mono}>More, when you feel like it</span>
              <span className="font-mono text-[11px] text-text-faint">{showMore ? "hide" : "office · other titles · education · past appointments"}</span>
            </button>
            {showMore && (
              <div className="space-y-4 border-t border-hairline p-3">
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldInput spec={{ ...spec("office"), placeholder: "NPB 3.210" }} value={get(["office"])} onChange={set(["office"])} error={err(["office"])} />
                  <FieldInput spec={{ ...sub("labTenure", "leftYear"), label: "Year you left the lab", help: "Only if you have — this moves you to alumni." }} value={get(["labTenure", "leftYear"])} onChange={set(["labTenure", "leftYear"])} error={err(["labTenure", "leftYear"])} />
                  <FieldInput spec={{ ...sub("links", "redirectUrl"), label: "Card click goes to", help: "Normally your website; set this only to override." }} value={get(["links", "redirectUrl"])} onChange={set(["links", "redirectUrl"])} error={err(["links", "redirectUrl"])} />
                  <FieldInput spec={{ ...sub("affiliations", "roleTitle"), label: "Role at your institution", help: "Left blank, your title line is used." }} value={get(["affiliations", 0, "roleTitle"])} onChange={set(["affiliations", 0, "roleTitle"])} error={err(["affiliations", 0, "roleTitle"])} />
                </div>
                <FieldInput spec={{ ...spec("secondaryTitles"), label: "Other titles", help: "One per line — press Enter after each." }} value={get(["secondaryTitles"])} onChange={set(["secondaryTitles"])} error={err(["secondaryTitles"])} />
                <FieldInput
                  spec={{ ...spec("affiliations"), label: "All appointments", help: "The first one is the affiliation on your card. Add past or secondary appointments here." }}
                  value={get(["affiliations"])}
                  onChange={set(["affiliations"])}
                  error={err(["affiliations"])}
                  suggestions={{ institutionId: snapshot.content.institutions.map((i) => ({ id: i.id, label: i.shortName ?? i.name })) }}
                />
                <FieldInput spec={{ ...spec("profile"), label: "Education & research", help: "Degrees, research interests, philosophy. Shown in full only for the lab lead today, but kept for everyone." }} value={get(["profile"])} onChange={set(["profile"])} error={err(["profile"])} />
              </div>
            )}
          </div>
        </div>

        {/* ---- the rail: to-do + recommendations ---- */}
        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <div
                role="img"
                aria-label={`${pct}% complete`}
                className="flex size-14 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(var(--color-foreground) ${pct}%, var(--color-bg-alt) 0)` }}
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-background font-mono text-[11px] font-bold">{pct}%</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{pct === 100 ? "Looking complete" : pct >= 60 ? "Looking good" : "Good start"}</p>
                <p className="text-[12px] text-text-faint">
                  {pct === 100 ? "Nothing left on the list." : `${todos.length - done} quick thing${todos.length - done === 1 ? "" : "s"} would finish it.`}
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-0.5">
              {todos.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    onClick={() => focusTodo(t.key)}
                    className={`flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 -mx-2 text-left text-[13px] hover:bg-bg-alt ${t.done ? "text-text-faint line-through" : "text-foreground"}`}
                  >
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${t.done ? "border-foreground bg-invert-bg text-invert-fg" : "border-border"}`}>{t.done ? "✓" : ""}</span>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-border bg-bg-alt/60 p-4">
            <p className={mono}>Recommendations</p>
            <ul className="mt-2.5 space-y-3">
              {tips.slice(0, 5).map((tip) => (
                <li key={tip.id} className="space-y-1.5 text-[12.5px] leading-relaxed text-text-faint">
                  <p>{tip.text}</p>
                  {tip.action && (
                    <button type="button" onClick={() => { tip.action?.apply?.(); if (tip.action?.focus) focusTodo(tip.action.focus); }} className="font-mono text-[11px] font-bold tracking-wider text-foreground uppercase hover:underline">
                      {tip.action.label} →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <ActionButton primary onClick={() => void submit()} disabled={busy}>
          {busy ? "Sending…" : isNew ? "Send for approval" : "Send changes for approval"}
        </ActionButton>
        <button onClick={onCancel} disabled={busy} className="font-mono text-[11px] text-text-faint hover:text-foreground">
          Cancel
        </button>
        <p className="ml-auto max-w-sm text-right text-[11.5px] leading-snug text-text-faint">
          Nothing changes on the site until an admin approves it. Your edits are kept in this browser if you leave.
        </p>
      </div>
    </div>
  );
}

/** Dotted-path prefixes of fields shown on the card; anything else lives under "More". */
const CARD_PATHS = ["name", "personType", "roleTitle", "photo", "bio", "links.", "affiliations.0.institutionId", "affiliations.0.department", "labTenure.joinedYear"];

// --- tiny immutable path helpers ----------------------------------------------------

function getPath(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** Set a value at a path, creating objects/arrays on the way; `undefined` deletes the leaf. */
function setPath(obj: Rec, path: Path, value: unknown): Rec {
  const [head, ...rest] = path;
  const copy: Rec = { ...obj };
  if (rest.length === 0) {
    if (value === undefined) delete copy[head as string];
    else copy[head as string] = value;
    return copy;
  }
  const existing = copy[head as string];
  const next =
    typeof rest[0] === "number"
      ? setInArray(Array.isArray(existing) ? existing : [], rest as [number, ...Path], value)
      : setPath((existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {}) as Rec, rest, value);
  // An object emptied by deleting its last key is dropped so prune() has nothing to clean.
  if (next === undefined || (!Array.isArray(next) && Object.keys(next).length === 0)) delete copy[head as string];
  else copy[head as string] = next;
  return copy;
}

function setInArray(arr: unknown[], path: [number, ...Path], value: unknown): unknown[] | undefined {
  const [index, ...rest] = path;
  const copy = [...arr];
  if (rest.length === 0) {
    copy[index] = value;
  } else {
    const current = (copy[index] && typeof copy[index] === "object" ? copy[index] : {}) as Rec;
    const next = setPath(current, rest, value);
    if (Object.keys(next).length === 0) copy.splice(index, 1);
    else copy[index] = next;
  }
  return copy.length ? copy : undefined;
}
