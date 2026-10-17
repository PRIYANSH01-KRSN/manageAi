# ChronosFlow — Hyper-Realistic Cognitive Time Management & Strategy Engine

An AI-powered time management and strategy system designed for students, developers, and professionals who struggle with decision paralysis, overwhelming backlogs, and unrealistic scheduling.

---

## Key Features

- **Start Here, Right Now**: one clear next session with a 2-minute starter, an "I can't start" ladder that shrinks it (10 → 5 → 2 min), a timed step-by-step script, if-then plans and a "done when…" check.
- **Deadline-Aware Planner**: multi-day plan that puts hard work in your peak hours, finishes deadlines a day early, interleaves subjects, adds spaced-recall reviews, respects learn → practice order, and keeps a daily focus cap plus a flex buffer.
- **Realistic Time Estimates**: estimates from pages / chapters / problems × knowledge level × difficulty, best/likely/worst ranges, warnings for unrealistic guesses, and a learned personal pace per subject from timed sessions.
- **Daily Check-in**: sleep, energy, mood, stress, personal commitments, evening plans and available hours reshape today's plan (Full / Light / Recovery mode).
- **Backup Plans**: switch today to Plan B (must-dos) or Plan C (45-min minimum), or tap "Something came up" to re-plan around lost time.
- **Exam Battle Plan**: chapters + exam date + how well you know each → triaged plan (weak, high-weight first), core-only / skim triage when time is short, mock test and final review.
- **Protected Life**: guilt-free leisure, wind-down before bed, weekly half-day off, weekend routines.
- **Zero-Guilt Recalibration**: Done / Partly done / Stalled; each stall reason changes the plan (more time, an unblock session, micro-sprints, fatigue hours), forgiving day streaks, end-of-day wrap-up and a weekly review.
- **AI (Gemini)**: syllabus decomposition, plan review coach and per-topic session guides — all with offline rule-based fallbacks.
- **Extras**: calendar (.ics) export, browser reminders, distraction parking lot, timetable photo OCR, SQLite persistence.

---

## Tech Stack

- **Frontend**: React 19, Vite, Vanilla CSS (Minimalist Black & White Swiss design)
- **Backend**: Express.js REST API
- **Database**: SQLite (`better-sqlite3` in WAL mode)
- **AI / Multimodal**: Google Gemini 3.8 Flash
- **Audio**: Web Audio API Synthesizer (Zero-latency, zero-external bandwidth)

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/PRIYANSH01-KRSN/manageAi.git
cd manageAi
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
```

### 4. Run the Application
Start the backend API server:
```bash
npm run server
```

In a second terminal, start the Vite frontend:
```bash
npm run dev
```

Open your browser at `http://localhost:5173/`.

To put it online with student accounts (free Supabase + Vercel), follow [DEPLOYMENT.md](DEPLOYMENT.md).

Run the planner engine tests:
```bash
npm test
```

---

## License
MIT
