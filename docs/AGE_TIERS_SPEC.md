# Mellow — Age Tiers & Regional Policy (spec / plan)

Status: **design, not yet built.** This captures the agreed model so we build
against something fixed. Nothing here is legal advice; the policy values and
consent mechanism need real legal review before launch.

---

## 1. Premise

Mellow is shifting from school-only to a broader audience that still leans
school-focused. Access and experience are organised by **age tier**, computed
**per country**, so each group gets the right experience and the right legal
protection automatically.

- **AU-first**, global allowed and built around from the start.
- Younger users keep a school angle; the age system exists to protect the wider
  public audience.

---

## 2. The two dials (keep them separate)

Every user has two independent settings. Most rules confuse these — we don't.

| Dial | What it controls | Driven by |
|------|------------------|-----------|
| **Community / cohort** | Which experience, feed, communities, social grouping | school-year style logic (can run slightly ahead of real age) |
| **Protection floor** | Data handling, who can contact them, discovery, consent basis | **exact age** + country policy (never relaxed early) |

The community dial may move a user up early (see Mercy Teen). The protection
dial **never** drops below what the user's real age + country requires.

---

## 3. Tiers

| Tier | Community | Protection floor |
|------|-----------|------------------|
| **Kids / School** | School-scoped, closed graph | Strictest: no public discovery, no stranger contact, guardian-managed |
| **Mercy Teen** | Teen community (early) | **Child-grade** (same as Kids) until real birthday |
| **Teen** | Teen community | Teen: guarded public — private-ish defaults, limited DMs/discovery, more warnings |
| **Adult** | Full public | Standard security, lighter touch |

"More warnings" for teens = treat them as capable of judgement but nudge/educate;
adults get protection too, just lighter than the younger bands.

---

## 4. Age math — `resolveTier(dob, country)`

Let `childMax`, `teenMin`, `teenMax` come from the country's policy (§5).

1. **Adult** if exact age ≥ 18.
2. **Teen** if exact age ≥ `teenMin` (e.g. 13 AU, 16 in some EU) and < 18.
3. **Mercy Teen** if *all* of:
   - not yet `teenMin` (still legally a child), **and**
   - they reach `teenMin` **within the current calendar year**, **and**
   - their birthday falls in **H2 (Jul–Dec)** (they'd otherwise join last).
   → placed in **Teen community**, but **protection floor stays child-grade**
     until the actual birthday, at which point they become a full Teen.
4. Otherwise **Kids / School**.

Notes:
- "Exact age" = full years elapsed since DOB as of today.
- H1-birthday children who aren't yet `teenMin` stay **Kids** until their birthday.
- Mercy is a **community** courtesy only — it never lowers the protection floor.
- The persuasion/nudge idea is **scrapped**; present the option as honest
  disclosure if at all.

---

## 5. Regional policy — data-driven, never code-per-country

One row per country. **We don't branch in code; we fill in this table** (with
legal input) and the app reads it.

```
jurisdiction_policies
  country                text   -- ISO code
  supported              bool   -- have we confirmed this country's rules?
  child_max_age          int    -- top of the child band (e.g. AU 12)
  teen_min_age           int    -- age you become a Teen (AU 13, DE 16, …)
  teen_max_age           int    -- 17
  guardian_consent_below int    -- consent required under this age
  children_cross_border  bool   -- almost always false
  teen_cross_border      bool   -- usually true; false where a country restricts
  notes                  text
```

### Supported vs unsupported countries
- **Supported country** → use its row.
- **Unsupported country** (we haven't confirmed the law): on signup, **kindly ask
  the user to have their school contact us with their country's specific youth
  laws**, so we can add a confident, accurate policy row and let them in properly.
- **If the user persists anyway** → apply the **conservative fallback policy**:
  the **strictest** thresholds we know — **`teen_min_age = 16`** (under-16 treated
  as child / guardian-consent), children cross-border off. Highest requirement
  wins until we have the real rules.

### Country detection
- Start with **self-declared at signup** (fine for AU-first / alpha).
- IP/geo is spoofable and privacy-heavy — defer.

---

## 6. Cross-border interaction — `canInteract(a, b)`

Single gate for discovery / follow / DM. Checked in this order:

1. **Either party is a child (incl. Mercy Teen protection floor):**
   - Same country → allowed within child rules.
   - Different country → **blocked**, *unless* an explicit
     **guardian-approved connection** exists (the "friend moved countries" case).
2. **Both Teen:** allowed **globally by default**; blocked only where a country's
   `teen_cross_border = false` (or an EU rule) requires it. ("Try to keep teens
   together; play along where restricted.")
3. **Adults:** standard rules.

### Guardian-approved connections (child exception)
```
approved_connections
  child_user_id    uuid
  other_user_id    uuid
  approved_by      uuid   -- guardian
  reason           text
  created_at       timestamptz
```
`canInteract` checks this list first for children.

---

## 7. Under-13 onboarding & consent

```
Under-child-line signup (never self-serve)
  ├─ guardian signs the kid up  → consent request goes to that guardian
  └─ school signs the kid up    → school contacts / relays to the guardian
                                       │
                          guardian gives consent
                                       │
            eligible for Mercy? ── yes ─► set up as Mercy Teen
                          │ no
                          ▼
                  full Kids / School tier
```

Guardrails:
- **Consent always resolves to the guardian.** School *facilitates*; the parent
  signs. (School-consent carve-outs are narrow — don't rely on them.)
- **Verifiable consent is a standard, not just an email.** Email-link is the
  alpha start; build the consent step **upgradeable** to stronger verification
  per jurisdiction (US/EU need more).

---

## 8. Identity / privacy (already implemented)

- **Real name is never shown or used in-app.** Collected via Google auth for
  safety/records (kept in auth metadata), but display name defaults to a
  generated handle (e.g. `SwiftOtter312`). Profiles show `@handle` only.
- No grade level is collected or shown.

---

## 9. Open questions / needs decision or legal input

- Exact policy values per supported country (legal input — we author the table).
- What "verifiable parental consent" mechanism we ship first vs later.
- How a school is verified as a legitimate school.
- Whether country is ever re-checked (travel, relocation).

---

## 10. Suggested build order

1. **Foundation:** capture DOB + country + consent at signup; store them; derive
   tier; re-enable email verification. (No behaviour gated yet.)
2. **Policy layer:** `jurisdiction_policies` table + `resolveTier` + conservative
   fallback + unsupported-country "ask your school" path.
3. **Interaction gate:** `canInteract` wired into discovery / follow / DM, plus
   `approved_connections`.
4. **Guardian/school consent flow.**
5. **Moderation hardening** for stranger-scale audiences.

Each slice ships and is reviewed on its own.
