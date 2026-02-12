# Portfolio Redesign — Full Design Specification
## Mat Harvey — Developer & Marine Scientist

---

## Part 1: Critique of Current Design

### Overall Impression

The current site reads as a **developer's project dump**, not a portfolio. It's technically competent but aesthetically generic — it looks like every dark-mode "hacker portfolio" template from 2021. There is no story, no hierarchy, no reason for someone to remember it. A hiring manager, client, or collaborator would scroll, feel overwhelmed by 58 undifferentiated cards, and leave.

Here's what needs to change:

---

### 1. Typography — Monotonous and Dated

**Problem:** `Space Mono` as the body font is the single biggest aesthetic mistake. Monospace body text is hard to read at scale, creates visual fatigue, and screams "I am a coder" rather than "I am a professional who builds things." The `Syne` display font is fine but overused in indie-dev circles — it's become the new default "creative tech" font.

**Fix:** The body needs a refined sans-serif with good readability at small sizes. The display font should have genuine character — something with weight and confidence that reflects both the marine/industrial and the technical domains. Think of the typographic confidence of an Apple product page or a Red Bull campaign: they pick one hero font and let it breathe.

**Spec:**
- **Display/Hero:** `Instrument Serif` or `Playfair Display` — unexpected on a dev portfolio, immediately distinguishing. Alternatively, `Clash Display` from Fontshare for a more geometric, modern feel.
- **Body:** `Satoshi` (Fontshare) or `General Sans` — clean, contemporary, excellent readability, not overused.
- **Mono (code tags only):** `JetBrains Mono` — only used for tech tags and code references, never for body copy.

---

### 2. Color — Too Many Competing Accents

**Problem:** The palette defines `--accent` (green), `--orange`, `--blue`, and `--live-green` — four accent colors with no clear hierarchy. The green accent (#00e5a0) is a "Matrix hacker" green that reinforces the generic developer aesthetic. The orange appears in a background orb but nowhere functional. This is palette confusion, not palette design.

**Fix:** Commit to a **two-color accent system** with clear roles. Given Mat's dual identity (marine science + software), the palette should evoke depth, precision, and the ocean — without being literal or cliché.

**Spec:**
```
--bg:             #09090b          /* Near-black, warm undertone */
--surface:        #131316          /* Card/panel background */
--surface-raised: #1c1c21          /* Hover/elevated surface */
--border:         rgba(255,255,255,0.06)  /* Barely visible structure */
--border-hover:   rgba(255,255,255,0.12)

--text:           #f0f0f2          /* Primary text — not pure white */
--text-secondary: #7c7c8a          /* Secondary/muted */
--text-tertiary:  #4a4a56          /* Least important */

--accent:         #3b82f6          /* Blue — primary action, links, highlights */
--accent-subtle:  rgba(59,130,246,0.08)
--accent-surface: rgba(59,130,246,0.15)

--warm:           #f59e0b          /* Amber — sparingly, for "live" badges or key callouts only */
```

The blue is professional, versatile, and ties to the maritime theme without being heavy-handed. The amber is warm and used only for status indicators ("Live" badges). Every other element is neutral.

---

### 3. Layout & Spatial Design — Dense, Undifferentiated Grid

**Problem:** The current grid (`auto-fill, minmax(380px, 1fr)` with 1px gap) creates a wall of identical rectangles. Every project gets the same visual weight. There's no breathing room, no featured content, no visual hierarchy. The 1px gap with colored background hack is clever but creates a visual grid-prison — rigid and claustrophobic.

58 projects should never be shown in a flat grid. It's overwhelming and signals "quantity over quality" — the exact opposite of what a portfolio should communicate.

**Fix:** 

**A. Feature/Curate ruthlessly.** The #1 UX improvement is NOT a design change — it's an editorial one. 58 projects dilutes impact. The redesign should support:
- **Featured tier (3-5 projects):** Large cards, rich previews, detailed descriptions. These are the projects that define Mat professionally.
- **Archive/secondary tier:** Compact list or smaller grid for everything else. Accessible but not competing for attention.

**B. Use generous whitespace.** Move from 1px gaps to 24-48px gaps. Let cards breathe. The current site feels like a spreadsheet — the redesign should feel like a magazine.

**C. Break the grid.** The featured section should use asymmetric layouts — one large card spanning 2 columns, paired with two smaller ones. This creates visual rhythm and hierarchy.

**Spec — Page Structure:**
```
[Nav Bar]                          — Sticky, minimal
[Hero Section]                     — Name, tagline, CTA
[Featured Projects — 3-5 max]     — Large, rich cards with screenshots
[All Projects — Filterable Grid]   — Smaller cards, searchable
[About/Contact Footer]             — Clean close
```

---

### 4. Hero/Header — Under-Designed and Wasted

**Problem:** The header is functional but unremarkable. The stats bar (58 Projects Live, 49 Previously Deployed, 9 Newly Deployed, 33 Technologies, 2 Categories) is noise — these numbers don't communicate value. "2 Categories" tells a visitor nothing. "33 Technologies" might actually hurt (it implies breadth over depth).

The tagline "Building elegant solutions across maritime tech, web applications, and beyond" is generic marketing copy that could belong to any developer.

**Fix:** The hero should be a **moment**. It should set the tone, establish who Mat is, and give the visitor a reason to keep scrolling.

**Spec:**
```
Hero Layout:
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  MAT HARVEY                              [GitHub] [CV]   │
│                                                          │
│  Software Engineer & Marine Scientist                    │
│  Perth, Western Australia                                │
│                                                          │
│  I build software that protects ships, oceans,           │
│  and the ecosystems between them.                        │
│                                                          │
│  ── Featured Work                                        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Stats reduced to 2-3 meaningful ones:** "58 projects shipped" and "MarineStream — 85+ vessels managed" (or similar social proof). Remove "2 Categories" and "33 Technologies."
- **Tagline rewritten** to be specific and human, not generic.
- **Subtle entrance animation** — name fades up, tagline follows with a staggered delay. Nothing flashy.

---

### 5. Cards — Over-Decorated, Under-Informative

**Problem:**
- The left-border-on-hover animation (`.card::before` growing to 100% height) is a 2019-era CodePen effect. It's not bad, it's just tired.
- The dark overlay on card previews (`.card-preview::after` at 34% opacity) hides the preview content — the one thing that should draw attention.
- The monogram placeholder (3-letter abbreviation in a bordered square) is visually weak — "3DS", "ANT", "BFM" mean nothing to anyone.
- The card name displays raw repo names: "A-New-Framework-for-Understanding-Consciousness" is 52 characters long with hyphens. "tempForKel", "tempPricing" — these are internal names, not display names.
- Description truncation at 3 lines means most cards show incomplete, unhelpful text.
- The "Live" badge with pulsing green dot is overused — nearly every project is "Live," so it becomes meaningless.

**Fix:**

**Featured Cards (large):**
```
┌─────────────────────────────────────────────┐
│                                             │
│   [Full-width screenshot/preview — 16:9]    │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│   MarineStream Platform                     │
│   Vessel management SaaS serving 85+        │
│   vessels including the Royal Australian    │
│   Navy fleet.                               │
│                                             │
│   Python · React · PostgreSQL          →    │
│                                             │
└─────────────────────────────────────────────┘
```

**Grid Cards (compact):**
```
┌────────────────────────────┐
│  [Screenshot — 3:2]        │
├────────────────────────────┤
│  Biofouling ID Guide       │
│  Visual field guide for    │
│  marine species ID.        │
│                            │
│  HTML · CSS     [↗] [GH]  │
└────────────────────────────┘
```

- **Human-readable project names** — curate display names, not repo slugs.
- **Remove the monogram fallback entirely.** If there's no screenshot, use a solid surface with the project name in large type — simpler and cleaner.
- **Remove the "Live" badge.** If it links somewhere, it's live. The badge is redundant.
- **Remove the category badge** from inside the card — it's already handled by filters.
- **Hover effect:** Subtle lift (translateY -2px + shadow increase). No border animations.

---

### 6. Filters — Functional but Ugly

**Problem:** The filter buttons are tiny (0.75rem), monospace, all-caps with tight letter-spacing. They look like terminal commands. Only two categories ("web-app" and "other") makes the filter system nearly useless — a binary toggle doesn't warrant a filter bar.

**Fix:** If keeping filters, redesign as clean pill/tab selectors. But more importantly, recategorize the projects into meaningful groups.

**Spec — Categories:**
```
All  |  Maritime & Industry  |  Simulations & Viz  |  Tools & Utilities  |  Personal & Creative
```

**Filter Style:**
- Horizontal pill buttons, 14px body font, no monospace.
- Selected state: filled background with accent color.
- Smooth transition between states.
- Include a **search/filter input** for 58 projects — much more useful than categories alone.

---

### 7. Modal/Preview — Good Idea, Poor Execution

**Problem:** The iframe preview modal is a genuinely good feature — being able to preview a live site without leaving the portfolio is valuable. However, the modal styling is generic (dark panel, basic header) and the iframe can be slow to load with no loading state.

**Fix:**
- Add a **skeleton/loading state** inside the iframe wrapper while the site loads.
- Add a **device frame** around the iframe (browser chrome mockup) to make it feel intentional.
- Keyboard-trap focus inside the modal when open (accessibility).
- Smooth open/close animation (scale from 0.95 + fade).

---

### 8. Footer — Throwaway

**Problem:** "Autonomously deployed by an AI pipeline" is interesting but buried and undersold. The footer is a single line with no utility.

**Fix:** The footer should serve as a lightweight "about" section with contact links.

**Spec:**
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  Built by Mat Harvey                                     │
│  Software Engineer · Marine Scientist · Perth, WA        │
│                                                          │
│  [GitHub]   [LinkedIn]   [Email]                         │
│                                                          │
│  Portfolio auto-deployed via CI/CD pipeline               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

### 9. Performance & Technical Issues

- **GIF previews** are heavy — a 58-project page with GIF thumbnails will consume significant bandwidth. Switch to **static thumbnails** (first frame of the GIF as WebP) with optional GIF playback on hover.
- **No favicon or meta tags** — missing social sharing metadata (og:image, og:description). A portfolio that looks broken when shared on LinkedIn or Slack is a missed opportunity.
- **No `prefers-reduced-motion`** support — accessibility gap.
- **The noise overlay** (SVG filter at z-index 9999) is purely decorative and sits on top of everything. It's so subtle it's essentially invisible but still costs rendering performance. Remove.
- **Gradient orbs** (600px blurred circles) are a signature AI-generated-site aesthetic. Remove or replace with something more intentional.

---

### 10. Mobile Experience

**Problem:** The responsive breakpoint is a single rule at 768px that switches to a single column. No other mobile optimization exists — font sizes, padding, card heights, filter scrolling, modal behavior — all unchanged.

**Fix:**
- Filter bar should horizontally scroll on mobile with fade-edge indicators.
- Cards should stack full-width with reduced preview height.
- Modal should be full-screen on mobile (no padding).
- Touch-friendly tap targets (min 44px).
- Hero section needs responsive type scaling beyond what `clamp()` provides.

---

---

## Part 2: Full Design Specification

### Design Philosophy

**"Quiet confidence."** This portfolio should feel like walking into a well-designed architecture studio — everything is considered, nothing is loud, and the work speaks for itself. The aesthetic is **refined editorial** — think Monocle magazine meets a Dieter Rams product page. Not dark-mode hacker, not startup landing page, not brutalist experiment.

---

### 2.1 Typography System

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Hero Name | Clash Display (Fontshare) | 600 | clamp(3rem, 7vw, 5.5rem) | -0.03em |
| Section Heading | Clash Display | 500 | 1.5rem | -0.02em |
| Card Title | General Sans (Fontshare) | 600 | 1.1rem | -0.01em |
| Body | General Sans | 400 | 0.95rem | 0 |
| Small/Meta | General Sans | 500 | 0.8rem | 0.02em |
| Code/Tech Tags | JetBrains Mono | 400 | 0.75rem | 0.01em |

**Line heights:** Hero 1.0, Headings 1.2, Body 1.6, Small 1.4

**Font Loading:**
```html
<link href="https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600&f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

---

### 2.2 Color System

```css
:root {
  /* Surfaces */
  --bg:               #09090b;
  --surface:          #131316;
  --surface-raised:   #1c1c21;
  --surface-overlay:  rgba(0,0,0,0.6);

  /* Borders */
  --border:           rgba(255,255,255,0.06);
  --border-hover:     rgba(255,255,255,0.12);
  --border-active:    rgba(255,255,255,0.20);

  /* Text */
  --text-primary:     #f0f0f2;
  --text-secondary:   #7c7c8a;
  --text-tertiary:    #4a4a56;

  /* Accent — Blue */
  --accent:           #3b82f6;
  --accent-hover:     #60a5fa;
  --accent-subtle:    rgba(59,130,246,0.08);
  --accent-surface:   rgba(59,130,246,0.12);

  /* Status — Amber (use sparingly) */
  --status-live:      #f59e0b;
  --status-live-bg:   rgba(245,158,11,0.10);

  /* Semantic */
  --focus-ring:       rgba(59,130,246,0.5);
  --shadow-sm:        0 1px 2px rgba(0,0,0,0.3);
  --shadow-md:        0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg:        0 12px 40px rgba(0,0,0,0.5);
}
```

**Light mode (optional/future):**
Consider supporting `prefers-color-scheme: light` but dark is the primary theme.

---

### 2.3 Spacing & Grid System

**Base unit:** 4px
**Scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128

**Page container:** `max-width: 1200px` (narrower than current 1400px — tighter feels more considered)

**Grid:**
```css
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;  /* Was 1px — breathe */
  padding: 0 24px;
}
```

**Featured grid:**
```css
.featured-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
  padding: 0 24px;
}
```

---

### 2.4 Page Architecture

```
┌─────────────────────────────────────────┐
│  NAVIGATION BAR (sticky)                │
│  Logo/Name          GitHub · LinkedIn   │
├─────────────────────────────────────────┤
│                                         │
│  HERO SECTION                           │
│  Name · Title · Tagline · Key stats     │
│  Height: ~60vh                          │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  FEATURED PROJECTS (3-5)                │
│  Section label: "Selected Work"         │
│  Asymmetric grid, large previews        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  ALL PROJECTS                           │
│  Section label: "Archive"               │
│  Search bar + Category filters          │
│  Compact card grid                      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  FOOTER                                 │
│  Brief bio · Contact links · Colophon   │
│                                         │
└─────────────────────────────────────────┘
```

---

### 2.5 Component Specifications

#### A. Navigation Bar

```
Position: sticky, top: 0
Background: var(--bg) with backdrop-filter: blur(12px) and 80% opacity
Height: 56px
Border-bottom: 1px solid var(--border)
Z-index: 100

Left: "MH" monogram or "Mat Harvey" in body font, 500 weight
Right: Icon-only links (GitHub, LinkedIn, Email) — 20px icons, 44px touch targets
```

**Behavior:** Visible on scroll. No hide-on-scroll-down tricks — they're annoying.

#### B. Hero Section

```
Padding: 96px top, 48px bottom
Max-width: 800px (narrower than page — centered, intimate)

Layout:
  [Small caps label]     "SOFTWARE ENGINEER & MARINE SCIENTIST"
  [Hero name]            "Mat Harvey"
  [Tagline paragraph]    2-3 lines, secondary color, body font
  [Stat row]             2-3 meaningful metrics, inline
  [CTA area]             "View Selected Work ↓" — text link, not button

Entrance animation:
  - Label: fade-up, 0ms delay
  - Name: fade-up, 100ms delay
  - Tagline: fade-up, 200ms delay
  - Stats: fade-up, 300ms delay
  - Duration: 600ms each, ease-out
```

#### C. Featured Project Cards

```
Border-radius: 12px
Border: 1px solid var(--border)
Background: var(--surface)
Overflow: hidden

Preview area:
  Aspect-ratio: 16/10
  Background: screenshot (WebP, lazy-loaded)
  Object-fit: cover
  Object-position: top center

  On hover:
    Image scales to 1.02 over 500ms
    Overlay fades from 0% to 8% black

Body:
  Padding: 24px
  
  [Project Name]     — Card title, 1.1rem
  [Description]      — 2-3 lines, secondary text, body font
  [Tech tags]         — Inline, mono font, 0.75rem, pill-shaped, border only
  [Links row]        — "View Project →" and GitHub icon, right-aligned

Hover:
  transform: translateY(-2px)
  box-shadow: var(--shadow-md)
  border-color: var(--border-hover)
  transition: all 300ms ease
```

#### D. Archive Project Cards (compact)

```
Border-radius: 8px
Border: 1px solid var(--border)
Background: var(--surface)

Preview:
  Height: 180px (fixed, not aspect-ratio — keeps grid uniform)
  
Body:
  Padding: 16px 20px

  [Name]          — 1rem, 600 weight
  [Description]   — 1 line truncated, secondary text
  [Tech + Links]  — Single row, space-between

No description truncation beyond 1 line.
No category badges inside cards.
No "Live" badges (redundant with link presence).
```

#### E. Filter Bar

```
Position: sticky, below nav (top: 56px)
Background: var(--bg) with backdrop-filter
Padding: 16px 24px
Border-bottom: 1px solid var(--border)

Layout:
  [Search input — 240px]  [Pill filters — horizontal scroll on mobile]

Search input:
  Background: var(--surface)
  Border: 1px solid var(--border)
  Border-radius: 8px
  Padding: 10px 16px 10px 40px (icon left)
  Placeholder: "Search projects..."
  Font: body, 0.9rem

Filter pills:
  Padding: 8px 16px
  Border-radius: 100px (full pill)
  Font: body, 0.85rem, 500 weight
  Default: transparent bg, secondary text
  Active: var(--accent-surface) bg, var(--accent) text, accent border
  Hover: var(--surface-raised) bg
  Transition: all 200ms ease
```

#### F. Preview Modal

```
Backdrop: rgba(0,0,0,0.7) with backdrop-filter: blur(16px)
Dialog: 
  Width: min(1100px, 94vw)
  Height: min(700px, 88vh)
  Border-radius: 16px
  Border: 1px solid var(--border-hover)
  Box-shadow: var(--shadow-lg)

Header:
  Height: 48px
  Padding: 0 16px
  Border-bottom: 1px solid var(--border)
  
  Left: Mock browser dots (●●● in red/yellow/green at 10px)
  Center: Project name
  Right: "Open ↗" link + Close button

Open animation:
  opacity: 0 → 1
  transform: scale(0.96) → scale(1)
  duration: 250ms, ease-out

Close animation:
  reverse of open, 200ms

Loading state:
  Centered spinner or skeleton pulse inside iframe wrapper

Mobile (<768px):
  Full-screen modal (inset: 0, border-radius: 0)
```

#### G. Footer

```
Padding: 64px 24px
Border-top: 1px solid var(--border)
Text-align: left (not centered — editorial feel)
Max-width: 1200px

Layout (2 columns on desktop):
  Left:
    "Mat Harvey" — section heading
    Brief bio — 2 sentences, secondary text
  
  Right:
    Contact links — vertical stack
    "Built with [tools]. Auto-deployed via CI/CD."
    
  Bottom: 
    "© 2026" — tertiary text, full width
```

---

### 2.6 Interaction & Motion

**Principles:**
- Every animation has a purpose (draw attention, indicate state, provide feedback).
- Nothing animates for more than 500ms.
- Use `prefers-reduced-motion: reduce` to disable all non-essential motion.

**Page Load Sequence:**
```
0ms:    Nav bar appears (no animation — instant anchor)
0ms:    Hero label fades up
100ms:  Hero name fades up
200ms:  Hero tagline fades up
300ms:  Hero stats fade up
600ms:  Featured section fades up
        (individual cards stagger 100ms apart)
```

**Scroll-triggered:**
- Archive cards: fade-up as they enter viewport (IntersectionObserver, threshold: 0.1).
- Stagger: 50ms per card in the visible batch.

**Hover states:**
- Cards: translateY(-2px), shadow elevation, border brightens.
- Links: color transition to accent, 200ms.
- Filter pills: background transition, 200ms.
- No border-growing animations. No pulsing dots. No color shifting on idle.

---

### 2.7 Responsive Breakpoints

```css
/* Mobile-first base: < 640px */
/* Everything single column, full-bleed cards */

@media (min-width: 640px) {
  /* 2-column grid for archive cards */
  /* Featured section: single column, stacked */
}

@media (min-width: 1024px) {
  /* Full layout: featured grid 2-col asymmetric */
  /* Archive grid: 3 columns */
  /* Footer: 2 columns */
}

@media (min-width: 1280px) {
  /* Wider spacing, larger hero type */
}
```

**Key mobile considerations:**
- Filter bar: horizontal scroll with `overflow-x: auto`, hide scrollbar, fade-edge mask.
- Modal: full-screen, no border-radius.
- Cards: 0px border-radius on mobile for edge-to-edge feel.
- Touch targets: minimum 44×44px on all interactive elements.

---

### 2.8 Accessibility

- **Focus management:** Visible focus rings (2px offset, accent color) on all interactive elements.
- **Keyboard navigation:** Tab through filters, cards, links. Enter to open modal. Escape to close.
- **ARIA:** Modal uses `role="dialog"`, `aria-modal="true"`, focus-trapped when open.
- **Color contrast:** All text meets WCAG AA minimum (4.5:1 for body, 3:1 for large text).
- **Reduced motion:** Wrap all `@keyframes` and transitions in a `prefers-reduced-motion: no-preference` query.
- **Screen readers:** Cards are `<article>` elements. Filter buttons are `<button>` with `aria-pressed`. Section labels use `<h2>`.

---

### 2.9 Performance

- **Images:** WebP format, lazy-loaded with `loading="lazy"` + IntersectionObserver fallback. Serve static thumbnails, GIFs only on hover or click.
- **Fonts:** `font-display: swap` on all custom fonts. Preconnect to font CDNs.
- **CSS:** Single stylesheet, no external CSS frameworks. Use CSS custom properties for theming.
- **JS:** Vanilla JS only. No frameworks, no build step. The entire site should be a single HTML file (as it currently is).
- **Target metrics:** LCP < 1.5s, CLS < 0.05, FID < 50ms.

---

### 2.10 Meta & SEO

```html
<title>Mat Harvey — Software Engineer & Marine Scientist</title>
<meta name="description" content="Portfolio of Mat Harvey — building software that protects ships, oceans, and the ecosystems between them. Perth, Western Australia.">
<meta property="og:title" content="Mat Harvey — Portfolio">
<meta property="og:description" content="Software engineer and marine scientist building maritime technology.">
<meta property="og:image" content="[social-share-image.png — 1200×630]">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,..."> <!-- inline SVG favicon -->
```

---

### 2.11 Data & Content Strategy

**The most impactful change isn't visual — it's editorial.**

The current 58 projects include items like "tempForKel" (description: "For Kelly"), "tempPricing" (description: "tempPricing"), and several repos that are clearly internal/temporary. These should be curated:

**Tier 1 — Featured (5 projects):** The work that defines Mat professionally.
Candidates:
1. **MarineStream / temp-msdt-for-review** — The flagship product. Rename to "MarineStream Platform."
2. **BiofoulingIdGuide** — Domain-specific, polished, real-world utility.
3. **3dShip** — Visually impressive, demonstrates Three.js capability.
4. **FoulingCostCalculator** — Ties research to practical application.
5. **FPVTrackPlanner** — Shows range beyond maritime, uses Three.js.

**Tier 2 — Archive (remaining):** Everything else, filterable and searchable. Projects with placeholder descriptions ("tempPricing", "CleanHullsClearWaters") should either get real descriptions or be hidden.

**Project names should be human-readable:**
- `A-New-Framework-for-Understanding-Consciousness` → "Consciousness Framework"
- `AgenticBubbleSort` → "Agentic Bubble Sort"  
- `iwhc_franmarine` → "In-Water Hull Cleaning"
- `bfmpGenerator` → "BFMP Generator"
- `temp-msdt-for-review` → "MarineStream Platform"

---

### 2.12 What to Remove

| Element | Reason |
|---|---|
| Noise overlay (SVG texture) | Invisible, costs performance, AI-aesthetic cliché |
| Gradient orbs | AI-portfolio signature — generic |
| "Live" pulsing badges | Every project is live — badge is meaningless |
| Category badges inside cards | Handled by filters |
| Monogram placeholders | Visually weak, abbreviations are meaningless |
| Stats: "2 Categories", "33 Technologies" | Vanity metrics that don't communicate value |
| Left-border hover animation | Dated effect |
| Space Mono as body font | Readability issue, hacker-aesthetic cliché |

---

### 2.13 What to Add

| Element | Reason |
|---|---|
| Sticky nav bar | Persistent navigation context |
| Featured projects section | Visual hierarchy, first impression |
| Project search input | 58 projects needs findability |
| Meaningful categorization | "web-app" and "other" aren't useful |
| Human-readable project names | Repository slugs aren't display names |
| Entrance animations | Polish, establishes rhythm |
| Social meta tags | Portfolio looks professional when shared |
| Favicon | Basic professionalism |
| `prefers-reduced-motion` | Accessibility |
| Static WebP thumbnails | Performance (replace GIF-first approach) |
| Browser-chrome modal frame | Makes iframe preview feel intentional |

---

## Summary — Priority Actions

1. **Curate content** — Feature 5 projects, archive the rest, fix all names and descriptions.
2. **Replace typography** — Clash Display + General Sans + JetBrains Mono.
3. **Simplify color** — Blue accent + amber status. Remove green/orange/blue confusion.
4. **Restructure layout** — Hero → Featured → Archive. Add sticky nav.
5. **Redesign cards** — Remove visual noise, increase whitespace, cleaner hover states.
6. **Add search** — Essential for 58 projects.
7. **Improve mobile** — Full responsive audit beyond a single breakpoint.
8. **Performance** — WebP thumbnails, remove decorative overlays, add meta tags.

---

*This spec is designed to be implemented as a single-file HTML/CSS/JS page, maintaining the current architecture while dramatically improving the design, usability, and impact of the portfolio.*