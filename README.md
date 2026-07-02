# Mellow

![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)
![HTML](https://img.shields.io/badge/Language-HTML-orange.svg)
![Status](https://img.shields.io/badge/Status-Alpha-yellow.svg)

## About

**Mellow** is social media that's actually on your side — a friendlier, safer
place to be online. Where the big platforms got huge by hooking people and
selling their data, Mellow is built the other way around: safety and real care
for the people in it come first, not last. It leans school-friendly for younger
users and opens up to a broader audience as people grow, with protections that
fit whoever you are.

The brand identity is a marshmallow over a campfire — warm, calm, a friendly
rebellion against big social.

> Early alpha. Things will wobble and change.

## Tech stack

Mellow is deliberately **buildless static HTML** — no framework, no build step.

- **Frontend**: plain HTML/CSS/JS served as static files
- **Styling**: a single tokenised stylesheet (`app/styles.css`) driven by CSS
  custom properties (see Theming below)
- **Fonts**: Bricolage Grotesque (headings) + Hanken Grotesque (body)
- **Auth & data**: Supabase (JS SDK loaded from a CDN), schema `social-media-public`
- **Backend (planned)**: a Vercel service reached only via a Supabase
  `proxy_api` edge function, for agent/AI work

## Project structure

```
my-social-media/
├── index.html                  # Marketing landing page
├── updates.html                # Updates & known issues
├── app/
│   ├── index.html              # The app shell (UI markup + inline theme helpers)
│   ├── script.js               # App logic (Supabase, feed, profiles, theming)
│   ├── styles.css              # Tokenised stylesheet (:root design tokens)
│   ├── admin.html / admin.js   # Admin tools
├── docs/
│   └── AGE_TIERS_SPEC.md       # Age-tier & regional-policy design spec
├── ADMIN.md                    # Admin command reference
├── AUTH_SETUP.md               # Google/Supabase auth setup
├── FEED_AI_SETUP.md            # AI-tagged personalized feed setup
├── TRUST_AND_SAFETY_FRAMEWORK.md
└── DESIGN_NOTES.md             # (legacy) design notes
```

## Theming

Every colour, font, radius and shadow is a CSS custom property defined in
`:root` (`app/styles.css`). Change a token once and it updates everywhere it's
used — no more hunting down 20 hardcoded copies. Theming is entirely local; no
database or agent is involved.

- `applyTheme({ primary: '#7c3aed', ... })` writes token values onto `:root` at
  runtime; omitted tokens keep their `styles.css` defaults. It's defined inline
  in `app/index.html`, so it's always callable from the browser console.
- `setActiveStyle(row)` applies and remembers a tweak on the device (localStorage);
  `resetActiveStyle()` reverts to the `styles.css` defaults.

## Getting started

1. Clone the repo:
   ```bash
   git clone https://github.com/Cooldude1259/my-social-media.git
   ```
2. Serve the folder (any static server), e.g.:
   ```bash
   python3 -m http.server 8765
   ```
3. Open `http://localhost:8765/` for the landing page, or
   `http://localhost:8765/app/index.html` for the app.
4. For auth/data, configure Supabase — see `AUTH_SETUP.md`.

## Direction

- **Age tiers** (Kids/School · Teen · Adult, with "mercy teens"), computed
  **per country** via a data-driven policy layer — see `docs/AGE_TIERS_SPEC.md`.
- Safety-first: reporting, blocking, and moderation built up for a
  stranger-scale audience — see `TRUST_AND_SAFETY_FRAMEWORK.md`.

## License

MIT — see [LICENSE](LICENSE).

## Author

[Cooldude1259](https://github.com/Cooldude1259)
