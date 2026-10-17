// ChronosFlow Express API Server with Gemini 3.8 Flash Integration
import express from 'express';
import cors from 'cors';
import { db, resetDatabase } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

app.use(cors());
app.use(express.json({ limit: '25mb' }));

const DEFAULT_USER_ID = 'default_user';

// Helper: Call Gemini 3.8 Flash API
async function callGemini(contents) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

// Health check
app.get('/api/status', (req, res) => {
  try {
    const user = db.prepare('SELECT id, chronotype FROM users WHERE id = ?').get(DEFAULT_USER_ID);
    const taskCount = db.prepare('SELECT count(*) as count FROM tasks').get();
    res.json({
      status: 'online',
      db: 'connected',
      databaseEngine: 'SQLite WAL mode',
      aiModel: 'Google Gemini 3.8 Flash (Active)',
      taskCount: taskCount.count,
      user,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Live AI Backlog Cruncher (Gemini 3.8 Flash)
app.post('/api/ai/crunch', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const systemPrompt = `You are an expert cognitive learning scientist and academic strategist.
Break down this student/professional goal or backlog into 3 to 5 atomic, actionable study or work units:
"${prompt}"

Rules:
1. Prioritize tasks into Eisenhower quadrants:
   - "Q1": Urgent & Important (Crises, immediate deadlines)
   - "Q2": Important, Not Urgent (Deep mastery, strategic foundation)
   - "Q3": Urgent, Not Important (Quick admin, small fixes)
   - "Q4": Low Priority
2. Keep estimatedMinutes between 20 and 50 minutes each.
3. Provide realistic materials to open first, anticipated roadblock, and a 3-step action path.
4. Output STRICTLY a valid JSON array matching this schema:
[
  {
    "title": "Clear Actionable Task Title",
    "quadrant": "Q1",
    "estimatedMinutes": 45,
    "confidence": 2,
    "weightage": 5,
    "materials": ["Reference material 1", "Worksheet"],
    "roadblock": "Anticipated point of failure or friction",
    "steps": ["Step 1: ... (5m)", "Step 2: ... (30m)", "Step 3: ... (10m)"],
    "stuckProtocol": "Specific action if blocked > 7 minutes"
  }
]
No markdown formatting, no conversational text, strictly raw JSON.`;

    const rawResponse = await callGemini([{ parts: [{ text: systemPrompt }] }]);
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const tasks = JSON.parse(cleanJson);

    // Save generated tasks directly to SQLite
    const insert = db.prepare(`
      INSERT INTO tasks (id, user_id, title, category, quadrant, estimated_minutes, confidence, weightage, materials, roadblock, steps, stuck_protocol, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const formattedTasks = tasks.map((t, idx) => ({
      id: `ai-task-${Date.now()}-${idx}`,
      title: t.title,
      category: 'general',
      quadrant: t.quadrant || 'Q1',
      estimatedMinutes: t.estimatedMinutes || 40,
      confidence: t.confidence || 3,
      weightage: t.weightage || 4,
      materials: t.materials || ['Notes'],
      roadblock: t.roadblock || 'Procrastination drift',
      steps: t.steps || ['Step 1: Open notes', 'Step 2: Execute task', 'Step 3: Verify'],
      stuckProtocol: t.stuckProtocol || 'Write down the question and proceed.',
    }));

    const insertMany = db.transaction((list) => {
      for (const t of list) {
        insert.run(
          t.id,
          DEFAULT_USER_ID,
          t.title,
          t.category,
          t.quadrant,
          t.estimatedMinutes,
          t.confidence,
          t.weightage,
          JSON.stringify(t.materials),
          t.roadblock,
          JSON.stringify(t.steps),
          t.stuckProtocol,
          'PENDING'
        );
      }
    });

    insertMany(formattedTasks);
    res.json({ success: true, tasks: formattedTasks });
  } catch (err) {
    console.error('Gemini Crunch Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Live Multimodal Vision Timetable Parser (Gemini 3.8 Flash)
app.post('/api/ai/parse-timetable', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image data is required' });

    const cleanBase64 = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const promptText = `Extract all classes, lectures, labs, or shifts from this timetable image into valid JSON strictly matching this schema:
[
  {
    "title": "Course Name or Shift",
    "location": "Room or Online",
    "dayOfWeek": 1, // 0=Sunday, 1=Monday ... 6=Saturday
    "startTime": "09:00", // 24-hr HH:mm
    "endTime": "10:30",
    "allowGapStudy": false // default false for post-class decompression
  }
]
Only return raw JSON. No markdown backticks.`;

    const contents = [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
        ],
      },
    ];

    const rawResponse = await callGemini(contents);
    const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    const events = JSON.parse(cleanJson);

    // Save directly to SQLite
    const insert = db.prepare(`
      INSERT INTO fixed_events (id, user_id, title, location, day_of_week, start_time, end_time, allow_gap_study, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const formattedEvents = events.map((ev, idx) => ({
      id: `ai-ocr-${Date.now()}-${idx}`,
      title: ev.title,
      location: ev.location || 'Campus / Office',
      dayOfWeek: Number(ev.dayOfWeek) || 1,
      startTime: ev.startTime || '09:00',
      endTime: ev.endTime || '10:30',
      allowGapStudy: Boolean(ev.allowGapStudy),
      source: 'GEMINI_3.8_VISION',
    }));

    const insertMany = db.transaction((list) => {
      for (const ev of list) {
        insert.run(
          ev.id,
          DEFAULT_USER_ID,
          ev.title,
          ev.location,
          ev.dayOfWeek,
          ev.startTime,
          ev.endTime,
          ev.allowGapStudy ? 1 : 0,
          ev.source
        );
      }
    });

    insertMany(formattedEvents);
    res.json({ success: true, events: formattedEvents });
  } catch (err) {
    console.error('Gemini Vision OCR Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// User Habits & Chronotype
app.get('/api/user', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(DEFAULT_USER_ID);
    const habits = db.prepare('SELECT * FROM habits WHERE user_id = ?').all(DEFAULT_USER_ID);
    const fatigueHours = db.prepare('SELECT hour FROM fatigue_hours WHERE user_id = ?').all(DEFAULT_USER_ID);

    res.json({
      userHabits: {
        chronotype: user.chronotype,
        wakeTime: user.wake_time,
        sleepTime: user.sleep_time,
        distractionFactor: user.distraction_factor,
        learnedBufferInflation: user.learned_buffer_inflation,
        habits: habits.map(h => ({
          id: h.id,
          name: h.name,
          startTime: h.start_time,
          endTime: h.end_time,
          isStrict: Boolean(h.is_strict),
        })),
        learnedFatigueHours: fatigueHours.map(f => f.hour),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/user', (req, res) => {
  try {
    const { chronotype, wakeTime, sleepTime, distractionFactor, habits } = req.body;

    db.prepare(`
      UPDATE users 
      SET chronotype = ?, wake_time = ?, sleep_time = ?, distraction_factor = ?
      WHERE id = ?
    `).run(chronotype, wakeTime, sleepTime, distractionFactor, DEFAULT_USER_ID);

    if (Array.isArray(habits)) {
      db.prepare('DELETE FROM habits WHERE user_id = ?').run(DEFAULT_USER_ID);
      const insertHabit = db.prepare(`
        INSERT INTO habits (id, user_id, name, start_time, end_time, is_strict)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      habits.forEach(h => {
        insertHabit.run(h.id || `h-${Date.now()}`, DEFAULT_USER_ID, h.name, h.startTime, h.endTime, h.isStrict ? 1 : 0);
      });
    }

    res.json({ success: true, message: 'User habits updated in SQLite' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fixed Events (Classes, Shifts, Meetings)
app.get('/api/fixed-events', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM fixed_events WHERE user_id = ? ORDER BY day_of_week, start_time').all(DEFAULT_USER_ID);
    res.json(events.map(ev => ({
      id: ev.id,
      title: ev.title,
      location: ev.location,
      dayOfWeek: ev.day_of_week,
      startTime: ev.start_time,
      endTime: ev.end_time,
      allowGapStudy: Boolean(ev.allow_gap_study),
      source: ev.source,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/fixed-events', (req, res) => {
  try {
    const { id, title, location, dayOfWeek, startTime, endTime, allowGapStudy, source } = req.body;
    const eventId = id || `fe-${Date.now()}`;

    db.prepare(`
      INSERT INTO fixed_events (id, user_id, title, location, day_of_week, start_time, end_time, allow_gap_study, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, DEFAULT_USER_ID, title, location || '', dayOfWeek, startTime, endTime, allowGapStudy ? 1 : 0, source || 'MANUAL');

    res.json({ success: true, eventId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/fixed-events/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM fixed_events WHERE id = ? AND user_id = ?').run(req.params.id, DEFAULT_USER_ID);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/fixed-events/:id/toggle-gap', (req, res) => {
  try {
    const current = db.prepare('SELECT allow_gap_study FROM fixed_events WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Event not found' });

    const updatedValue = current.allow_gap_study ? 0 : 1;
    db.prepare('UPDATE fixed_events SET allow_gap_study = ? WHERE id = ?').run(updatedValue, req.params.id);

    res.json({ success: true, allowGapStudy: Boolean(updatedValue) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks (Eisenhower Matrix)
app.get('/api/tasks', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC').all(DEFAULT_USER_ID);
    const tasks = rows.map(r => ({
      id: r.id,
      title: r.title,
      category: r.category,
      quadrant: r.quadrant,
      estimatedMinutes: r.estimated_minutes,
      confidence: r.confidence,
      weightage: r.weightage,
      materials: r.materials ? JSON.parse(r.materials) : [],
      roadblock: r.roadblock,
      steps: r.steps ? JSON.parse(r.steps) : [],
      stuckProtocol: r.stuck_protocol,
      status: r.status,
    }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', (req, res) => {
  try {
    const t = req.body;
    const taskId = t.id || `task-${Date.now()}`;

    db.prepare(`
      INSERT INTO tasks (id, user_id, title, category, quadrant, estimated_minutes, confidence, weightage, materials, roadblock, steps, stuck_protocol, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      DEFAULT_USER_ID,
      t.title,
      t.category || 'general',
      t.quadrant || 'Q1',
      t.estimatedMinutes || 45,
      t.confidence || 3,
      t.weightage || 3,
      JSON.stringify(t.materials || []),
      t.roadblock || '',
      JSON.stringify(t.steps || []),
      t.stuckProtocol || '',
      'PENDING'
    );

    res.json({ success: true, taskId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/batch', (req, res) => {
  try {
    const { tasks } = req.body;
    const insert = db.prepare(`
      INSERT INTO tasks (id, user_id, title, category, quadrant, estimated_minutes, confidence, weightage, materials, roadblock, steps, stuck_protocol, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((taskList) => {
      for (const t of taskList) {
        insert.run(
          t.id || `task-${Date.now()}-${Math.random()}`,
          DEFAULT_USER_ID,
          t.title,
          t.category || 'general',
          t.quadrant || 'Q1',
          t.estimatedMinutes || 45,
          t.confidence || 3,
          t.weightage || 3,
          JSON.stringify(t.materials || []),
          t.roadblock || '',
          JSON.stringify(t.steps || []),
          t.stuckProtocol || '',
          'PENDING'
        );
      }
    });

    insertMany(tasks);
    res.json({ success: true, count: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, DEFAULT_USER_ID);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reviews & Adaptive Learning
app.get('/api/reviews', (req, res) => {
  try {
    const reviews = db.prepare('SELECT * FROM session_reviews WHERE user_id = ? ORDER BY created_at DESC').all(DEFAULT_USER_ID);
    const user = db.prepare('SELECT learned_buffer_inflation FROM users WHERE id = ?').get(DEFAULT_USER_ID);
    const fatigueHours = db.prepare('SELECT hour FROM fatigue_hours WHERE user_id = ?').all(DEFAULT_USER_ID);

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        taskTitle: r.task_title,
        quadrant: r.quadrant,
        status: r.status,
        reasonId: r.reason_id,
        userNote: r.user_note,
        hourOfDay: r.hour_of_day,
        timestamp: r.created_at,
      })),
      learnedBufferInflation: user ? user.learned_buffer_inflation : 1.0,
      learnedFatigueHours: fatigueHours.map(f => f.hour),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', (req, res) => {
  try {
    const { scheduledBlock, status, reasonId, userNote } = req.body;
    const reviewId = `rev-${Date.now()}`;
    const hourOfDay = scheduledBlock ? Math.floor(scheduledBlock.startMin / 60) : new Date().getHours();

    db.prepare(`
      INSERT INTO session_reviews (id, user_id, task_id, task_title, quadrant, status, reason_id, user_note, hour_of_day)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      DEFAULT_USER_ID,
      scheduledBlock?.taskId || '',
      scheduledBlock?.taskTitle || 'Focused Session',
      scheduledBlock?.quadrant || 'Q1',
      status,
      status === 'NOT_DONE' ? reasonId : null,
      userNote || '',
      hourOfDay
    );

    let encouragementNote = '';

    if (status === 'COMPLETED') {
      encouragementNote = `Great momentum! "${scheduledBlock?.taskTitle}" is complete. Recorded in SQLite database.`;
      if (scheduledBlock?.taskId) {
        db.prepare('DELETE FROM tasks WHERE id = ? OR id = ?').run(scheduledBlock.taskId, scheduledBlock.taskId.split('-part')[0]);
      }
    } else {
      const user = db.prepare('SELECT learned_buffer_inflation FROM users WHERE id = ?').get(DEFAULT_USER_ID);
      let newBuffer = user ? user.learned_buffer_inflation : 1.0;

      if (reasonId === 'UNDERESTIMATED_TIME') {
        newBuffer = Math.min(newBuffer + 0.15, 1.8);
        db.prepare('UPDATE users SET learned_buffer_inflation = ? WHERE id = ?').run(newBuffer, DEFAULT_USER_ID);
        encouragementNote = `Zero guilt. We increased your buffer by +15% in database to eliminate future time anxiety.`;
      } else if (reasonId === 'LOW_ENERGY_FATIGUE') {
        db.prepare('INSERT OR IGNORE INTO fatigue_hours (user_id, hour) VALUES (?, ?)').run(DEFAULT_USER_ID, hourOfDay);
        encouragementNote = `Fatigue recorded for ${hourOfDay}:00. The scheduler will not allocate heavy work during this hour.`;
      } else {
        encouragementNote = `Rescheduled without penalty. Take a deep breath and jump into the next clean block.`;
      }
    }

    res.json({
      success: true,
      reviewId,
      encouragementNote,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset Database
app.post('/api/reset-data', (req, res) => {
  try {
    resetDatabase();
    res.json({ success: true, message: 'Database reset to clean seeds' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ ChronosFlow Backend Server running on http://localhost:${PORT}`);
  console.log(`✓ SQLite Database connected: chronosflow.db`);
  console.log(`✓ Gemini 3.8 Flash configured`);
});
