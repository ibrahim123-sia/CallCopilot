# CallCopilot

**Next.js 15 · React 19 · TypeScript · Tailwind · SQLite · Groq + Google Gemini (free tiers)**

A local-first copilot for client meetings. It listens to your Google Meet / Zoom / Teams call in the
browser, shows live captions in **English with a Roman Urdu translation next to each line**, suggests what
to say next and which questions to ask — using **everything from earlier meetings with that client** — and
afterwards writes the summary, action items, follow-up email and a downloadable **PDF report**.

Each client has its own workspace: meetings, an AI chat, documents, and a living "client brief" that the AI
updates after every meeting.

---

## Features

- **Per-client memory.** Every meeting is saved (full transcript + summary). Before and during the next call
  the AI sees the client brief, the last meetings, open items and relevant excerpts, so suggestions and
  cross-questions build on history (marked with a `from M2` badge).
- **Live captions, two languages.** English captions with Roman Urdu in a second column (or stacked under
  each line). Technical terms stay in English.
- **Live copilot.** "Say next" replies, sharp cross-questions, client intent, buying signals and red flags,
  quick lookup of any term, and insight cards for technologies new to your team.
- **Open-items checklist.** Unresolved questions and promises from earlier meetings appear as a checklist
  during the call and tick themselves off when they get discussed.
- **Client chat.** Ask "what did they say about budget last time?" in English or Roman Urdu; answers cite
  the meeting or document they came from.
- **Feed old context.** Upload DOCX / PDF / TXT / MD or paste notes. Mark them as "from a previous meeting"
  and the AI turns them into a past meeting and updates the brief.
- **Reviewable brief updates.** After a meeting the AI proposes changes to the client brief, shown as a diff
  you accept, edit or discard.
- **Reports.** Real PDF download (rendered by Chromium, so Urdu text shapes correctly) with client-facing or
  internal audience, optional full transcript and Roman Urdu. Markdown and TXT exports too.
- **Crash-safe.** Every transcript line is saved to the local database as it arrives; an unfinished meeting
  can be resumed.
- **Free to run, two AI providers.** Groq is tried first (very fast); Gemini is the automatic fallback when
  Groq is rate-limited, fails, or a request is too large for Groq's free token budget. Gemini also does the
  live speech-to-text. Pacing is configurable and the app backs off automatically when a limit is hit.

## How it works

```
 Meeting tab audio ─┐                     ┌─ Gemini Live (transcribe) — client channel
                    ├─ browser mixer ─────┤
 Your microphone ───┘   (2 channels)      └─ Gemini Live (transcribe) — your channel
                                │
                     final caption lines
           ┌────────────────────┼─────────────────────────┐
           ▼                    ▼                         ▼
  save to SQLite        Roman Urdu batch           live analysis (debounced)
  (/segments)           (/translate)               (/analyze + client memory:
                                                     brief, last meetings,
                                                     open items, keyword search
                                                     over past transcripts/docs)
                                │
                          End meeting
                                ▼
           summary + tasks + email (/summarize) → brief update proposal
                                ▼
                   PDF / Markdown / TXT, client chat
```

- **Speaker separation** is deterministic: the meeting tab is "client", your mic is "you". Each channel runs
  its own Gemini Live transcription session; sessions rotate before the ~10-minute limit and reconnect with
  a fresh single-use token after any drop (the API key never reaches the browser).
- **Retrieval** is local keyword search (MiniSearch/BM25) over a client's past transcripts and documents —
  no embedding calls, so no extra quota.
- **Separate models per task** (live, captions, summaries) because free-tier limits are counted per model.
- **Provider router** (`lib/ai/llm.ts`): Groq → Gemini by default (switchable in Settings). Rate limits put a
  model on cooldown so the next request goes straight to the other provider.

## Getting started

Requirements: Node.js 20+ and Chrome or Edge.

```bash
npm install
cp .env.example .env        # set GEMINI_API_KEY (aistudio.google.com/apikey) and GROQ_API_KEY (console.groq.com/keys)
npm run dev                 # http://localhost:3000
```

1. Open **Settings** and describe your team (skills, industries, what you don't do).
2. Add a client. Optionally upload notes from earlier meetings (tick *"This is from a previous meeting"*).
3. Click **Start meeting**, then **Meeting tab + my mic**. In the share picker choose the meeting tab and tick
   **Share tab audio**. Wear headphones so the client's voice isn't also picked up by your mic.
4. Click **End meeting** — the summary and brief update are generated; download the PDF from the meeting page.

No key yet? **Try demo call** plays a scripted conversation with sample suggestions.

### Free tier notes

- Free-tier limits depend on your Google account and are shown in AI Studio. If a limit is reached the app
  pauses that feature and retries automatically; captions and saving are never blocked.
- Settings → *Live call* controls how often suggestions refresh (default every 12 s) and how long captions
  are batched before translating (default 6 s).
- Google may use free-tier API data to improve its products. For NDA-sensitive meetings, enable billing on the
  Google project.

## Data & privacy

All clients, meetings, transcripts, documents and chats are stored only on your computer in
`data/callcopilot.db` (SQLite, git-ignored). Audio and text are sent to Google Gemini for processing.
Back up by copying the database file while the app is stopped. Deleting a client deletes all of its data.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | — | Recommended. Free key; tried first for all text AI |
| `GROQ_LIVE_MODEL` | `openai/gpt-oss-20b` | Groq: live suggestions & lookups |
| `GROQ_TRANSLATE_MODEL` | `qwen/qwen3.8-27b` | Groq: Roman Urdu captions |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq: summaries, brief, chat |
| `GROQ_MAX_TOKENS_PER_REQUEST` | `7000` | Bigger requests skip Groq and use Gemini |
| `GEMINI_API_KEY` | — | Required for live captions; AI fallback |
| `GEMINI_STT_MODEL` | `gemini-3.5-transcribe-live` | Live speech-to-text |
| `GEMINI_LIVE_MODEL` | `gemini-3.5-flash-lite` | Live suggestions & lookups |
| `GEMINI_TRANSLATE_MODEL` | `gemini-3.1-flash-lite` | Roman Urdu captions |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Summaries, client brief, chat |
| `DEEPGRAM_API_KEY` | — | Optional alternative transcription (paid) |
| `DATABASE_PATH` | `./data/callcopilot.db` | SQLite location |

## Project structure

```
app/
  (workspace)/            sidebar layout: home, clients/[id], meetings/[id], settings
  live/[id]/              full-screen live call
  api/                    route handlers (clients, meetings, segments, analyze, translate,
                          summarize, pdf, chat, documents, settings, stt-token)
components/
  client/                 brief panel (with diff review), chat, documents, meetings, import dialog
  live/                   copilot suggestions, context & open-items panel
  meeting/                transcript view (dual captions), wrap-up editor, export, start dialog
  shell/ ui/              sidebar, theme, dialog, toast, markdown
lib/
  db/                     Drizzle schema, connection + migrations, repository
  ai/                     llm.ts (Groq→Gemini router), groq.ts, gemini.ts, common.ts (errors, cooldowns, JSON)
  memory/                 client memory assembly and local retrieval
  services/               live analysis, summaries/brief/import, translation, chat
  transcription/          Gemini Live (default), Deepgram, demo providers
  client/                 live session hook, segment saver, translation queue
  pdf/                    report template + Chromium PDF rendering
drizzle/                  SQL migrations
tests/                    Vitest suite
```

## Deploying to Cloudflare (optional)

The same code runs on Cloudflare Workers with D1 (database) and Browser Rendering (PDF). Local use is unchanged.

```bash
npx wrangler login
npx wrangler d1 create callcopilot        # paste database_id into wrangler.jsonc
npm run cf:db:migrate:remote              # create tables in D1
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GEMINI_API_KEY
npm run cf:deploy                         # → https://callcopilot.<you>.workers.dev
```

Then put the app behind **Cloudflare Access** (email login) and set `CF_ACCESS_TEAM_DOMAIN` / `CF_ACCESS_AUD`
as secrets. Test the Worker locally first with `npm run cf:preview` (needs `.dev.vars`). Move existing data with
`npm run cf:export-local` + `wrangler d1 execute callcopilot --remote --file .wrangler/d1-import.sql`.
Full walkthrough: `docs/CallCopilot-Cloudflare-Guide.pdf`.

## Documentation

A full technical guide (architecture, every library and why, data flow, AI router, prompts, API, testing,
learning path) lives in `docs/` — kept locally and git-ignored. Edit `docs/technical-guide.html` and run
`npm run docs` to rebuild `docs/CallCopilot-Technical-Guide.pdf`.

## Development

```bash
npm test            # unit + integration tests (offline, mocked AI)
npm run typecheck
npm run lint
npm run build
npx drizzle-kit generate   # after changing lib/db/schema.ts
npm run docs               # rebuild the technical guide PDF
```

## License

[MIT](LICENSE)
