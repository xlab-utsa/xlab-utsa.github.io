// The seven home-page design previews. Order = build order; slug = /preview/<slug>.
export const DESIGNS = [
  { slug: "bento", n: "01", name: "Bento", line: "A grid of tiles: statement, portrait, charts, photos and news, all at a glance." },
  { slug: "director", n: "02", name: "Director + data", line: "The PI pinned on the left; the lab's numbers, charts and people scroll past on the right." },
  { slug: "editorial", n: "03", name: "Editorial", line: "A research journal's front page: masthead, lead photo, a letter from the director, figures." },
  { slug: "cinematic", n: "04", name: "Cinematic", line: "Dark and full-bleed: crossfading lab photos, then one idea per screen." },
  { slug: "constellation", n: "05", name: "Constellation", line: "An interactive map linking research areas, lab members and their top venues." },
  { slug: "swiss", n: "06", name: "Swiss index", line: "A strict typographic grid; numbered sections that mirror the site's menu." },
  { slug: "story", n: "07", name: "Story scroll", line: "The lab told as a scroll: each research area lights up the chart in turn." },
  { slug: "hero", n: "08", name: "Hero ideas", line: "Two takes on the live home page's opening: balanced figures, a softer gallery, buttons." },
] as const;
