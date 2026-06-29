# Mellow Trust & Safety Framework

## Philosophy: Transparent Detection Over Accusation

Mellow's safety approach is built on **transparency and trust**, not hidden judgment or punitive enforcement.

### Core Distinction

**"We detected this"** (our approach) vs **"This IS in your message"** (accusatory approach)

**"This IS in your message"** puts users on defense:
- "Your post contains a slur"
- "We found your home address"
- Implies intentional wrongdoing
- Creates shame and resentment, especially in a school setting

**"We detected this"** invites collaboration:
- "Our safety systems detected language that might violate our guidelines"
- "Our automated system flagged potential personal information"
- Acknowledges the system could be wrong
- Positions the platform as protective, not punitive

### Why This Matters for a School Platform

In a school context, tone determines trust:
- Students are learning and testing boundaries
- An accusatory message teaches them the platform is adversarial
- A transparent message teaches them the platform cares about their safety
- Adults-in-the-loop (not faceless automation) builds confidence

---

## Safety Architecture Overview

### Grace Period Flow

1. **User posts** → stored in database with `status: pending`
2. **Instantly visible to creator** (optimistic UI, no waiting)
3. **Safety check runs async** in background (target: < 2 seconds)
4. **If flagged**:
   - Post hidden from public feed
   - Creator sees: "Your post is under review" (transparent messaging)
   - Admin notified, added to SafetyQueue
   - **User cannot delete the post** (prevents destruction of evidence)
5. **If clean**:
   - Status updates to `published`
   - Appears in feed normally

**Why this order:** Users feel heard (post goes up), but you catch harm before it spreads to the school community.

---

## Grace Period UX: Creator Experience

### Timeline for Creator

**T+0s:** User submits post
- Form clears immediately (good feedback)
- Status message: "Posting…"

**T+0.5s–1s:** Post appears in their own view
- They can see their post (success feeling)
- Status: "Checking content…"

**Scenario A: Post is clean (T+1–2s)**
- Status updates: "Posted!"
- Post appears in their feed + everyone else's feed
- Fades after 2 seconds

**Scenario B: Post is flagged (T+1–2s)**
- Status updates: "Your post is under review by our safety team"
- Post remains visible to them (they know what they posted)
- Post is hidden from other students' feeds (not public yet)
- Clear next steps: "An admin will review this soon" or "Click here to revise"

### What They Cannot Do While Flagged

- **Cannot delete the post** — it stays in the system for admin review
- **Cannot edit the post** — original content is preserved for review
- **Cannot see if it's published** — they see "under review" status, not the public feed

### Why These Constraints

**Preventing evidence destruction:** If a user posts a slur then immediately deletes it, there's no record. By locking flagged posts, you preserve the full context for the admin to review.

**Transparency over circumvention:** User knows their post is being looked at fairly, not hidden from them.

---

## Grace Period UX: Admin Experience

### SafetyQueue Dashboard

Admin sees:
- **Creator name & profile** (context)
- **Original post content** (what they're reviewing)
- **What was flagged** (slur detected, PII detected, etc.)
- **Severity level** (critical, high, medium)
- **Timestamp** (when it was flagged)
- **Confidence/details** (which words, which PII type, etc.)

### Admin Decision Points

**Option 1: Approve (False Positive)**
- Post moves to `published`
- Creator gets: "Your post was reviewed and is now live"
- Feedback logged: this flag was incorrect (helps improve detection)

**Option 2: Needs Revision**
- Post stays `flagged`
- Creator gets: "Your post was flagged for [category]. Please revise and resubmit."
- Creator can delete and repost (with changes), OR edit if that's an option
- Post stays hidden from feed until resubmitted

**Option 3: Remove**
- Post is deleted
- Creator gets: "Your post violated our community guidelines and has been removed. [Explanation & appeal process]"
- Logged as severe (helps tune detection toward higher precision)

### Admin Response Time Expectation

- **Target:** Review within 1–2 hours during school hours
- **Fallback:** Auto-publish after 24 hours if not reviewed (to prevent indefinite limbo)
- **Edge case:** If admin is offline, post either waits or auto-approves (decide based on your risk tolerance)

---

## Detection Strategy: Three Tiers

### Tier 1: Fast Keyword Detection (Always-On)

**Speed:** < 50ms  
**Method:** Pattern matching + variant catching

Detects:
- Swear words with obfuscation (`f*ck`, `f_ck`, `f4ck`, `phuck`)
- Slurs with obfuscation (`n1gga`, `f4gg0t`)
- PII patterns (emails, phone numbers, UK postcodes, addresses)

**No ML model needed.** This is the baseline that runs on every post.

### Tier 2: ML Model Detection (Optional, For Scale)

**Speed:** 1–2 seconds  
**Method:** Trained classifier on your CSV data

Runs if:
- Tier 1 is uncertain about borderline cases
- You want confidence scoring
- You want to catch new variants not in your keyword list

**Status:** Planned for Phase 2 (after you run CSV through LLMs and clean the data)

### Tier 3: Context-Aware Detection (Future)

**Speed:** 2–3 seconds  
**Method:** Combine behavioral analysis + pattern recognition

Understands:
- Repeated harassment patterns from same user
- Escalating language (threats, targeted behavior)
- Intent from post context

**Status:** Post-MVP, after you have admin review data to validate

---

## False Positive vs False Negative Tradeoff

For a school platform, different categories have different acceptable error rates:

### Slurs (Highest Priority)

- **False Positive Rate:** 15% acceptable (overflagging is okay)
- **False Negative Rate:** Catch 80%+ of dangerous posts
- **Reasoning:** Missing a slur causes real harm (harassment, discrimination). Cost of false positive (student revises clean language) is lower than cost of missing actual slur.
- **Stance:** When in doubt, flag it. Let admin review validate.

### PII / Doxing (Critical)

- **False Positive Rate:** ~5% acceptable
- **False Negative Rate:** Catch 95%+ of PII
- **Reasoning:** Doxing has permanent consequences. Missing someone's address is worse than overflagging.
- **Stance:** Aggressive detection, but high precision on actual PII.

### Swears / Profanity (Medium Priority)

- **Status:** Currently undecided (depends on your school's culture)
- **Examples of ambiguity:**
  - "Fuck yeah" = excitement (contextually acceptable?)
  - "Shit" in "no shit, sherlock" = sarcasm (acceptable?)
  - "Damn" = mild (acceptable?)
- **Action needed:** Decide policy, then set thresholds accordingly

### Other Categories (TBD)

- Mature content (sexual/violent imagery)
- Threats / harassment language
- Spam / repeated messages

---

## Training Data & Model Improvement

### Current Status

- **Training data:** 800–1000 labeled examples in your CSV
- **Quality issues:**
  - Discord lore pollution (random tokens concatenated with swears)
  - Inconsistent labeling (same word labeled both 0 and 1)
  - Context-dependent words (`"This"` marked both ways)
  - Heavy swear/slur bias (underrepresented neutral language)

### Phase 2: Cleaning & Retraining

**Action:** Run your CSV through multiple LLMs (Claude, GPT-4, etc.)

They can help you:
1. Spot inconsistent labels and conflicting examples
2. Recommend what to remove (noise vs. signal)
3. Suggest thresholds based on your stated goals (15% FP for slurs, etc.)
4. Identify missing categories (threats, identity disclosure, etc.)
5. Create synthetic adversarial examples (ways students might bypass)

**Output:** Cleaned CSV + recommended detection strategy

### Long-Term Learning Loop

Your `SafetyQueue` (flagged posts awaiting admin review) becomes **real training data**:

- Admin marks `approved` (false positive) → relax that flag's threshold
- Admin marks `needs_revision` (caught legitimate harm) → increase confidence
- Admin marks `removed` (severe harm) → log severity for future tuning

Over months, you'll have 100s of data points from your actual school community, which beats any generic training set.

---

## Message Framing: Transparency in Practice

### Different Flag Categories, Different Messages

**For Slurs:**
- "We detected language that our community finds harmful. Please revise or delete."
- NOT: "You used a slur"

**For PII:**
- "Our system detected what looks like personal information. For your safety, we've hidden this until you review it."
- NOT: "You posted your address"

**For Swears (if flagged):**
- "Our systems flagged strong language here. Is this intentional?"
- NOT: "No swearing allowed"

**For Potential Threats:**
- "Our safety team flagged language that concerned us. Could you clarify what you meant?"
- NOT: "Threats are not tolerated"

### The Pattern

1. **Detection** ("Our systems detected...")
2. **Concern for their safety** ("For your safety, we've...")
3. **Invitation to act** ("Please revise or delete")
4. **Implicit trust** (not accusatory, not hidden)

### Preventing Gaming: Transparent But Not Exploitable

Be transparent about **categories**, not **specific words**:

✅ "Offensive language detected"  
✅ "Discriminatory slur category detected"  
❌ "The word 'X' was detected"

This way:
- Users know something was caught (transparent)
- Users don't learn the exact exploit (safe)
- Users aren't told which specific words to avoid (no arms race)

---

## Admin Review & Human-in-the-Loop

### SafetyQueue Workflow

All flagged posts go to an admin queue:

1. **Post is flagged** by automated system
2. **Admin sees** post content + what was flagged + severity level
3. **Admin decides:**
   - `approved` — false positive, post goes live
   - `needs_revision` — user should rewrite, post stays hidden
   - `removed` — severe harm, delete post
4. **Creator is notified** with transparent messaging
5. **Data is logged** for future model improvement

### Trust Impact: "Reviewed by a Human"

By showing admins are involved:
- Students know a teacher looked at their post (not faceless automation)
- They can appeal if they disagree
- They understand there's nuance (not rigid rules)

**Messaging implication:** "Your post is under review by our safety team" (not "flagged by a bot")

---

## Scale Considerations (800 → 1200 students)

### Current Scale (800 students)

- Estimated posts/day: 50–100
- Estimated flagged/day: 5–10 (assuming 5–10% hit rate)
- **Verdict:** Fully manual admin review is manageable

### Growth Scale (1200 students)

- Estimated posts/day: 75–150
- Estimated flagged/day: 7–15
- **Verdict:** Still manageable, but approaching automation threshold

### Long-Term Strategy (1200+ students)

Once confident in your detection accuracy, layer in automation:
- **Auto-remove** obvious slurs (high confidence, no appeal needed)
- **Auto-hide + notify** PII (send creator: "we found personal info, please revise")
- **Keep in manual queue** everything else (ambiguous cases)

This scales your moderation without sacrificing the human touch for important decisions.

---

## Your Brand: "Transparent Safety"

### How This Positions Mellow

- **NOT:** "Heavily moderated" (feels restrictive)
- **NOT:** "Anything goes" (feels unsafe)
- **YES:** "Transparent safety" (feels collaborative)

For a school platform, this is a differentiator:
- **Teachers & parents** want to know kids are safe
- **Students** want to feel trusted, not infantilized
- **You** need a system that scales and doesn't burn out

This framework threads that needle.

---

## Implementation Roadmap

### Week 1–2: Foundation
- Run your CSV through LLMs to validate and clean
- Decide on thresholds per category (slurs: 15% FP, PII: 5% FP, etc.)
- Lock in message framing ("We detected" language)

### Week 2–4: Deploy Tier 1
- Keyword detection + variant catching
- Grace period with transparent messaging
- Begin monitoring & collecting admin review data

### Month 1–2: Monitor & Iterate
- Admin reviews flagged posts, logs decisions
- Spot patterns in false positives/negatives
- Adjust thresholds based on real data

### Month 2–3: Tier 2 (Optional)
- Retrain ML model on cleaned CSV + LLM insights
- A/B test keyword vs. ML on sample of posts
- Decide if context-aware (Tier 3) is worth the complexity

### Month 3+: Automate Low-Risk
- Auto-remove high-confidence slurs
- Auto-hide + notify PII
- Keep ambiguous cases in manual queue

---

## Key Questions to Decide

1. **Message transparency:** Should students see exactly why their post was flagged, or just that it's under review?
   - More transparent → builds trust, easier to game
   - Less transparent → safer from gaming, feels less fair

2. **Appeal process:** Can students challenge a flagged post or ask for human review?
   - Yes → more fair, builds trust, adds workload
   - No → simpler, but feels punitive

3. **Public visibility of reviews:** Should other students see that a post was flagged/reviewed?
   - Yes → demonstrates fairness, transparency
   - No → privacy for the creator, less visibility of moderation

4. **Admin dashboards:** Who has access? Just you, or other teachers/moderators?
   - Just you → single point of failure
   - Distributed → better coverage, needs training

---

## Trust & Safety as a Living Document

This framework is **not final**. As you scale and collect real data from your community:
- Thresholds will shift
- New categories will emerge
- Your messaging may evolve
- The balance between automation and human review will change

**Regular review cadence:** Monthly (at scale: weekly or daily)
- Look at SafetyQueue decisions
- Spot false positive patterns
- Update detection logic
- Refine messaging

The most trusted platforms are the ones that **admit they don't have it perfect** and **iterate openly** with their community.

---

## Summary: What Makes This Approach Work

1. **Transparent** — users know what was flagged, not hidden judgment
2. **Trust-first** — assumes good intent, invites collaboration
3. **Scalable** — starts manual, layers in automation
4. **Human-centric** — admins make final calls, not bots
5. **Iterative** — learns from real data, adjusts over time
6. **School-appropriate** — tone matches educational context, not punitive
7. **Evidence-preserving** — flagged posts can't be deleted, preventing destruction of record

This is how you build a platform where students feel safe *and* trusted.
