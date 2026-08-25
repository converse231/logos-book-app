-- Sweep: take write grants away from every table the client never writes.
--
-- Follow-up to 20260826000001, which found that `own_users FOR ALL USING
-- (auth.uid() = id)` governs rows and says nothing about columns. The same
-- policy shape is used on most tables here, so the audit was widened.
--
-- Verified before writing this, across services/ lib/ app/ components/: the
-- client issues insert/update/upsert/delete against only nine tables —
-- users, user_books, reviews, review_reports, blocked_users,
-- notification_settings, reading_goals, reading_insights and feedback.
-- Everything below is read-only from the app and is written exclusively by
-- SECURITY DEFINER RPCs, triggers, or service-role edge functions, none of
-- which are affected by grants to `authenticated`.
--
-- What this closes, concretely:
--
--   streaks              current_streak, longest_streak and freeze_tokens were
--                        directly writable — a client could hand itself a
--                        1000-day streak and unlimited restores.
--   user_achievements    badges were grantable by insert.
--   reading_sessions     fabricated sessions would have polluted stats, pace
--                        and history. (No XP: fn_apply_xp is a trigger on
--                        xp_log, which is SELECT-only — but that is one policy
--                        edit away from becoming an XP faucet, which is exactly
--                        why the grant goes too.)
--   comeback_challenges  challenges completable without doing them.
--   ai_rec_cache         another user's cached recommendations, rewritable.
--
-- SELECT is deliberately untouched everywhere; only INSERT/UPDATE/DELETE go.
-- Several of these tables are already protected by a SELECT-only policy, so RLS
-- alone blocks writes today. The grant is removed anyway: RLS being the single
-- barrier means one careless `FOR ALL` policy added later silently reopens the
-- table, and a grant that was never needed is free to give up.

revoke insert, update, delete on
  public.streaks,
  public.streak_freezes,
  public.user_achievements,
  public.achievements,
  public.reading_sessions,
  public.xp_log,
  public.comeback_challenges,
  public.user_challenges,
  public.challenges,
  public.swipe_history,
  public.live_session_state,
  public.follows,
  public.ai_rec_cache,
  public.books,
  public.bestseller_lists,
  public.user_curios
from authenticated, anon;

-- reading_insights is generated server-side by fn_generate_insight; the only
-- thing the client legitimately does is tick was_shared after a share. Same
-- pattern as users: drop the table-wide UPDATE, grant back the one column.
revoke insert, update, delete on public.reading_insights from authenticated, anon;
grant update (was_shared) on public.reading_insights to authenticated;

-- anon should not be writing anything in this schema. The tables the client
-- does write are all owner-scoped and require a real auth.uid(), so anon had no
-- usable path anyway — this makes that explicit rather than incidental.
revoke insert, update, delete on
  public.user_books,
  public.reviews,
  public.review_reports,
  public.blocked_users,
  public.notification_settings,
  public.reading_goals,
  public.feedback
from anon;

-- public.users: the client updates a fixed set of profile columns (locked down
-- in 20260826000001) and never inserts or deletes a row. Both were still
-- granted, and INSERT is the one that matters: complete_onboarding() is
-- supposed to be the ONLY door onto public.users precisely because it performs
-- the COPPA check server-side, and a direct insert walks straight past it.
-- Account deletion goes through the delete_account edge function on the
-- service role, so DELETE is not needed either.
revoke insert, delete on public.users from authenticated, anon;
