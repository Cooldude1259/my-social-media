# Admin Guide — Update Announcements

You can pin an announcement to the **top of everyone's feed** using a secret
code typed into the normal post composer. The code **rotates after every
successful use**, so an old/leaked code can't be reused.

## Post an announcement

In the composer (you must be signed in):

- **Title box** (optional): the announcement heading.
- **Body:** first line is the command, the announcement text goes underneath:

  ```
  /announce <your-current-code>
  We just shipped tags and a For You feed! Tap a post to see more.
  ```

Press **Post**. If the code is valid, the banner appears at the top of the
feed for everyone, and the status line shows your **NEW code** — save it, you'll
need it next time. If the code is wrong, nothing is posted and you'll see
"Invalid admin code".

## Clear the banner

```
/clear <your-current-code>
```

This removes the current banner (and also rotates the code).

## How it's secured

- The code lives in a private table (`social-media-public.admin_secret`) that
  **no client can read** — Row Level Security denies all access; only the
  `create_announcement` / `clear_announcements` database functions (which run
  as definer) can check and rotate it.
- A `/announce` attempt is always intercepted client-side, so your code is
  never posted as a normal message even if it's wrong.
- Posting an announcement deactivates the previous one, so only the latest
  shows. Individual users can dismiss a banner locally (it returns if you post
  a new one).

## Lost your code?

You have database access, so you can always read or reset it in the Supabase
SQL editor:

```sql
-- view current code
select code from "social-media-public".admin_secret where id = 1;
-- set a new code of your choosing
update "social-media-public".admin_secret set code = 'my-new-code' where id = 1;
```