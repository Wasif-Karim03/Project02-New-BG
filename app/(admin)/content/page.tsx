import { PageHeader, Card, page } from "../_components/ui";

// The public website's text + images are managed in Keystatic (the marketing site's
// built-in, Git-backed CMS). This hub links straight into each editable area. The
// marketing origin is env-configurable; Keystatic lives at /keystatic there.
const SITE = process.env.NEXT_PUBLIC_MARKETING_URL || "http://localhost:3001";
const singleton = (key: string) => `${SITE}/keystatic/singleton/${key}`;
const collection = (key: string) => `${SITE}/keystatic/collection/${key}`;

const GROUPS: { title: string; items: { label: string; href: string; hint: string }[] }[] = [
  {
    title: "Homepage & site",
    items: [
      { label: "Site settings & homepage", href: singleton("siteSettings"), hint: "Headlines, hero, mission, footer, logo, nav" },
      { label: "Stats snapshot & hero", href: singleton("statsSnapshot"), hint: "The numbers + homepage hero image/eyebrows" },
      { label: "Section labels", href: singleton("pageHeaders"), hint: "Every page's small section eyebrow labels" },
    ],
  },
  {
    title: "Pages",
    items: [
      { label: "Donate page", href: singleton("donatePage"), hint: "Headline, intro, giving copy" },
      { label: "Contact page", href: singleton("contactPage"), hint: "Headline, intro, contact details" },
      { label: "Donors page", href: singleton("donorsPage"), hint: "Donor-wall copy" },
      { label: "Terms page", href: singleton("termsPage"), hint: "Terms & legal text" },
    ],
  },
  {
    title: "People & stories",
    items: [
      { label: "Students", href: collection("student"), hint: "Profiles, photos, stories" },
      { label: "Testimonials", href: collection("testimonial"), hint: "Quotes & attributions" },
      { label: "Success stories", href: collection("successStory"), hint: "Alumni outcomes" },
      { label: "Board members", href: collection("boardMember"), hint: "Names, roles, photos" },
    ],
  },
  {
    title: "Programs & media",
    items: [
      { label: "Projects", href: collection("project"), hint: "Titles, summaries, images" },
      { label: "Activities", href: collection("activity"), hint: "Program activities" },
      { label: "Schools", href: collection("school"), hint: "Partner schools" },
      { label: "Gallery images", href: collection("galleryImage"), hint: "Photos across the site" },
      { label: "Blog posts", href: collection("blogPost"), hint: "Articles & updates" },
    ],
  },
];

export default function ContentHubPage() {
  return (
    <div className={page}>
      <PageHeader title="Website content" description="Edit the public website's text and images. Each area opens the content editor in a new tab.">
        <a href={`${SITE}/keystatic`} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Open editor ↗</a>
      </PageHeader>

      <div className="space-y-8">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{g.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.items.map((it) => (
                <a key={it.label} href={it.href} target="_blank" rel="noreferrer">
                  <Card className="flex items-center justify-between p-4 transition-colors hover:bg-slate-50">
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{it.label}</span>
                      <span className="block text-xs text-slate-500">{it.hint}</span>
                    </span>
                    <span className="text-slate-400">↗</span>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-400">Changes are saved to the website&apos;s content and published on the next site update. The editor has its own sign-in.</p>
    </div>
  );
}
