// Multi-user storage on Supabase Postgres. The client passed in carries the signed-in
// student's access token, so every query is also checked by row-level security
// (user_id = auth.uid()) — one student can never read or write another's rows.
import { taskToRow, rowToTask, rowToFixedEvent, fixedEventToRow, profileToHabits, rowToReview, rowToSessionLog, pickPreferences, PROFILE_DEFAULTS } from './shared.js';

function must({ data, error }) {
  if (error) throw new Error(`Database error: ${error.message}`);
  return data;
}

export function createSupabaseStore(sb) {
  const ensureProfile = async (userId) => {
    const existing = must(await sb.from('profiles').select('*').eq('id', userId).maybeSingle());
    if (existing) return existing;
    return must(await sb.from('profiles').upsert({ id: userId, ...PROFILE_DEFAULTS }, { onConflict: 'id' }).select().single());
  };

  return {
    mode: 'supabase',

    async getProfile(userId) {
      const [profile, habits, fatigue] = await Promise.all([
        ensureProfile(userId),
        sb.from('habits').select('*').eq('user_id', userId).then(must),
        sb.from('fatigue_hours').select('hour').eq('user_id', userId).then(must),
      ]);
      return profileToHabits(profile, habits, fatigue);
    },

    async saveProfile(userId, body, sanitized) {
      must(await sb.from('profiles').upsert({ id: userId, ...sanitized, preferences: pickPreferences(body) }, { onConflict: 'id' }));
      if (Array.isArray(body.habits)) {
        must(await sb.from('habits').delete().eq('user_id', userId));
        if (body.habits.length) {
          must(await sb.from('habits').insert(body.habits.map((h, idx) => ({
            id: h.id || `h-${Date.now()}-${idx}`,
            user_id: userId,
            name: h.name,
            start_time: h.startTime,
            end_time: h.endTime,
            is_strict: Boolean(h.isStrict),
          }))));
        }
      }
    },

    async listFixedEvents(userId) {
      const rows = must(await sb.from('fixed_events').select('*').eq('user_id', userId).order('day_of_week').order('start_time'));
      return rows.map(rowToFixedEvent);
    },

    async insertFixedEvents(userId, events) {
      if (!events.length) return;
      must(await sb.from('fixed_events').upsert(events.map((ev) => fixedEventToRow(ev, userId)), { onConflict: 'user_id,id' }));
    },

    async deleteFixedEvent(userId, id) {
      must(await sb.from('fixed_events').delete().eq('user_id', userId).eq('id', id));
    },

    async toggleGap(userId, id) {
      const current = must(await sb.from('fixed_events').select('allow_gap_study').eq('user_id', userId).eq('id', id).maybeSingle());
      if (!current) return null;
      const next = !current.allow_gap_study;
      must(await sb.from('fixed_events').update({ allow_gap_study: next }).eq('user_id', userId).eq('id', id));
      return next;
    },

    async listPendingTasks(userId) {
      const rows = must(await sb.from('tasks').select('*').eq('user_id', userId).neq('status', 'COMPLETED').order('created_at', { ascending: false }));
      return rows.map(rowToTask);
    },

    async upsertTasks(userId, tasks) {
      if (!tasks.length) return;
      must(await sb.from('tasks').upsert(tasks.map((t) => taskToRow(t, userId)), { onConflict: 'user_id,id' }));
    },

    async deleteTask(userId, id) {
      must(await sb.from('tasks').delete().eq('user_id', userId).eq('id', id));
    },

    async recordTaskProgress(userId, id, minutes) {
      const row = must(await sb.from('tasks').select('estimated_minutes, completed_minutes').eq('user_id', userId).eq('id', id).maybeSingle());
      if (!row) return null;
      const completed = Math.min(row.estimated_minutes, (row.completed_minutes || 0) + Math.max(0, Math.round(minutes)));
      const status = completed >= row.estimated_minutes - 5 ? 'COMPLETED' : 'PENDING';
      must(await sb.from('tasks').update({ completed_minutes: completed, status }).eq('user_id', userId).eq('id', id));
      return { completedMinutes: completed, status };
    },

    async countPendingTasks(userId) {
      const { count, error } = await sb.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).neq('status', 'COMPLETED');
      if (error) throw new Error(`Database error: ${error.message}`);
      return count || 0;
    },

    async listReviews(userId) {
      const rows = must(await sb.from('session_reviews').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(500));
      return rows.map(rowToReview);
    },

    async insertReview(userId, r) {
      must(await sb.from('session_reviews').insert({ ...r, user_id: userId }));
    },

    async getBufferInflation(userId) {
      const profile = await ensureProfile(userId);
      return profile.learned_buffer_inflation ?? 1.0;
    },

    async setBufferInflation(userId, value) {
      must(await sb.from('profiles').update({ learned_buffer_inflation: value }).eq('id', userId));
    },

    async listFatigueHours(userId) {
      return must(await sb.from('fatigue_hours').select('hour').eq('user_id', userId)).map((f) => f.hour);
    },

    async addFatigueHour(userId, hour) {
      must(await sb.from('fatigue_hours').upsert({ user_id: userId, hour }, { onConflict: 'user_id,hour', ignoreDuplicates: true }));
    },

    async listCheckins(userId, sinceKey) {
      const rows = must(await sb.from('daily_checkins').select('date_key, data').eq('user_id', userId).gte('date_key', sinceKey));
      const result = {};
      rows.forEach((r) => {
        result[r.date_key] = r.data;
      });
      return result;
    },

    async upsertCheckin(userId, dateKey, data) {
      must(await sb.from('daily_checkins').upsert({ user_id: userId, date_key: dateKey, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date_key' }));
    },

    async listSessionLogs(userId) {
      const rows = must(await sb.from('session_reviews').select('*').eq('user_id', userId).not('planned_minutes', 'is', null).order('created_at', { ascending: false }).limit(300));
      return rows.map(rowToSessionLog);
    },

    async reset(userId) {
      for (const table of ['tasks', 'fixed_events', 'habits', 'session_reviews', 'fatigue_hours', 'daily_checkins']) {
        must(await sb.from(table).delete().eq('user_id', userId));
      }
      must(await sb.from('profiles').upsert({ id: userId, ...PROFILE_DEFAULTS }, { onConflict: 'id' }));
    },
  };
}
