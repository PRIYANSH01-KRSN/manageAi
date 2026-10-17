// Local development entry point: `npm run server`
import app, { storageMode, aiEnabled } from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✓ ChronosFlow API running on http://localhost:${PORT}`);
  console.log(storageMode === 'supabase' ? '✓ Storage: Supabase (multi-user, sign-in required)' : '✓ Storage: local SQLite (single user)');
  console.log(aiEnabled ? `✓ Gemini model: ${process.env.GEMINI_MODEL || 'gemini-3.8-flash'}` : '⚠ GEMINI_API_KEY missing — AI endpoints return 503, client uses local fallbacks');
});
