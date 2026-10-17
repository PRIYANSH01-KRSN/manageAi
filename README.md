# ChronosFlow — Hyper-Realistic Cognitive Time Management & Strategy Engine

An AI-powered time management and strategy system designed for students, developers, and professionals who struggle with decision paralysis, overwhelming backlogs, and unrealistic scheduling.

---

## Key Features

- **Decision Paralysis Destroyer ("Start Right Now")**: Removes guesswork by highlighting the single immediate optimal task to work on right now, with complete anti-procrastination execution guides.
- **Minimalist Round Counter Timer**: High-contrast circular progress ring with countdown display, session tracking, and Web Audio API focus soundscapes (Brown Noise, Soft Rain, 10Hz Alpha Waves).
- **Eisenhower Matrix Backlog Cruncher**: Categorizes goals across Q1 (Do First), Q2 (Deep Mastery), Q3 (Quick Gaps), and Q4 (Low Priority).
- **Gemini 3.8 Flash Backlog Decomposer**: Converts raw multi-chapter syllabus inputs into 20–45 minute atomic units with specific resources, anticipated roadblocks, and 3-step action paths.
- **Timetable & Schedule Image OCR**: Ingests timetable photos, extracts lectures and shifts, automatically detects gaps, and injects mandatory 20-minute post-class rest buffers.
- **Zero-Guilt Adaptive Recalibration**: Analyzes stall reasons (Underestimated Time, Fatigue Zone, Roadblock, Distraction) and recalibrates remaining days without guilt or penalties.
- **Dedicated SQLite Backend**: Persistent storage using `better-sqlite3` in WAL mode via an Express REST API.

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

---

## License
MIT
