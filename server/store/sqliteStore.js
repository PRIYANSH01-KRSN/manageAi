// Local single-user storage (better-sqlite3). Used when Supabase isn't configured.
// Loaded lazily so serverless deployments never touch the native module.
import { taskToRow, rowToTask, rowToFixedEvent, fixedEventToRow, profileToHabits, rowToReview, rowToSessionLog, pickPreferences, PROFILE_DEFAULTS } from './shared.js';

export async function createSqliteStore() {
  const { db, resetDatabase } = await import('../db.js');

  const ensureUser = (userId) => {
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)) {
      db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(userId, 'User');
    }
  };

  const upsertTaskStmt = db.prepare(`
    INSERT OR REPLACE INTO tasks (id, user_id, title, category, subject, quadrant, estimated_minutes, completed_minutes,
      confidence, weightage, difficulty, deadline, task_type, knowledge_level, volume_type, volume_count, depends_on, group_id,
      micro_sprints, materials, roadblock, steps, stuck_protocol, status)
    VALUES (@id, @user_id, @title, @category, @subject, @quadrant, @estimated_minutes, @completed_minutes,
      @confidence, @weightage, @difficulty, @deadline, @task_type, @knowledge_level, @volume_type, @volume_count, @depends_on, @group_id,
      @micro_sprints, @materials, @roadblock, @steps, @stuck_protocol, @status)
  `);

  return {
    mode: 'sqlite',

    async getProfile(userId) {
      ensureUser(userId);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(userId);
      const fatigue = db.prepare('SELECT hour FROM fatigue_hours WHERE user_id = ?').all(userId);
      return profileToHabits(user, habits, fatigue);
    },

    async saveProfile(userId, body, sanitized) {
      ensureUser(userId);
      db.prepare(`
        UPDATE users SET chronotype = ?, wake_time = ?, sleep_time = ?, distraction_factor = ?, session_style = ?, daily_focus_cap_minutes = ?, preferences = ?
        WHERE id = ?
      `).run(sanitized.chronotype, sanitized.wake_time, sanitized.sleep_time, sanitized.distraction_factor, sanitized.session_style, sanitized.daily_focus_cap_minutes, JSON.stringify(pickPreferences(body)), userId);

      if (Array.isArray(body.habits)) {
        db.transaction(() => {
          db.prepare('DELETE FROM habits WHERE user_id = ?').run(userId);
          const ins = db.prepare('INSERT INTO habits (id, user_id, name, start_time, end_time, is_strict) VALUES (?, ?, ?, ?, ?, ?)');
          body.habits.forEach((h, idx) => ins.run(h.id || `h-${Date.now()}-${idx}`, userId, h.name, h.startTime, h.endTime, h.isStrict ? 1 : 0));
        })();
      }
    },

    async listFixedEvents(userId) {
      return db.prepare('SELECT * FROM fixed_events WHERE user_id = ? ORDER BY day_of_week, start_time').all(userId).map(rowToFixedEvent);
    },

    async insertFixedEvents(userId, events) {
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fixed_events (id, user_id, title, location, day_of_week, start_time, end_time, allow_gap_study, source)
        VALUES (@id, @user_id, @title, @location, @day_of_week, @start_time, @end_time, @allow_gap_study, @source)
      `);
      db.transaction(() => events.forEach((ev) => {
        const row = fixedEventToRow(ev, userId);
        ins.run({ ...row, allow_gap_study: row.allow_gap_study ? 1 : 0 });
      }))();
    },

    async deleteFixedEvent(userId, id) {
      db.prepare('DELETE FROM fixed_events WHERE id = ? AND user_id = ?').run(id, userId);
    },

    async toggleGap(userId, id) {
      const current = db.prepare('SELECT allow_gap_study FROM fixed_events WHERE id = ? AND user_id = ?').get(id, userId);
      if (!current) return null;
      const next = current.allow_gap_study ? 0 : 1;
      db.prepare('UPDATE fixed_events SET allow_gap_study = ? WHERE id = ? AND user_id = ?').run(next, id, userId);
      return Boolean(next);
    },

    async listPendingTasks(userId) {
      return db.prepare("SELECT * FROM tasks WHERE user_id = ? AND status != 'COMPLETED' ORDER BY created_at DESC").all(userId).map(rowToTask);
    },

    async upsertTasks(userId, tasks) {
      db.transaction(() => tasks.forEach((t) => {
        const row = taskToRow(t, userId);
        upsertTaskStmt.run({ ...row, micro_sprints: row.micro_sprints ? 1 : 0, materials: JSON.stringify(row.materials), steps: JSON.stringify(row.steps) });
      }))();
    },

    async deleteTask(userId, id) {
      db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, userId);
    },

    async recordTaskProgress(userId, id, minutes) {
      const row = db.prepare('SELECT estimated_minutes, completed_minutes FROM tasks WHERE id = ? AND user_id = ?').get(id, userId);
      if (!row) return null;
      const completed = Math.min(row.estimated_minutes, (row.completed_minutes || 0) + Math.max(0, Math.round(minutes)));
      const status = completed >= row.estimated_minutes - 5 ? 'COMPLETED' : 'PENDING';
      db.prepare('UPDATE tasks SET completed_minutes = ?, status = ? WHERE id = ? AND user_id = ?').run(completed, status, id, userId);
      return { completedMinutes: completed, status };
    },

    async countPendingTasks(userId) {
      return db.prepare("SELECT count(*) as count FROM tasks WHERE user_id = ? AND status != 'COMPLETED'").get(userId).count;
    },

    async listReviews(userId) {
      return db.prepare('SELECT * FROM session_reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 500').all(userId).map(rowToReview);
    },

    async insertReview(userId, r) {
      db.prepare(`
        INSERT INTO session_reviews (id, user_id, task_id, task_title, quadrant, status, reason_id, user_note, hour_of_day,
          kind, subject, task_type, planned_minutes, actual_minutes, progress_pct)
        VALUES (@id, @user_id, @task_id, @task_title, @quadrant, @status, @reason_id, @user_note, @hour_of_day,
          @kind, @subject, @task_type, @planned_minutes, @actual_minutes, @progress_pct)
      `).run({ ...r, user_id: userId });
    },

    async getBufferInflation(userId) {
      ensureUser(userId);
      return db.prepare('SELECT learned_buffer_inflation FROM users WHERE id = ?').get(userId)?.learned_buffer_inflation ?? 1.0;
    },

    async setBufferInflation(userId, value) {
      db.prepare('UPDATE users SET learned_buffer_inflation = ? WHERE id = ?').run(value, userId);
    },

    async listFatigueHours(userId) {
      return db.prepare('SELECT hour FROM fatigue_hours WHERE user_id = ?').all(userId).map((f) => f.hour);
    },

    async addFatigueHour(userId, hour) {
      db.prepare('INSERT OR IGNORE INTO fatigue_hours (user_id, hour) VALUES (?, ?)').run(userId, hour);
    },

    async listCheckins(userId, sinceKey) {
      const rows = db.prepare('SELECT date_key, data FROM daily_checkins WHERE user_id = ? AND date_key >= ?').all(userId, sinceKey);
      const result = {};
      rows.forEach((r) => {
        try {
          result[r.date_key] = JSON.parse(r.data);
        } catch {
          // ignore corrupted rows
        }
      });
      return result;
    },

    async upsertCheckin(userId, dateKey, data) {
      db.prepare(`
        INSERT INTO daily_checkins (user_id, date_key, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, date_key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
      `).run(userId, dateKey, JSON.stringify(data));
    },

    async listSessionLogs(userId) {
      return db
        .prepare('SELECT * FROM session_reviews WHERE user_id = ? AND planned_minutes IS NOT NULL ORDER BY created_at DESC LIMIT 300')
        .all(userId)
        .map(rowToSessionLog);
    },

    async reset(userId) {
      if (userId === 'default_user') {
        resetDatabase();
        return;
      }
      db.transaction(() => {
        ['tasks', 'fixed_events', 'habits', 'session_reviews', 'fatigue_hours', 'daily_checkins'].forEach((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(userId));
        db.prepare('UPDATE users SET chronotype = ?, wake_time = ?, sleep_time = ?, distraction_factor = ?, learned_buffer_inflation = ? WHERE id = ?').run(
          PROFILE_DEFAULTS.chronotype, PROFILE_DEFAULTS.wake_time, PROFILE_DEFAULTS.sleep_time, PROFILE_DEFAULTS.distraction_factor, 1.0, userId
        );
      })();
    },
  };
}
