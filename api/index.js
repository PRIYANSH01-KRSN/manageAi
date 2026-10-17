// Vercel serverless entry point. vercel.json rewrites /api/<path> → /api?__path=<path>;
// restore the original URL so the Express routes match.
import app from '../server/app.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.searchParams.get('__path');
  if (path !== null && !url.pathname.startsWith('/api/')) {
    url.searchParams.delete('__path');
    const query = url.searchParams.toString();
    req.url = `/api/${path}${query ? `?${query}` : ''}`;
  }
  return app(req, res);
}
