// Generates a large, DELIBERATELY-COVERAGE-DRIVEN synthetic dataset — not random
// noise, not a full combinatorial explosion (Person alone has enough optional-field/
// enum/relationship axes that a true cartesian product would be 1000+ near-duplicate
// records). Instead, for every entity:
//   1. Every enum value is represented at least a few times.
//   2. Every meaningful relationship pattern is represented (0/1/many FKs, FK absent
//      vs present, fan-in from multiple sources to one target, cross-institution).
//   3. Every optional-field "richness tier" is represented (minimal / typical /
//      maximal), rather than every individual field-presence permutation.
// Each record is tagged with `_covers: string[]` describing exactly which case(s) it
// demonstrates, so the Data Explorer can show *why* a given record exists.
//
// Content quality: every discrete "fact" field (role titles, paper/venue/course/org
// names, and — critically — email, which must match the generated person's own name)
// is drawn from curated academic-AI-lab word banks below, NOT faker's generic
// corporate generators (person.jobTitle, company.catchPhrase, company.buzzNoun etc
// produce business-buzzword nonsense like "Profound reciprocal moratorium" that reads
// as nothing at all in a research-lab context). faker is still used for genuinely
// realistic things it's good at: human names, cities/states, dates.
//
// This is 100% synthetic — fake names/institutions/text, never real people or real
// lab data. Lives in labbench/, never touches content/.

import { faker } from "@faker-js/faker";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

faker.seed(20260810); // reproducible across runs

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src", "synthetic");
const OUT_FILE = join(OUT_DIR, "data.generated.json");

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
let recordCounter = {};
function nextId(prefix) {
  recordCounter[prefix] = (recordCounter[prefix] ?? 0) + 1;
  return `fake-${prefix}-${String(recordCounter[prefix]).padStart(2, "0")}`;
}
function rec(record, covers) {
  return { record, covers };
}
const cycle = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const everyNth = (i, n) => i % n === 0;

// ---------------------------------------------------------------------------
// Curated academic word banks — this is the fix for "values I can't relate to."
// Everything here reads as a plausible AI/CS research-lab fact, not corporate filler.
// ---------------------------------------------------------------------------
const ROLE_TITLES_BY_TYPE = {
  "lab-lead": ["Lab Director", "Principal Investigator", "Founding Director"],
  postdoc: ["Postdoctoral Researcher", "Postdoctoral Fellow", "Postdoctoral Research Associate"],
  "research-staff": ["Research Scientist", "Senior Research Engineer", "Research Software Engineer", "Lab Manager"],
  "phd-student": ["PhD Candidate", "PhD Student"],
  "masters-student": ["MS Student", "Master's Student"],
  "undergrad-student": ["Undergraduate Researcher", "Undergraduate Research Assistant"],
  "grad-collaborator": ["Visiting Graduate Collaborator", "Graduate Research Collaborator"],
};
const DEPARTMENTS = ["Computer Science", "Computer Science & Engineering", "Electrical & Computer Engineering", "Data Science", "AI Systems", "Information Science"];
const AFFILIATION_TYPE_TITLES = {
  adjunct: ["Adjunct Professor", "Adjunct Research Professor"],
  visiting: ["Visiting Researcher", "Visiting Scholar"],
  affiliate: ["Affiliate Researcher", "Affiliate Faculty"],
};

const PAPER_ADJECTIVES = ["Scalable", "Efficient", "Robust", "Interpretable", "Adaptive", "Federated", "Lightweight", "Real-Time", "Generalizable", "Uncertainty-Aware", "Privacy-Preserving", "Energy-Efficient"];
const PAPER_METHODS = ["Graph Neural Networks", "Attention Mechanisms", "Reinforcement Learning", "Contrastive Learning", "Diffusion Models", "Transformer Architectures", "Meta-Learning", "Self-Supervised Representations", "Neural Architecture Search", "Sparse Mixture-of-Experts"];
const PAPER_TASKS = ["Object Detection", "Anomaly Detection", "Language Understanding", "Image Segmentation", "Time-Series Forecasting", "Recommendation", "Speech Recognition", "Code Generation", "Knowledge Graph Completion", "Visual Question Answering"];
const PAPER_DOMAINS = ["Edge Devices", "Autonomous Systems", "Healthcare", "Cybersecurity", "Smart Grids", "Robotics", "Educational Technology", "Financial Systems", "Wireless Networks", "Scientific Computing"];

function paperTitle(i) {
  const adj = cycle(PAPER_ADJECTIVES, i);
  const method = cycle(PAPER_METHODS, i + 3);
  const task = cycle(PAPER_TASKS, i + 5);
  const domain = cycle(PAPER_DOMAINS, i + 7);
  return `${adj} ${method} for ${task} in ${domain}`;
}
function shortProjectTitle(i) {
  const adj = cycle(PAPER_ADJECTIVES, i + 1);
  const method = cycle(PAPER_METHODS, i + 4);
  return `${adj} ${method}`;
}
function projectTagline(i) {
  const method = cycle(PAPER_METHODS, i + 2);
  const task = cycle(PAPER_TASKS, i + 6);
  return `${method} for ${task.toLowerCase()}.`;
}

const RESEARCH_INTERESTS = ["Graph Neural Networks", "Federated Learning", "Human-Robot Interaction", "Explainable AI", "Computer Vision", "Speech Processing", "Reinforcement Learning", "Edge Computing", "Differential Privacy", "Multimodal Learning", "Neural Architecture Search", "Causal Inference"];
const RESEARCH_TECHNIQUES = ["attention-based feature fusion", "contrastive pretraining", "graph convolution", "policy gradient optimization", "knowledge distillation", "adversarial training", "curriculum learning", "sparse attention routing"];

function academicSentence(i) {
  const adj = cycle(PAPER_ADJECTIVES, i);
  const method = cycle(PAPER_METHODS, i + 2);
  const task = cycle(PAPER_TASKS, i + 4);
  const domain = cycle(PAPER_DOMAINS, i + 6);
  const templates = [
    `Our work explores ${adj.toLowerCase()} ${method.toLowerCase()} for ${task.toLowerCase()} in ${domain.toLowerCase()}.`,
    `We are particularly interested in how ${method.toLowerCase()} can improve ${task.toLowerCase()} under real-world constraints.`,
    `This line of research aims to make ${task.toLowerCase()} more ${adj.toLowerCase()} for deployment in ${domain.toLowerCase()}.`,
    `Recent progress in ${method.toLowerCase()} has opened new directions for ${task.toLowerCase()}.`,
  ];
  return cycle(templates, i);
}
function academicParagraph(seed, sentences = 3) {
  return Array.from({ length: sentences }, (_, k) => academicSentence(seed + k * 3)).join(" ");
}

const CONFERENCE_NAMES = ["International Conference on Machine Learning Systems", "Symposium on Intelligent Data Systems", "International Conference on Autonomous Agents", "Conference on Trustworthy AI", "International Workshop on Scalable Computing", "Symposium on Human-Centered AI", "International Conference on Applied Data Science", "Workshop on Efficient Deep Learning", "International Symposium on Robotics and Automation", "Conference on Networked Intelligent Systems"];
const JOURNAL_NAMES = ["Journal of Intelligent Systems Research", "Transactions on Scalable Computing", "Journal of Applied Machine Learning", "Transactions on Data Engineering", "Journal of Robotics and Autonomous Systems", "Transactions on Human-Centered Computing", "Journal of Distributed AI Systems"];
// Real organizations — matches the lab's actual known funders/collaborators from
// data-extraction/sources/02-xlab-ub-com-live-site/extracted/recognitions.yaml
// (IBM Research appears repeatedly; Google via a Google Faculty Award), plus a few
// other real, well-known research funders/tech companies for variety. Not invented
// fictional company names.
const ORG_NAMES = ["IBM Research", "Google", "National Science Foundation", "NVIDIA", "Microsoft Research", "DARPA"];
const SERVICE_ROLES = ["Associate Editor", "Program Committee Member", "Workshop Co-Chair", "Session Chair", "Review Committee Member", "Panel Organizer", "Track Chair", "Publicity Chair", "Area Chair", "Guest Editor"];
const COURSE_TITLES = ["Introduction to Machine Learning", "Advanced Computer Vision", "Foundations of Deep Learning", "Distributed Systems", "Natural Language Processing", "Reinforcement Learning", "Data Structures and Algorithms", "AI Systems Design", "Robotics and Perception", "Applied Statistics for AI"];
const NEWS_TEMPLATES = [
  (name, topic) => `${name} Awarded Grant to Advance ${topic} Research`,
  (name, _t, venue) => `${name} Gives Invited Talk at ${venue}`,
  (_n, topic, venue) => `Lab Paper on ${topic} Accepted to ${venue}`,
  (name) => `${name} Recognized for Outstanding Contributions to AI Research`,
];

/** Generates a name and an EMAIL DERIVED FROM THAT SAME NAME — the core fix: the old
 * generator called faker.internet.email() as a fully independent random draw, so the
 * email never matched the person it was attached to. */
function personIdentity(domain = "example.edu") {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName, provider: domain }),
  };
}

// ---------------------------------------------------------------------------
// Institutions — the REAL ones, exactly matching content/institutions.yaml (not
// invented placeholder universities). This is the actual lab: X-Lab, currently
// spanning University at Buffalo and UT San Antonio, with UIUC as the PI's
// long-standing affiliate institution. No fictional "Alpha/Beta/Gamma" schools —
// every institutionId in this dataset resolves to one of these 3 real places.
// ---------------------------------------------------------------------------
const institutions = [
  rec(
    { id: "ub", name: "University at Buffalo", shortName: "UB", url: "https://www.buffalo.edu", city: "Buffalo", state: "NY", country: "United States" },
    ["real-institution"],
  ),
  rec(
    { id: "utsa", name: "The University of Texas at San Antonio", shortName: "UTSA", url: "https://www.utsa.edu", city: "San Antonio", state: "TX", country: "United States" },
    ["real-institution"],
  ),
  rec(
    { id: "uiuc", name: "University of Illinois at Urbana-Champaign", shortName: "UIUC", url: "https://illinois.edu", city: "Urbana-Champaign", state: "IL", country: "United States" },
    ["real-institution"],
  ),
];
const instIds = institutions.map((i) => i.record.id); // ["ub", "utsa", "uiuc"]
const UB = instIds[0],
  UTSA = instIds[1],
  UIUC = instIds[2];

// ---------------------------------------------------------------------------
// Persons — the richest entity. Coverage strategy:
//   A) 7 "baseline" records, one per personType enum value, each typical richness.
//   B) A dedicated edge-case record per relationship/richness pattern below.
//   C) A handful of realistic filler records (rotating personType) for volume/realism.
// ---------------------------------------------------------------------------
const PERSON_TYPES = [
  "lab-lead",
  "postdoc",
  "research-staff",
  "phd-student",
  "masters-student",
  "undergrad-student",
  "grad-collaborator",
];

function affiliationRoleTitle(personType, affiliationType, i) {
  if (affiliationType && affiliationType !== "primary") {
    return cycle(AFFILIATION_TYPE_TITLES[affiliationType], i);
  }
  return cycle(ROLE_TITLES_BY_TYPE[personType] ?? ROLE_TITLES_BY_TYPE["research-staff"], i);
}

function linksFor(identity, i) {
  return {
    email: identity.email,
    scholar: everyNth(i, 2) ? `https://scholar.example.com/citations?user=fake${i}` : undefined,
    website: everyNth(i, 3) ? `https://${identity.name.split(" ")[1].toLowerCase()}.example.dev` : undefined,
  };
}

const persons = [];

// A) one baseline per personType enum value — guarantees full enum coverage
PERSON_TYPES.forEach((type, i) => {
  const identity = personIdentity();
  const roleTitle = type === "lab-lead" ? "Lab Director" : cycle(ROLE_TITLES_BY_TYPE[type], i);
  persons.push(
    rec(
      {
        id: nextId("person"),
        name: identity.name,
        personType: type,
        roleTitle,
        photo: `/images/people/${faker.helpers.slugify(identity.name).toLowerCase()}.jpg`,
        links: linksFor(identity, i),
        affiliations: [
          {
            institutionId: cycle(instIds, i),
            department: cycle(DEPARTMENTS, i),
            roleTitle: affiliationRoleTitle(type, "primary", i),
            type: "primary",
            startDate: `${2018 + i}-0${(i % 8) + 1}`,
          },
        ],
        labTenure: { joinedYear: 2020 + i },
      },
      [`personType=${type}`, "single-affiliation", "typical-richness"],
    ),
  );
});

// B) dedicated edge cases
{
  const p1 = personIdentity();
  const p2 = personIdentity();
  const p3 = personIdentity();
  const p4 = personIdentity();
  const p5 = personIdentity();
  const p6 = personIdentity();
  const p7 = personIdentity();

  persons.push(
    rec(
      { id: nextId("person"), name: p1.name, personType: "phd-student", roleTitle: "PhD Student, 1st Year" },
      ["minimal-record", "no-optional-fields", "0-affiliations", "no-labTenure"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p2.name,
        personType: "postdoc",
        roleTitle: "Postdoctoral Fellow",
        photo: "/images/people/fake-multi-institution.jpg",
        office: "300 Fake Hall",
        links: { email: p2.email },
        affiliations: [
          { institutionId: UB, department: "Computer Science", roleTitle: "Postdoctoral Fellow", type: "primary", startDate: "2023-01" },
          { institutionId: UTSA, department: "AI Systems", roleTitle: "Visiting Researcher", type: "visiting", startDate: "2024-06" },
          { institutionId: UIUC, roleTitle: "Affiliate Researcher", type: "affiliate", startDate: "2022-09" },
        ],
        labTenure: { joinedYear: 2023 },
      },
      ["multi-institution-3", "mixed-affiliation-types", "cross-institution"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p3.name,
        personType: "lab-lead",
        roleTitle: "Founding Director",
        secondaryTitles: ["Distinguished Fellow", "Editor-in-Chief, Journal of Intelligent Systems Research"],
        links: {
          email: p3.email,
          scholar: "https://scholar.example.com/citations?user=founder",
          website: `https://${p3.name.split(" ")[1].toLowerCase()}.example.dev`,
          universityProfile: "https://www.utsa.edu/people/founder-example",
          linkedin: `https://linkedin.com/in/${faker.helpers.slugify(p3.name).toLowerCase()}`,
          github: `https://github.com/${p3.name.split(" ")[1].toLowerCase()}`,
        },
        // This case is deliberately shaped after the lab's own real PI history (see
        // data-extraction/sources/03-linkedin-scholar-utsa-news): a founding-dean-style
        // move to a new primary institution while keeping the old one as adjunct, plus
        // a long-standing third-institution affiliate role — now using the real 3
        // institutions instead of fictional ones, so it actually mirrors that pattern.
        affiliations: [
          { institutionId: UTSA, department: "AI Systems", roleTitle: "Founding Director", type: "primary", startDate: "2026-01" },
          { institutionId: UB, department: "Computer Science", roleTitle: "Adjunct Professor", type: "adjunct", startDate: "2026-01" },
          { institutionId: UB, department: "Computer Science", roleTitle: "Endowed Professor", type: "primary", startDate: "2019-08", endDate: "2025-12" },
          { institutionId: UIUC, roleTitle: "Affiliate Research Professor", type: "affiliate", startDate: "2015-07" },
        ],
        // Deliberately no labTenure — mirrors the real dry-run finding that "joined the
        // lab" doesn't cleanly apply to a founder.
      },
      ["overlapping-affiliation-history", "4-affiliations", "founder-no-labTenure", "rich-links"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p4.name,
        personType: "research-staff",
        roleTitle: "Senior Research Engineer",
        photo: "/images/people/fake-full-profile.jpg",
        bio: academicParagraph(1, 2),
        links: linksFor(p4, 99),
        affiliations: [{ institutionId: UB, department: "AI Systems", roleTitle: "Senior Research Engineer", type: "primary", startDate: "2021-03" }],
        labTenure: { joinedYear: 2021 },
        profile: {
          education: [
            { degree: "Ph.D.", institution: "Fake Tech University", year: 2015, note: "Dissertation Award" },
            { degree: "M.S.", institution: "Example State University", year: 2011 },
            { degree: "B.S.", institution: "Sample Institute", year: 2009 },
          ],
          researchPhilosophy: academicParagraph(4, 3),
          researchInterests: faker.helpers.arrayElements(RESEARCH_INTERESTS, 5),
          researchAgenda: Array.from({ length: 3 }, (_, k) => ({
            project: shortProjectTitle(k * 2),
            description: academicSentence(k * 5),
            representativeTechniques: faker.helpers.arrayElements(RESEARCH_TECHNIQUES, 2),
          })),
          futureVision: academicParagraph(7, 2),
          quote: "Good research starts with a question worth asking twice.",
        },
      },
      ["full-profile", "profile-on-non-lead", "rich-richness"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p5.name,
        personType: "masters-student",
        roleTitle: "MS Student, Graduating Spring",
        links: { email: p5.email },
        affiliations: [{ institutionId: UB, department: "Computer Science", roleTitle: "MS Student", type: "primary", startDate: "2023-08", endDate: "2025-05" }],
        labTenure: { joinedYear: 2023, leftYear: 2025 },
      },
      ["alumni", "affiliation-also-ended", "labTenure-and-affiliation-both-end"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p6.name,
        personType: "undergrad-student",
        roleTitle: "Undergraduate Researcher",
        affiliations: [{ institutionId: UB, roleTitle: "Undergraduate Researcher", type: "primary" }],
        labTenure: { joinedYear: 2022, leftYear: null },
      },
      ["labTenure-leftYear-explicit-null", "current-member"],
    ),
    rec(
      {
        id: nextId("person"),
        name: "田中 陽子",
        personType: "grad-collaborator",
        roleTitle: "Visiting Graduate Collaborator",
        links: { email: "yoko.tanaka@example.ac.jp" },
        affiliations: [{ institutionId: UTSA, roleTitle: "Visiting Graduate Collaborator", type: "visiting", startDate: "2025-04" }],
      },
      ["unicode-name", "cjk-characters"],
    ),
    rec(
      {
        id: nextId("person"),
        name: p7.name,
        personType: "phd-student",
        roleTitle: "PhD Candidate, 5th Year",
        secondaryTitles: ["Teaching Fellow", "Student Chapter President", "Outreach Coordinator", "Peer Mentor"],
        labTenure: { joinedYear: 2019 },
      },
      ["many-secondary-titles-4", "long-tenure-7yr"],
    ),
  );
}

// C) filler for volume/realism — still tagged, still meaningful, just not a unique edge case
for (let i = 0; i < 14; i++) {
  const type = cycle(PERSON_TYPES, i + 2);
  const hasBio = everyNth(i, 3);
  const identity = personIdentity();
  const noAffiliation = everyNth(i, 4);
  persons.push(
    rec(
      {
        id: nextId("person"),
        name: identity.name,
        personType: type,
        roleTitle: cycle(ROLE_TITLES_BY_TYPE[type], i),
        photo: everyNth(i, 2) ? `/images/people/${faker.helpers.slugify(identity.name).toLowerCase()}.jpg` : undefined,
        bio: hasBio ? academicSentence(i) : undefined,
        links: linksFor(identity, i + 10),
        affiliations: noAffiliation
          ? []
          : [
              {
                institutionId: cycle(instIds, i + 1),
                department: cycle(DEPARTMENTS, i + 2),
                roleTitle: affiliationRoleTitle(type, cycle(["primary", "adjunct", "visiting", "affiliate"], i), i),
                type: cycle(["primary", "adjunct", "visiting", "affiliate"], i),
                startDate: `${2019 + (i % 6)}-0${(i % 8) + 1}`,
              },
            ],
        labTenure: everyNth(i, 5) ? undefined : { joinedYear: 2019 + (i % 6) },
      },
      [`personType=${type}`, noAffiliation ? "0-affiliations" : "single-affiliation", "filler"],
    ),
  );
}

const personIds = persons.map((p) => p.record.id);

// ---------------------------------------------------------------------------
// Research themes — coverage: optional-field presence (icon/order/longDescription).
// ---------------------------------------------------------------------------
const themes = [
  rec({ id: "fake-theme-vision", title: "Fake Computer Vision", shortDescription: "Understanding images and video.", longDescription: academicParagraph(0, 3), icon: "images/icons/fake-vision.svg", order: 1 }, ["all-fields"]),
  rec({ id: "fake-theme-nlp", title: "Fake Language Understanding", shortDescription: "Processing and generating text.", longDescription: academicParagraph(3, 3), icon: "images/icons/fake-nlp.svg", order: 2 }, ["all-fields"]),
  rec({ id: "fake-theme-systems", title: "Fake Distributed Systems", shortDescription: "Scaling software across machines." }, ["minimal-fields", "no-longDescription", "no-icon", "no-order"]),
  rec({ id: "fake-theme-hardware", title: "Fake Hardware Accelerators", shortDescription: "Custom silicon for AI workloads.", longDescription: academicParagraph(6, 5) }, ["long-description", "no-order"]),
  rec({ id: "fake-theme-security", title: "Fake Security & Privacy", shortDescription: "Protecting systems and data.", order: 5 }, ["no-longDescription"]),
  rec({ id: "fake-theme-robotics", title: "Fake Robotics", shortDescription: "Physical agents acting in the world.", longDescription: academicParagraph(9, 3), icon: "images/icons/fake-robotics.svg" }, ["no-order"]),
  rec({ id: "fake-theme-hci", title: "Fake Human-Computer Interaction", shortDescription: "Designing systems people can trust.", order: 7 }, ["short-description"]),
  rec({ id: "fake-theme-empty-theme", title: "Fake Theme With Zero Projects", shortDescription: "Deliberately has no linked projects.", order: 8 }, ["zero-linked-projects"]),
];
const themeIds = themes.map((t) => t.record.id);

// ---------------------------------------------------------------------------
// Publications — coverage per category: featured, note, doi, and category-specific
// field combinations, generated systematically (not hand-listed) via rotation.
// ---------------------------------------------------------------------------
// Returns an ordered AuthorRef[] ({name, personId?}), NOT a plain string — this is the
// fix for "authors never link to real X-Lab people." Most authors are external
// (no Person record, name-only), but every few publications include one of our own
// synthetic lab members as a co-author, with `personId` set — demonstrating exactly
// the linking capability the schema now supports. Real content/publications/*.yaml
// does the same thing by hand for the 1-2 real records that name Jinjun Xiong.
function authorList(i) {
  const externalCount = [1, 2, 3, 5][i % 4];
  const authors = Array.from({ length: externalCount }, () => ({ name: faker.person.fullName() }));
  if (everyNth(i, 3)) {
    const labAuthorId = cycle(personIds, i);
    const labAuthor = persons.find((p) => p.record.id === labAuthorId).record;
    // insert the lab author in a plausible middle-ish position rather than always first/last
    authors.splice(Math.min(1, authors.length), 0, { name: labAuthor.name, personId: labAuthorId });
  }
  if (authors.length >= 5) {
    return [...authors.slice(0, 4), { name: "et al." }];
  }
  return authors;
}
const NOTES = ["in press", "Spotlight", "cover featured", undefined, undefined, undefined];

function buildPublicationsForCategory(category, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const base = {
      id: nextId(`pub-${category}`),
      category,
      title: paperTitle(i + (category.length % 5)),
      authors: authorList(i),
      year: 2005 + ((i * 3) % 20),
      featured: everyNth(i, 5),
      note: cycle(NOTES, i),
      doi: everyNth(i, 4) ? `10.1234/fake.${category}.${1000 + i}` : undefined,
    };
    const covers = [`category=${category}`, base.featured ? "featured" : "not-featured", base.note ? "has-note" : "no-note", base.doi ? "has-doi" : "no-doi"];

    if (category === "patent") {
      const chinaStyle = everyNth(i, 6);
      Object.assign(base, {
        patentNo: chinaStyle ? `CN ${1000000 + i}C` : `P${202100 + i}US01`,
        docketNo: chinaStyle ? undefined : `Y${900000 + i}`,
        applicationNo: chinaStyle || everyNth(i, 3) ? undefined : `17/${100000 + i}`,
        filedDate: `${2010 + (i % 15)}-0${(i % 8) + 1}`,
        issuedDate: everyNth(i, 2) ? `${2012 + (i % 15)}-0${(i % 8) + 1}` : undefined,
        jurisdiction: chinaStyle ? "China Patent" : undefined,
      });
      covers.push(chinaStyle ? "international-jurisdiction" : "us-docket-style");
    } else if (category === "journal") {
      Object.assign(base, {
        venue: cycle(JOURNAL_NAMES, i),
        volumeIssue: everyNth(i, 4) ? undefined : `Vol. ${10 + i}, No. ${1 + (i % 4)}`,
        month: everyNth(i, 2) ? faker.date.month() : undefined,
      });
      covers.push(base.volumeIssue ? "has-volumeIssue" : "no-volumeIssue");
    } else if (category === "conference" || category === "workshop") {
      Object.assign(base, {
        venue: `${cycle(CONFERENCE_NAMES, i)} ${2005 + (i % 20)}`,
        location: everyNth(i, 3) ? `${faker.location.city()}, ${faker.location.state()}` : undefined,
        dateDisplay: `${faker.date.month()} ${2005 + (i % 20)}`,
      });
      covers.push(base.location ? "has-location" : "no-location");
    } else if (category === "invited-paper") {
      Object.assign(base, {
        venue: `${cycle(CONFERENCE_NAMES, i + 2)} ${2005 + (i % 20)}`,
        location: `${faker.location.city()}, ${faker.date.month()} ${2005 + (i % 20)}`,
      });
    } else if (category === "book-chapter") {
      Object.assign(base, {
        book: `Handbook of ${cycle(PAPER_METHODS, i)}`,
        editors: everyNth(i, 2) ? `${faker.person.fullName()}, ${faker.person.fullName()}` : undefined,
        publisher: cycle(["Fake Springer", "Fake Wiley", "Fake Academic Press"], i),
        onlineIsbn: everyNth(i, 3) ? `978-${1000000000 + i}` : undefined,
      });
      covers.push(base.editors ? "has-editors" : "no-editors");
    }

    if (everyNth(i, 7)) {
      base.pdfUrl = `https://fake-repo.example.com/papers/${base.id}.pdf`;
      covers.push("has-pdfUrl");
    }
    if (everyNth(i, 8)) {
      base.url = `https://fake-repo.example.com/${base.id}`;
      covers.push("has-url");
    }

    list.push(rec(base, covers));
  }
  return list;
}

const publications = [
  ...buildPublicationsForCategory("patent", 16),
  ...buildPublicationsForCategory("journal", 16),
  ...buildPublicationsForCategory("conference", 18),
  ...buildPublicationsForCategory("workshop", 16),
  ...buildPublicationsForCategory("invited-paper", 12),
  ...buildPublicationsForCategory("book-chapter", 12),
];
const publicationIds = publications.map((p) => p.record.id);
const featuredPublicationIds = publications.filter((p) => p.record.featured).map((p) => p.record.id);

// ---------------------------------------------------------------------------
// Projects — coverage: every status x (themeId set vs null), every link-pattern,
// featured toggle.
// ---------------------------------------------------------------------------
const PROJECT_STATUSES = ["active", "deployed", "archived"];
function linkPattern(patternIndex, i) {
  switch (patternIndex) {
    case 0:
      return {};
    case 1:
      return { paperUrl: `https://fake-repo.example.com/papers/proj-${i}.pdf` };
    case 2:
      return { code: `https://github.com/fake-lab/proj-${i}` };
    case 3:
      return { demo: `https://demo.fake-lab.example.dev/proj-${i}`, video: `https://video.fake-lab.example.dev/proj-${i}` };
    case 4:
      return { publicationId: cycle(publicationIds, i) };
    default:
      return {
        paperUrl: `https://fake-repo.example.com/papers/proj-${i}.pdf`,
        code: `https://github.com/fake-lab/proj-${i}`,
        demo: `https://demo.fake-lab.example.dev/proj-${i}`,
        video: `https://video.fake-lab.example.dev/proj-${i}`,
        poster: `https://fake-repo.example.com/posters/proj-${i}.pdf`,
        website: `https://proj-${i}.fake-lab.example.dev`,
      };
  }
}

const projects = [];
let projIdx = 0;
for (const status of PROJECT_STATUSES) {
  for (let j = 0; j < 8; j++) {
    const withTheme = j % 2 === 0;
    const links = linkPattern(projIdx % 6, projIdx);
    // contributors: 0 for ~1/3, 1 for ~1/3, 2-3 for the rest — real Person FKs, distinct
    // from collaborationWith (which names an external org, not a lab member).
    const contributorCount = projIdx % 3;
    const contributors = contributorCount
      ? Array.from(new Set(Array.from({ length: contributorCount }, (_, k) => cycle(personIds, projIdx + k * 5))))
      : undefined;
    projects.push(
      rec(
        {
          id: nextId("project"),
          title: shortProjectTitle(projIdx),
          tagline: projectTagline(projIdx),
          description: everyNth(projIdx, 3) ? academicParagraph(projIdx, 2) : undefined,
          thumbnail: everyNth(projIdx, 2) ? `/images/projects/fake-${projIdx}/thumbnail.jpg` : undefined,
          themeId: withTheme ? cycle(themeIds, projIdx) : null,
          status,
          collaborationWith: everyNth(projIdx, 4) ? cycle(ORG_NAMES, projIdx) : undefined,
          contributors,
          featured: everyNth(projIdx, 3),
          links,
        },
        [
          `status=${status}`,
          withTheme ? "theme-set" : "theme-null",
          `link-pattern-${projIdx % 6}`,
          Object.keys(links).length === 0 ? "no-links" : "has-links",
          contributors ? `contributors-count-${contributors.length}` : "0-contributors",
        ],
      ),
    );
    projIdx++;
  }
}

// ---------------------------------------------------------------------------
// Posts — coverage: kind x body/tags/author/sourceUrl/relatedPublicationId presence.
// News uses announcement-style templates; Blog uses paper/explainer-style titles.
// ---------------------------------------------------------------------------
const posts = [];
for (let i = 0; i < 12; i++) {
  const kind = i % 2 === 0 ? "news" : "blog";
  const hasBody = kind === "blog" ? !everyNth(i, 6) : everyNth(i, 3);
  const hasAuthor = everyNth(i, 2);
  const hasTags = kind === "blog" ? !everyNth(i, 4) : everyNth(i, 5);
  const authorId = hasAuthor ? cycle(personIds, i) : undefined;
  const authorName = hasAuthor ? persons.find((p) => p.record.id === authorId)?.record.name : undefined;
  const topic = cycle(PAPER_TASKS, i);
  const venue = cycle(CONFERENCE_NAMES, i);
  const title =
    kind === "news"
      ? cycle(NEWS_TEMPLATES, i)(authorName ?? "Lab Member", topic, venue)
      : `Understanding ${cycle(PAPER_METHODS, i)}: A Primer on ${topic}`;
  const covers = [`kind=${kind}`, hasBody ? "has-body" : "no-body", hasAuthor ? "has-author" : "no-author"];
  posts.push(
    rec(
      {
        id: nextId("post"),
        kind,
        date: faker.date.past({ years: 4 }).toISOString().slice(0, 10),
        title,
        summary: academicSentence(i),
        body: hasBody ? academicParagraph(i, 4) : undefined,
        image: everyNth(i, 3) ? `/images/posts/fake-${i}.jpg` : undefined,
        authorId,
        tags: hasTags ? faker.helpers.arrayElements(["AI", "Systems", "NLP", "Vision", "Hardware", "Security"], 2) : undefined,
        sourceUrl: kind === "news" && everyNth(i, 3) ? `https://news.fake-university.example.edu/${2020 + i}/announcement` : undefined,
        relatedPublicationId: everyNth(i, 4) ? cycle(publicationIds, i + 5) : undefined,
      },
      covers,
    ),
  );
}
// two deliberate extremes
posts.push(
  rec(
    { id: nextId("post"), kind: "news", date: "2026-02-01", title: "Bare Minimum News Item", summary: "Only the required fields are set." },
    ["minimal-record", "kind=news"],
  ),
  rec(
    {
      id: nextId("post"),
      kind: "blog",
      date: "2026-03-15",
      title: `Understanding ${cycle(PAPER_METHODS, 20)}: A Deep Dive`,
      summary: academicSentence(20),
      body: academicParagraph(20, 6),
      image: "/images/posts/fake-maximal.jpg",
      authorId: cycle(personIds, 0),
      tags: ["AI", "Systems", "NLP"],
      sourceUrl: "https://news.fake-university.example.edu/2026/deep-dive",
      relatedPublicationId: featuredPublicationIds[0],
    },
    ["maximal-record", "kind=blog", "links-to-featured-publication"],
  ),
);

// ---------------------------------------------------------------------------
// Recognitions — coverage: every category, publicationId present/absent, spread
// across multiple different people (not just the lab lead).
// ---------------------------------------------------------------------------
const RECOGNITION_CATEGORIES = ["best-paper-award", "best-paper-nomination", "best-poster-award", "international-competition-award", "professional-honor-award"];
const recognitions = [];
let recIdx = 0;
for (const category of RECOGNITION_CATEGORIES) {
  for (let j = 0; j < 4; j++) {
    const withPub = j % 2 === 0;
    recognitions.push(
      rec(
        {
          id: nextId("recognition"),
          category,
          personId: cycle(personIds, recIdx),
          award: category
            .split("-")
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(" "),
          year: 2008 + (recIdx % 18),
          title: withPub ? undefined : paperTitle(recIdx),
          venue: `${cycle(CONFERENCE_NAMES, recIdx)} ${2008 + (recIdx % 18)}`,
          org: everyNth(recIdx, 3) ? cycle(ORG_NAMES, recIdx) : undefined,
          publicationId: withPub ? cycle(publicationIds, recIdx) : undefined,
        },
        [`category=${category}`, withPub ? "linked-to-publication" : "no-publication-link", recIdx % 3 === 0 ? "person-is-not-lab-lead-example" : "varied-person"],
      ),
    );
    recIdx++;
  }
}

// ---------------------------------------------------------------------------
// ServiceRecords — coverage: every category, and every period-text shape observed
// in the real data (clean range, irregular multi-range, ongoing, single year, free text).
// ---------------------------------------------------------------------------
const SERVICE_CATEGORIES = ["editorial", "conference-leadership", "technical-program-committee", "community-service", "university-service"];
const PERIOD_PATTERNS = [
  (y) => ({ periodDisplay: `${y}–${y + 2}`, startYear: y, endYear: y + 2, isOngoing: false }),
  (y) => ({ periodDisplay: `${y}–present`, startYear: y, isOngoing: true }),
  (y) => ({ periodDisplay: `${y}, ${y + 3}, ${y + 5}–${y + 6}`, isOngoing: false }), // irregular, not parsed into start/end
  (y) => ({ periodDisplay: `${y}` }), // single year, no range
  () => ({ periodDisplay: "Multiple semesters" }), // free text, no year at all
];
const serviceRecords = [];
let svcIdx = 0;
for (const category of SERVICE_CATEGORIES) {
  for (let j = 0; j < 4; j++) {
    const period = cycle(PERIOD_PATTERNS, svcIdx)(2008 + svcIdx);
    serviceRecords.push(
      rec(
        {
          id: nextId("service"),
          personId: cycle(personIds, svcIdx + 3),
          category,
          role: cycle(SERVICE_ROLES, svcIdx),
          org: everyNth(svcIdx, 2) ? `${cycle(CONFERENCE_NAMES, svcIdx)}` : undefined,
          ...period,
        },
        [`category=${category}`, `period-pattern-${svcIdx % PERIOD_PATTERNS.length}`],
      ),
    );
    svcIdx++;
  }
}

// ---------------------------------------------------------------------------
// Courses — coverage: institutionId vs institutionName fallback, code present/absent.
// ---------------------------------------------------------------------------
const courses = [];
for (let i = 0; i < 10; i++) {
  const useInstitutionId = i % 2 === 0;
  courses.push(
    rec(
      {
        id: nextId("course"),
        personId: cycle(personIds, i + 7),
        code: everyNth(i, 3) ? undefined : `FAKE ${100 + i * 10}`,
        title: cycle(COURSE_TITLES, i),
        institutionId: useInstitutionId ? cycle(instIds, i) : undefined,
        // Real universities NOT in our Institution table — this is the actual real
        // pattern (see data-extraction/.../extracted/teaching.yaml: the PI really did
        // teach at Columbia University as a one-off, outside his own lab's institutions).
        institutionName: useInstitutionId ? undefined : cycle(["Columbia University", "Carnegie Mellon University", "Georgia Institute of Technology"], i),
        termDisplay: cycle(["Fall 2024", "Spring 2025", "Multiple semesters", "Summer 2023"], i),
      },
      [useInstitutionId ? "institutionId-set" : "institutionName-fallback", everyNth(i, 3) ? "no-code" : "has-code"],
    ),
  );
}

// ---------------------------------------------------------------------------
// Sponsors — coverage: url present/absent, grantNumbers count 0/1/many.
// ---------------------------------------------------------------------------
const GRANT_PATTERNS = [[], [`FAKE-${faker.number.int({ min: 1000000, max: 9999999 })}`], Array.from({ length: 3 }, () => `FAKE-${faker.number.int({ min: 1000000, max: 9999999 })}`)];
const sponsors = [];
for (let i = 0; i < 9; i++) {
  const grants = cycle(GRANT_PATTERNS, i);
  sponsors.push(
    rec(
      {
        id: nextId("sponsor"),
        name: cycle(ORG_NAMES, i),
        logo: `/images/sponsors/fake-${i}.png`,
        url: everyNth(i, 3) ? undefined : `https://${cycle(ORG_NAMES, i).toLowerCase().replace(/\s+/g, "")}.example.com`,
        grantNumbers: grants.length ? grants : undefined,
      },
      [everyNth(i, 3) ? "no-url" : "has-url", `grantNumbers-count-${grants.length}`],
    ),
  );
}

// ---------------------------------------------------------------------------
// SiteMeta — one fully-populated example (contrast with the real dry run's mostly-
// null one, which is intentionally left sparse pending a real content decision).
// ---------------------------------------------------------------------------
const siteMeta = [
  rec(
    {
      // Real X-Lab identity (matches content/site-meta.yaml), not an invented brand —
      // this is the "fully populated" demo of a SiteMeta record whose real counterpart
      // deliberately leaves contact/primaryInstitutionId null pending a real decision
      // (see docs/SCHEMA.md). Address reuses the one real address on file (UB dept
      // office, from data-extraction source 02) as a plausible fully-populated example.
      title: "X-Lab",
      tagline: "Accelerating AI Systems & Solutions",
      description: "X-Lab — cross-stack AI systems and solutions research.",
      keywords: ["AI", "machine learning", "deep learning", "AI systems", "research"],
      nav: [
        { label: "Home", path: "/" },
        { label: "Research", path: "/research" },
        {
          label: "Publications",
          path: "/publications",
          children: [
            { label: "Patents", path: "/publications/patents" },
            { label: "Journals", path: "/publications/journals" },
          ],
        },
        { label: "Team", path: "/team" },
      ],
      contact: {
        email: "jinjun@buffalo.edu",
        phone: "(716) 645-4760",
        address: { line1: "316 Davis Hall", city: "Buffalo", state: "NY", zip: "14260-2500", country: "United States" },
      },
      primaryInstitutionId: UTSA,
      recruitingNotice: "We are recruiting PhD students and postdoctoral fellows to conduct cutting-edge AI systems and solutions research!",
      socialLinks: { github: "https://github.com/x-labs", linkedin: "https://linkedin.com/company/xlab", huggingface: "https://huggingface.co/x-labs" },
      logo: { light: "/images/logos/xlab-black-logo.png", dark: "/images/logos/xlab-white-logo.png" },
    },
    ["maximal-record", "every-optional-field-populated"],
  ),
];

// ---------------------------------------------------------------------------
// write output + a coverage summary
// ---------------------------------------------------------------------------
const dataset = {
  institution: institutions,
  person: persons,
  "research-theme": themes,
  project: projects,
  publication: publications,
  post: posts,
  "site-meta": siteMeta,
  recognition: recognitions,
  "service-record": serviceRecords,
  course: courses,
  sponsor: sponsors,
};

function summarizeCoverage(dataset) {
  const summary = {};
  for (const [entityId, records] of Object.entries(dataset)) {
    const tagCounts = {};
    for (const { covers } of records) {
      for (const tag of covers) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
    summary[entityId] = { totalRecords: records.length, tagCounts };
  }
  return summary;
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT_FILE,
  JSON.stringify(
    {
      generatedAt: new Date(0).toISOString(), // stamped at 0 — deterministic output, diff-friendly
      seed: 20260810,
      dataset,
      coverage: summarizeCoverage(dataset),
    },
    null,
    2,
  ) + "\n",
);

const totalRecords = Object.values(dataset).reduce((sum, arr) => sum + arr.length, 0);
console.log(`[generate-synthetic-data] wrote ${OUT_FILE}`);
console.log(`[generate-synthetic-data] ${totalRecords} total synthetic records across ${Object.keys(dataset).length} entities`);
for (const [id, records] of Object.entries(dataset)) {
  console.log(`  ${id.padEnd(16)} ${records.length}`);
}
