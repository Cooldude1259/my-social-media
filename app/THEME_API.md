# ConnectEd — Theme/Style API (agent contract)

This document is the complete spec for generating a **style**. Give it to an
agent; the agent returns **one JSON object** that becomes one row in the
Supabase `styles` table and is applied to the UI by `applyTheme()`.

---

## How a style works

The app's CSS is fully tokenised: every colour, font, radius, and shadow is a
CSS custom property (e.g. `var(--primary)`) defined in `app/styles.css`. A style
is just a set of values for those tokens. At runtime:

```
row (styles table)  ──►  applyTheme(row)  ──►  document.documentElement.style
                                                 .setProperty('--primary', …)
```

- A style **need not set every token.** Any token you omit keeps the default
  value from `styles.css`. A valid style can be as small as `{ "primary": "#7c3aed" }`.
- Column names use underscores (`primary_hover`); they map to hyphenated CSS
  properties (`--primary-hover`). Both spellings are accepted on input.

---

## Output format

Return a **single JSON object**. Nothing else — no prose, no markdown fence.

Allowed top-level keys:

| Key            | Type    | Notes                                                        |
|----------------|---------|-------------------------------------------------------------|
| `name`         | string  | Required. Short human label, e.g. `"Midnight"`.             |
| `description`  | string  | Optional. One sentence on the mood/intent.                  |
| *token keys*   | string  | Optional. Any of the token columns below.                   |

Do **not** set `id`, `is_default`, `is_curated`, `created_by`, or `created_at` —
those are managed by the app/admins, not the agent.

---

## Token reference

All token values are **strings** containing a valid CSS value for that property.

### Brand / primary
| Column          | Controls                                  | Example                                         |
|-----------------|-------------------------------------------|-------------------------------------------------|
| `primary`       | Main accent (buttons, active nav, links)  | `#0ea98f`                                        |
| `primary_hover` | Primary on hover (slightly darker)        | `#0b8f78`                                        |
| `primary_deep`  | Primary text on the soft tint             | `#0c9079`                                        |
| `primary_soft`  | Soft accent background (active nav pill)   | `#dff3ee`                                        |
| `brand_grad`    | Logo / banner gradient                    | `linear-gradient(135deg,#19c3a6,#0e9f88)`       |

### Text
| Column        | Controls                       | Example   |
|---------------|--------------------------------|-----------|
| `text`        | Primary text / headings        | `#1b1d28` |
| `text_body`   | Body copy                      | `#3a4052` |
| `text_soft`   | Secondary text                 | `#535a6b` |
| `text_muted`  | Muted text                     | `#727a8c` |
| `text_faint`  | Faint text / icons / meta      | `#9aa1b2` |
| `placeholder` | Input placeholder text         | `#b3bacb` |

### Surfaces
| Column      | Controls                          | Example   |
|-------------|-----------------------------------|-----------|
| `bg`        | Page background                   | `#eef1f8` |
| `surface`   | Card / panel background           | `#fff`    |
| `surface_2` | Inset fields (inputs, textareas)  | `#f7f8fc` |
| `surface_3` | Subtle hover / chip background    | `#f1f4fb` |
| `surface_4` | Stronger hover / segmented bg     | `#e4e9f5` |

### Borders
| Column          | Controls                  | Example   |
|-----------------|---------------------------|-----------|
| `border`        | Default border            | `#e6eaf3` |
| `border_2`      | Chip / pill border        | `#dde3f0` |
| `border_strong` | Emphasised border         | `#d4d9e6` |
| `hairline`      | Thin internal dividers    | `#eef1f7` |

### Accents
| Column   | Controls                | Example   |
|----------|-------------------------|-----------|
| `like`   | Liked-state heart/red   | `#ff4d6d` |
| `danger` | Delete / destructive    | `#e85555` |

### Typography
| Column      | Controls            | Example                                       |
|-------------|---------------------|-----------------------------------------------|
| `font_head` | Heading font stack  | `'Bricolage Grotesque',sans-serif`            |
| `font_body` | Body font stack     | `'Hanken Grotesque',system-ui,sans-serif`     |

### Shape & elevation
| Column        | Controls                      | Example                                                        |
|---------------|-------------------------------|---------------------------------------------------------------|
| `radius_card` | Card / panel corner radius    | `18px`                                                         |
| `radius_btn`  | Button / input corner radius  | `11px`                                                         |
| `radius_pill` | Fully-rounded pills & chips   | `999px`                                                        |
| `shadow_card` | Card box-shadow               | `0 1px 2px rgba(27,29,40,.04),0 8px 24px -16px rgba(27,29,40,.22)` |

---

## Rules (hard constraints — a style is rejected if it breaks these)

1. **Valid CSS only.** Each value must be a legal value for its property
   (colour, font stack, length, gradient, box-shadow). No JS, no `url(...)`,
   no `expression(...)`, no HTML.
2. **Keys must come from this spec.** Unknown keys are ignored; do not invent
   tokens.
3. **Readable contrast.** Body/primary text on its background must meet WCAG AA
   (≥ 4.5:1). Specifically: `text`/`text_body` on `bg` and on `surface`; and
   white text on `primary` (buttons use white text on `primary`).
4. **Don't break layout.** Radii ≤ ~28px; `shadow_card` must be a valid
   `box-shadow` value. Fonts must include a generic fallback
   (`sans-serif`/`serif`).
5. **Light-surface assumption.** Avatars, buttons, and the logo render **white**
   text/glyphs on `primary`/`brand_grad`, so those must stay dark enough for
   white to read.

## Soft goals (make it good, not just valid)

- Coherent palette: hover = a touch darker than `primary`; `primary_soft` = a
  pale tint of `primary`; surfaces stay close in lightness.
- Match the requested mood/intent from the user's feedback.
- Change only what the mood needs; leave the rest to inherit defaults.

---

## Examples

**Minimal — just shift the accent:**
```json
{ "name": "Grape", "description": "Purple accent, everything else default.",
  "primary": "#7c3aed", "primary_hover": "#6d28d9",
  "primary_deep": "#6d28d9", "primary_soft": "#efe7fe" }
```

**Fuller — warm coral identity:**
```json
{
  "name": "Coral",
  "description": "Warm, friendly coral with soft cream surfaces.",
  "primary": "#f9603e", "primary_hover": "#e24b2b",
  "primary_deep": "#c43d20", "primary_soft": "#ffe9e2",
  "brand_grad": "linear-gradient(135deg,#ff7a59,#f9603e)",
  "bg": "#fdf6f3", "surface": "#ffffff", "surface_3": "#fbeee9",
  "radius_card": "22px", "radius_btn": "12px"
}
```

Both are valid: applying them sets the listed `--tokens` and leaves all others
at the `styles.css` defaults.
