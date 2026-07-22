// ─────────────────────────────────────────────────────────────────────────────
// B4 — sessions + home + stats + insights + goal reads.
//
// completeSession calls the atomic complete_session RPC (all gamification math is
// server-side; the client only reads the result). The rest are owner-scoped
// queries assembling the screen view-models. NOTE: this calls the RPC directly —
// the MMKV offline queue (B4b) wraps this later for the dev build.
// ─────────────────────────────────────────────────────────────────────────────

import type { QuireApi } from '../api';
import type {
  ComebackChallenge, CompleteSessionResult, HomeData, ReadingGoal, ReadingInsight,
  ReadingSession, StatsData, Badge, StreakState,
} from '../types';
import { supabase } from '@/lib/supabase';
import { mapUserBook } from './library';

const USER_BOOK_SELECT = '*, book:books(*)';
// Mirrors fn_apply_xp's level table (keep in sync with the migration).
const LEVELS = [0, 500, 1500, 3500, 7000, 12000, 20000, 32000, 50000, 80000];
const STREAK_MILESTONES = [7, 30, 100, 365];

function levelBounds(totalXp: number): { prev: number; next: number } {
  let prev = LEVELS[0];
  let next = LEVELS[LEVELS.length - 1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i]) {
      prev = LEVELS[i];
      next = i + 1 < LEVELS.length ? LEVELS[i + 1] : LEVELS[i]; // max level → next = prev
    }
  }
  return { prev, next };
}

// 1-indexed level number for a given lifetime XP (mirrors fn_apply_xp's ladder).
function levelNumber(totalXp: number): number {
  let lvl = 1;
  for (let i = 0; i < LEVELS.length; i++) if (totalXp >= LEVELS[i]) lvl = i + 1;
  return lvl;
}

function mapSession(r: any): ReadingSession {
  return {
    id: r.id,
    userId: r.user_id,
    userBookId: r.user_book_id,
    bookId: r.book_id,
    format: r.format,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    startPage: r.start_page ?? null,
    endPage: r.end_page ?? null,
    pagesRead: r.pages_read ?? null,
    minutesListened: r.minutes_listened ?? null,
    pph: r.pph != null ? Number(r.pph) : null,
    source: r.source,
    localDate: r.local_date,
    xpAwarded: r.xp_awarded ?? 0,
    isPersonalBest: r.is_personal_best ?? false,
  };
}

function mapStreak(r: any): StreakState {
  return {
    currentStreak: r?.current_streak ?? 0,
    longestStreak: r?.longest_streak ?? 0,
    lastReadLocalDate: r?.last_read_local_date ?? null,
    isAtRisk: r?.is_at_risk ?? false,
    freezeTokens: r?.freeze_tokens ?? 0,
  };
}

function mapComeback(r: any): ComebackChallenge {
  return {
    id: r.id,
    streakAtBreak: r.streak_at_break,
    sessionsCompleted: r.sessions_completed,
    startedAt: r.started_at,
    expiresAt: r.expires_at,
    completedAt: r.completed_at ?? null,
    expiredAt: r.expired_at ?? null,
    streakRestored: r.streak_restored ?? false,
  };
}

function mapGoal(r: any): ReadingGoal {
  return { id: r.id, userId: r.user_id, year: r.year, goalBooks: r.goal_books, goalPages: r.goal_pages ?? null };
}

function mapInsight(r: any): ReadingInsight {
  return {
    id: r.id,
    sessionId: r.session_id ?? null,
    insightType: r.insight_type,
    insightText: r.insight_text,
    dataSnapshot: r.data_snapshot ?? {},
    shownAt: r.shown_at,
    wasShared: r.was_shared ?? false,
  };
}

async function requireUid(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Not signed in.');
  return uid;
}

export const sessionApi: Partial<QuireApi> = {
  // ── The gamification core (atomic RPC) ──────────────────────────────────────
  async completeSession(session): Promise<CompleteSessionResult> {
    const { data, error } = await supabase.rpc('complete_session', {
      p_client_uuid: session.clientUuid,
      p_user_book_id: session.userBookId,
      p_book_id: session.bookId,
      p_format: session.format,
      p_started_at: session.startedAt,
      p_ended_at: session.endedAt,
      p_start_page: session.startPage,
      p_end_page: session.endPage,
      p_minutes_listened: session.minutesListened,
      p_end_position_min: session.endPositionMin,
      p_local_date: session.localDate,
      p_source: session.source,
    });
    if (error) throw error;
    const result = data as CompleteSessionResult;
    // Level-up detection without a schema change: the RPC doesn't return level
    // fields, so read the fresh (trigger-maintained) level and derive the prior
    // level from xpGained. Best-effort — a failed follow-up read must never fail
    // the (already-committed) session; it just skips the level-up celebration.
    result.leveledUp = false;
    try {
      const uid = await requireUid();
      const { data: u } = await supabase.from('users').select('level, level_name, total_xp').eq('id', uid).single();
      if (u) {
        const newXp = Number(u.total_xp ?? 0);
        result.level = u.level;
        result.levelName = u.level_name;
        result.leveledUp = u.level > levelNumber(newXp - result.xpGained);
      }
    } catch {
      /* keep leveledUp=false */
    }
    return result;
  },

  // ── Delete a session + reverse its XP (streak/badges preserved) ─────────────
  async deleteSession(sessionId): Promise<void> {
    const { error } = await supabase.rpc('delete_session', { p_session_id: sessionId });
    if (error) throw error;
  },

  // ── Home view-model ─────────────────────────────────────────────────────────
  async getHomeData(): Promise<HomeData> {
    const uid = await requireUid();
    const year = new Date().getFullYear();
    const [uRes, sRes, abRes, cbRes, gRes, rsRes] = await Promise.all([
      supabase.from('users').select('id, display_name, avatar_url, level, level_name, total_xp').eq('id', uid).single(),
      supabase.from('streaks').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('user_books').select(USER_BOOK_SELECT).eq('user_id', uid).eq('status', 'reading').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('comeback_challenges').select('*').eq('user_id', uid).is('completed_at', null).is('expired_at', null).maybeSingle(),
      supabase.from('reading_goals').select('*').eq('user_id', uid).eq('year', year).maybeSingle(),
      supabase.from('reading_sessions').select('*').eq('user_id', uid).order('started_at', { ascending: false }).limit(7),
    ]);
    if (uRes.error) throw uRes.error;

    const u = uRes.data;
    const totalXp = Number(u.total_xp ?? 0);
    const { prev, next } = levelBounds(totalXp);
    const streak = mapStreak(sRes.data);

    // Near-completion: closest streak milestone within 3 days.
    let almostThere: HomeData['almostThere'] = null;
    for (const m of STREAK_MILESTONES) {
      if (streak.currentStreak < m && m - streak.currentStreak <= 3) {
        almostThere = {
          kind: 'streak_milestone',
          label: `${m - streak.currentStreak} ${m - streak.currentStreak === 1 ? 'day' : 'days'} to your ${m}-day streak`,
          progress: streak.currentStreak / m,
          daysRemaining: m - streak.currentStreak,
        };
        break;
      }
    }

    return {
      user: {
        id: u.id,
        displayName: u.display_name ?? null,
        avatarUrl: u.avatar_url ?? null,
        levelName: u.level_name,
        level: u.level,
        totalXp,
      } as HomeData['user'],
      streak,
      activeBook: abRes.data ? mapUserBook(abRes.data) : null,
      comeback: cbRes.data ? mapComeback(cbRes.data) : null,
      almostThere,
      goal: gRes.data ? mapGoal(gRes.data) : null,
      recentSessions: (rsRes.data ?? []).map(mapSession),
      xpToNextLevel: next,
      prevLevelXp: prev,
    };
  },

  // ── Stats view-model ────────────────────────────────────────────────────────
  async getStats(): Promise<StatsData> {
    const uid = await requireUid();
    const [sRes, stRes, bfRes, achRes, uaRes] = await Promise.all([
      supabase.from('reading_sessions').select('*').eq('user_id', uid).order('started_at', { ascending: false }).limit(400),
      supabase.from('streaks').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('user_books').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'finished'),
      supabase.from('achievements').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('user_achievements').select('*').eq('user_id', uid),
    ]);
    if (sRes.error) throw sRes.error;

    const sessions = (sRes.data ?? []).map(mapSession);
    const lifetimePages = sessions.reduce((s, x) => s + (x.pagesRead ?? 0), 0);
    const lifetimeHours = Math.round(sessions.reduce((s, x) => s + x.durationSeconds, 0) / 3600);
    const pphVals = sessions.map((x) => x.pph).filter((p): p is number => p != null && p > 0);
    const avgPph = pphVals.length ? Math.round((pphVals.reduce((a, b) => a + b, 0) / pphVals.length) * 10) / 10 : null;
    const streak = mapStreak(stRes.data);

    // Heatmap: minutes read per local day.
    const byDay = new Map<string, number>();
    for (const x of sessions) {
      byDay.set(x.localDate, (byDay.get(x.localDate) ?? 0) + Math.round(x.durationSeconds / 60));
    }
    const heatmapDays = [...byDay.entries()].map(([date, minutes]) => ({ date, minutes }));

    // Badges: every achievement, flagged unlocked from user_achievements.
    const earned = new Map((uaRes.data ?? []).map((ua) => [ua.achievement_id, ua]));
    const badges: Badge[] = (achRes.data ?? []).map((a) => {
      const ua = earned.get(a.id);
      return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        description: a.description,
        kind: a.kind,
        iconName: a.icon_name,
        lottieKey: a.lottie_key ?? null,
        unlockThreshold: Number(a.unlock_threshold),
        almostThereThreshold: Number(a.almost_there_threshold),
        xpReward: a.xp_reward,
        unlockedAt: ua?.unlocked_at ?? null,
        progressValue: ua ? Number(ua.progress_value) : 0,
      };
    });

    return {
      lifetimePages,
      lifetimeHours,
      booksFinished: bfRes.count ?? 0,
      avgPph,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      heatmapDays,
      badges,
      sessions,
    };
  },

  // ── Insights ──────────────────────────────────────────────────────────────
  async getInsights(): Promise<ReadingInsight[]> {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('reading_insights')
      .select('*')
      .eq('user_id', uid)
      .order('shown_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map(mapInsight);
  },

  async markInsightShared(insightId: string): Promise<void> {
    const { error } = await supabase.from('reading_insights').update({ was_shared: true }).eq('id', insightId);
    if (error) throw error;
  },

  // ── Reading goal ────────────────────────────────────────────────────────────
  async getGoal(year: number): Promise<ReadingGoal | null> {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('reading_goals')
      .select('*')
      .eq('user_id', uid)
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGoal(data) : null;
  },

  async updateGoal(year: number, goalBooks: number): Promise<ReadingGoal> {
    const uid = await requireUid();
    const { data, error } = await supabase
      .from('reading_goals')
      .upsert({ user_id: uid, year, goal_books: goalBooks }, { onConflict: 'user_id,year' })
      .select()
      .single();
    if (error) throw error;
    return mapGoal(data);
  },
};
