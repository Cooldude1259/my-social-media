# Feed, Auto-Tagging & Audiences

ConnectEd has a personalized, audience-aware feed driven by an AI tagger and a
hidden dislike signal.

## How it works

1. **Auto-tagging.** When you publish a post, the web app calls the
   `tag-post` Edge Function. It reads the post server-side, asks a small/cheap
   Hugging Face model for 1–5 open-ended topic tags, and stores them in
   `Tags` / `PostTags`. If Hugging Face is unavailable (or no token is set), it
   falls back to a built-in keyword extractor, so tagging never blocks posting.

2. **Likes & dislikes.** Likes are public (with counts). **Dislikes are
   private** — Row Level Security only lets you read your *own* dislike row, so
   no one (not even via the API) can see or count another user's dislikes.

3. **Audiences.** Each tag is an audience. Your reactions build a per-tag
   affinity: a like adds `+1` to that post's tags, a hidden dislike subtracts
   `-2`. Your strongest positive tags are "your audiences" (shown on your own
   profile).

4. **The feed.** "For You" ranks posts via the `get_feed()` database function:
   `(your affinity for the post's tags) × 2 + (likes − 1.5 × dislikes) −
   recency decay`. Dislikes lower a post's standing for the audiences that
   dislike it, but the **count is never returned** — only the ordering changes.
   "Latest" is a plain chronological view.

## What you need to configure

The tagger works out of the box using the keyword fallback. To enable the AI
tagging, add a **free Hugging Face token** as an Edge Function secret:

1. Create a token at <https://huggingface.co/settings/tokens> (a read token is
   enough; "Make calls to Inference Providers" permission).
2. In Supabase → **Edge Functions → Secrets** (or
   `supabase secrets set HF_TOKEN=hf_xxx`), add:

   ```
   HF_TOKEN = hf_xxxxxxxxxxxxxxxxx
   ```

3. (Optional) Override the model — defaults to
   `meta-llama/Llama-3.2-3B-Instruct`:

   ```
   TAG_MODEL = meta-llama/Llama-3.2-3B-Instruct
   ```

   If a model isn't available on the free tier, tagging silently falls back to
   keywords. Other small options to try: `Qwen/Qwen2.5-3B-Instruct`,
   `HuggingFaceTB/SmolLM3-3B`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically; you
do not set those.

## Tuning

The ranking weights and the like/dislike affinity values live in the
`social-media-public.get_feed` and `get_my_audiences` SQL functions — adjust
the multipliers there to make the feed more/less aggressive.
