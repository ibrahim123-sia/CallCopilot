# README · Contributing · MIT license

# CallCopilot
**Next.js 15 · React 19 · TypeScript · Tailwind CSS · Google Gemini · Deepgram · License: MIT**

A stateless, production-grade real-time client-call assistant for software engineering consultancies and sales engineers. CallCopilot sits beside live client meetings (Google Meet, Microsoft Teams, Zoom in browser), listens via deterministic dual-channel browser audio mixing, transcribes speech live with automatic speaker separation, and generates instant technical insight cards, buying signals, suggested replies, incisive cross-questions, and an executive post-meeting PDF report.

Built on Next.js 15 App Router, TypeScript (strict), and Tailwind CSS, with real-time speech intelligence powered by Google Gemini (`@google/genai` with Google Search grounding) and multichannel streaming speech-to-text powered by Deepgram Nova-2.

---

## Preview

```
+-------------------------------------------------------------------------------------------------------------------------+
| [●] CallCopilot  [DEMO MODE]  |  (●) Listening  |  04:15  |  Talk Split: [Client 62% ■■■■■□□□ Team 38%]  | [Pause] [End Call] |
+-------------------------------------------------------------+-----------------------------------+-----------------------+
| LIVE TRANSCRIPT (Channel 1: Client / Channel 0: Team)       | INSIGHT CARDS (Real-time)         | REPLIES & SIGNALS     |
|                                                             |                                   |                       |
| [12:02:10] Our Team:                                        | [NEW TO TEAM]  Model Context      | CLIENT INTENT:        |
| Welcome Alex, excited to discuss your CRM project.          | Protocol (MCP)                    | Wants AI CRM search   |
|                                                             | Type: Technology • Confidence: Hi | under $25k budget cap |
| [12:02:25] Client:                                          | Emerging open standard from       |                       |
| Our sales reps are drowning in notes. We were reading       | Anthropic for connecting models   | SIGNALS DETECTED:     |
| about Anthropic's Model Context Protocol (MCP). Could we    | to live data tools safely via     | • [Budget] "$25k cap" |
| build an MCP server for our CRM?                            | standardized JSON-RPC.            | • [Timeline] "6 wks"  |
|                                                             | Sources: [modelcontextprotocol.io]|                       |
| [12:02:45] Client:                                          |                                   | SUGGESTED REPLIES:    |
| Also, our schema is 12 years old, and budget is capped at   | Vector Search & Hybrid Retrieval  | [Professional] [Copy] |
| $25k for the pilot.                                         | Type: Approach • Confidence: High | "An MCP architecture  |
|                                                             | Combines dense vector embeddings  | isolates your legacy  |
| [12:02:50] Client (speaking live...):                       | with BM25 full-text keyword       | CRM safely..."        |
| بہت شکریہ! That sounds like a solid plan.                   | indexing for customer notes.      |                       |
+-------------------------------------------------------------+-----------------------------------+-----------------------+
```

---

## Features

- **Deterministic Dual-Channel Audio Separation** — Mixes user microphone (`getUserMedia`) on Channel 0 (Our Team) and shared browser tab audio (`getDisplayMedia`) on Channel 1 (Client). Guarantees reliable speaker tagging without acoustic guessing.
- **Real-Time Streaming Transcription** — Deepgram Nova-2 multichannel WebSocket streaming with interim results, automatic endpointing, and bilingual support (English and Urdu with native right-to-left shaping).
- **In-Call Technical Insight Cards** — Automatically triggers when the client speaks. Explains unfamiliar technologies, frameworks, competitors, and compliance regulations in 2–4 concise, plain-language lines with advantages, considerations, and external source chips.
- **"NEW to Our Team" Amber Tagging** — Compares client mentions against your team's skillset profile (`TeamProfile`). Topics outside your expertise or emerging industry paradigms receive an amber left rule and a distinct `NEW TO TEAM` badge, collected into a dedicated review tray.
- **Manual In-Call Tools** — Instant Quick Lookup box (`/api/lookup`), card pinning, card dismissal, 1-click response copying, interactive talk-time meter (Client % vs Team % split), and an in-call scratchpad notes area.
- **Built-in Offline Demo Mode** — An interactive scripted call player simulating an enterprise client requesting a CRM MCP server and vector search. Operates 100% out of the box without requiring audio permissions or API keys.
- **Audience-Aware Wrap-Up Engine** — Generates executive meeting summaries, categorized discussion points, client requirements, decisions, open questions, risks, and actionable task lists with an **Audience Switch**:
  - **Client-Facing (Default):** Outcome, executive summary, discussion points, requirements, decisions, and tasks. Internal strategy, risks, and research items are strictly suppressed.
  - **Internal Team:** Everything, including confidential risks, buying signals, and "New to us" research lists.
- **Executive Vector PDF Reports** — One-click download of typeset vector PDF reports with selectable text, outcome highlight box, tasks table, checkbox glyphs, and an optional word-for-word transcript appendix (unchecked by default).
- **Verified Urdu Complex Script Rendering** — Native bi-directional (RTL) Arabic/Urdu text shaping embedded with Google's `Noto Naskh Arabic` font.
- **100% Stateless & Private** — No database, no file or object storage, and no server-side transcript logging. Every meeting exists solely in ephemeral browser memory.

---

## How It Works

CallCopilot rejects database storage and disk persistence. Every call executes as an ephemeral, client-driven pipeline:

```
+-------------------------------------------------------------------------------------------------+
|                                     CALLCOPILOT DATA PIPELINE                                    |
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   1. CAPTURE   --> Web Audio Context mixes Mic (Channel 0: Team) and Tab Audio (Channel 1: Client)|
|                                                                                                 |
|   2. STREAM    --> 16kHz Linear16 PCM chunks streamed via direct wss:// to Deepgram               |
|                                                                                                 |
|   3. INGEST    --> Client transcript entries feed into AnalysisTriggerController                |
|                                                                                                 |
|   4. DEBOUNCE  --> 2000ms silence debounce + 5000ms min interval rate guard                     |
|                                                                                                 |
|   5. INFER     --> POST /api/analyze sends rolling window to Gemini (gemini-2.5-flash)          |
|                    with Google Search grounding and structured JSON enforcement                 |
|                                                                                                 |
|   6. RENDER    --> 3-pane responsive workspace displays transcript, amber NEW cards, and replies|
|                                                                                                 |
|   7. WRAP-UP   --> POST /api/summarize extracts outcomes, decisions, tasks, and follow-up email |
|                                                                                                 |
|   8. EXPORT    --> Vector PDF rendered in browser with selectable text and optional transcript  |
|                                                                                                 |
+-------------------------------------------------------------------------------------------------+
```

---

## Architecture

| Component | Technology | Role |
|---|---|---|
| **Frontend Workspace** | Next.js 15 (React 19), Tailwind CSS | 3-pane responsive workspace, top bar meter, modals, and wrap-up view |
| **Audio Engine** | Web Audio API (`AudioContext`, `ChannelMergerNode`) | Dual-channel microphone and screen-tab audio capture and PCM conversion |
| **STT Provider Layer** | `TranscriptionProvider` interface | Pluggable streaming STT (`DeepgramTranscriptionProvider` & `DemoTranscriptionProvider`) |
| **AI Inference Backend** | `@google/genai` (Google Gemini) | Server-side structured JSON generation with search grounding and prompt templates |
| **Validation Engine** | Zod v3 | Strict runtime typing and validation for live cards, wrap-ups, and lookups |
| **Export Engine** | Browser Print Engine + Vector CSS | Typeset vector PDF reports with RTL Urdu shaping and Markdown generators |
| **Rate Limiter** | Ephemeral In-Memory sliding window | Protects API endpoints against quota exhaustion per client IP |

---

## Models & Inference Strategy

- **Primary Model**: `Google Gemini` (Configurable via `GEMINI_MODEL`, default: `gemini-2.5-flash`).
- **Grounding Tool**: Google Search grounding (`tools: [{ googleSearch: {} }]`) enabled on live analysis to retrieve up-to-date documentation and citations for emerging technologies.
- **JSON Contract & Anti-Hallucination**:
  - The model is instructed through strict system prompts (`SYSTEM_ANALYSIS_PROMPT_V1`, `SYSTEM_SUMMARIZE_PROMPT_V1`) to output raw JSON matching Zod schemas.
  - Tasks cannot be fabricated. Explicitly assigned action items are tagged `isClientRequested: true`, while inferred action items are tagged `isSuggested: true`.
- **Defensive Parsing & Repair**: Markdown code fences (````json````) and trailing commas are stripped automatically. In case of truncated JSON, `safeParseJson` performs bracket and quote balancing before validation.
- **Zero-Key Canned Fallback**: In Demo Mode or if `GEMINI_API_KEY` is omitted, the backend seamlessly returns realistic canned analyses and wrap-up data so onboarding and automated tests work out of the box.

---

## Stateless Design vs. Persistence

CallCopilot rejects server-side databases (no PostgreSQL, MongoDB, SQLite, Redis, or disk storage):

- **Client Privacy & Compliance**: Live enterprise calls frequently disclose proprietary software architecture, budgets, or security vulnerabilities. Zero server persistence guarantees that call data cannot be exposed in a data breach.
- **Zero Retention**: Transcripts and PCM audio chunks exist exclusively in volatile browser RAM for the duration of the meeting.
- **Client Settings Only**: User preferences (`TeamProfile`, theme, language, export options, and manual "I knew this" overrides) are saved strictly in the user's browser `localStorage`.
- **Clear Everything**: When a user clicks "Clear everything" on the wrap-up screen, all in-memory arrays are wiped immediately.

---

## Getting Started

### Prerequisites
- Node.js 20+ (Node 24 tested)
- npm 10+
- Google Gemini API key (Free from [Google AI Studio](https://aistudio.google.com/))
- Deepgram API key (Optional for live audio, from [Deepgram Console](https://console.deepgram.com/))

### Installation & Setup

1. Clone or navigate to the repository:
```bash
git clone https://github.com/ibrahim123-sia/CallCopilot.git
cd CallCopilot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```
Edit `.env` and supply your `GEMINI_API_KEY` and `DEEPGRAM_API_KEY`.

4. Start the development server:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## How to Run Demo Mode (Zero Configuration)

1. Open `http://localhost:3000`.
2. On the **Ready Screen**, keep **Demo Mode** selected.
3. Check the privacy consent confirmation box.
4. Click **"Start Call Copilot"**.
5. Watch the dual-channel live transcript stream in real time. Insight cards will appear with the **"NEW TO TEAM"** amber tag on Anthropic's Model Context Protocol (MCP), accompanied by buying signals, consultative replies, and cross-questions.
6. Click **"End Call"** to inspect the editable meeting wrap-up, toggle the **Client-Facing vs Internal** audience switch, and download the vector PDF report.

---

## How to Run a Real Live Call (Google Meet, Zoom, Teams)

1. Join your meeting in a browser tab (e.g., Google Meet).
2. Open CallCopilot in another tab or side-by-side window.
3. Select **"Dual-Channel"** mode on the Ready Screen.
4. Click **"Start Call Copilot"**.
5. When the browser prompts you to choose what to share:
   - Select **"Chrome Tab"** (or Edge tab).
   - Select the tab running your Google Meet / Teams call.
   - **Crucial Tip:** Check the **"Share tab audio"** toggle at the bottom of the picker dialog.
6. Allow microphone access when prompted.
7. CallCopilot will now listen:
   - **Channel 0 (Your Mic):** Transcribed as **"Our Team"**.
   - **Channel 1 (Meeting Tab Audio):** Transcribed as **"Client"**.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Recommended | — | Google Gemini API key for live analysis, lookups, and meeting wrap-up |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model identifier (`gemini-2.5-flash`, `gemini-2.5-pro`) |
| `DEEPGRAM_API_KEY` | Optional | — | Deepgram API key for real-time live microphone & tab streaming |
| `DEEPGRAM_PROJECT_ID` | No | — | Optional project ID for minting short-lived temporary STT tokens |
| `RATE_LIMIT_PER_MINUTE`| No | `60` | In-memory sliding window rate limit per client IP |
| `MAX_TRANSCRIPT_BUFFER_CHARS` | No | `40000` | Maximum character limit for rolling transcript context buffer |

---

## API Specification

### `GET /api/stt-token`
Issues an ephemeral short-lived access token for browser-to-vendor Deepgram WebSocket connections.
- **Response (200 OK)**: `{ "token": "...", "expiresInSeconds": 600 }`
- **Error (503)**: When `DEEPGRAM_API_KEY` is not configured.

### `POST /api/analyze`
Analyzes recent client utterances against the team profile and call context using Google Gemini.
- **Request Body**:
```json
{
  "recentTranscript": "[12:00:01] Client: We need an MCP server for our CRM.",
  "rollingSummary": "",
  "teamProfile": {
    "companyName": "CallCopilot Team",
    "coreSkills": ["React", "Next.js", "Python", "AWS"],
    "industries": ["FinTech", "SaaS"],
    "excludedAreas": ["Hardware"],
    "knownTopics": []
  },
  "callContext": {
    "clientName": "Alex Rivers",
    "projectName": "CRM AI Assistant",
    "meetingGoal": "Discovery",
    "language": "auto"
  },
  "isDemo": false
}
```
- **Response (200 OK)**: Returns structured `topics[]` with `isNewToTeam`, `signals[]`, `suggestedReplies[]`, `crossQuestions[]`, and `redFlags[]`.

### `POST /api/lookup`
Performs an instant deep-dive lookup on any phrase or technology.
- **Request Body**: `{ "query": "Vector Search", "context": "CRM search", "teamSkills": ["Next.js"] }`
- **Response (200 OK)**: Returns explanation card, advantages, considerations, and suggested reply.

### `POST /api/summarize`
Generates a complete post-call wrap-up report from the full transcript and user notes.
- **Response (200 OK)**: Returns structured `outcome`, `executiveSummary`, `keyDiscussionPoints`, `clientRequirements`, `decisions`, `tasks` (with `isClientRequested` and `isSuggested`), `risksAndRedFlags`, and `followUpEmail`.

---

## Error Codes

| Status | Meaning | Solution |
|---|---|---|
| `400` | Invalid request payload or Zod validation failure | Check request JSON body structure |
| `429` | Rate limit exceeded | Wait a few seconds for the sliding rate window to reset |
| `502` | Upstream AI generation failure or unparseable JSON | Check Gemini API quota and network connectivity |
| `503` | API key not configured | Configure `GEMINI_API_KEY` or `DEEPGRAM_API_KEY` in `.env`, or use Demo Mode |

---

## Troubleshooting

- **"No tab audio detected from the shared tab"** — In Chrome or Edge, when selecting the browser tab running your call, make sure the checkbox labeled **"Share tab audio"** at the bottom-left of the browser modal is checked.
- **"Microphone access denied"** — Ensure your browser has permission to access your microphone in site settings (`chrome://settings/content/microphone`).
- **Urdu script formatting** — Urdu text automatically triggers right-to-left alignment (`dir="rtl"`) and uses the `Noto Naskh Arabic` font. In the exported PDF, complex cursive script shaping is handled natively by the browser vector print engine.
- **Missing API keys** — If you don't have keys handy, switch to **Demo Mode** on the Ready Screen. The entire pipeline will function offline with realistic data.

---

## Project Structure

```
CallCopilot/
├── app/
│   ├── layout.tsx              # Root HTML shell, fonts (Inter, Mono, Noto Naskh Arabic)
│   ├── page.tsx                # Main workspace: Ready screen, 3-pane live call, Wrap-up screen
│   ├── globals.css             # Tailwind tokens, dark/light themes, print vector CSS
│   └── api/
│       ├── stt-token/route.ts  # GET: Issues short-lived Deepgram token
│       ├── analyze/route.ts    # POST: Streaming analysis (Gemini + search grounding)
│       ├── lookup/route.ts     # POST: Quick instant topic lookup
│       └── summarize/route.ts  # POST: Post-call wrap-up, tasks, and email draft
├── components/
│   ├── TopBar.tsx              # Timer, listening status, talk-time meter, controls
│   ├── TranscriptPane.tsx      # Left pane: speaker labels, timestamps, auto-scroll, search
│   ├── InsightCardsPane.tsx    # Center pane: cards, NEW amber treatment, pins, overrides
│   ├── RepliesPane.tsx         # Right pane: quick lookup, intent, replies, questions, notes
│   ├── ReadyScreen.tsx         # Pre-call setup checklist, mode picker, consent notice
│   ├── WrapUpScreen.tsx        # Post-call wrap-up, audience switch, task manager, exports
│   ├── TeamProfileModal.tsx    # Team skills & excluded areas editor (localStorage)
│   └── ShortcutsModal.tsx      # Keyboard shortcuts cheat-sheet
├── lib/
│   ├── audio/                  # Audio capture, dual-channel mixer, volume meter
│   │   ├── capture.ts
│   │   └── types.ts
│   ├── transcription/          # Pluggable STT provider interface, Deepgram, Demo player
│   │   ├── types.ts
│   │   ├── deepgramProvider.ts
│   │   ├── demoProvider.ts
│   │   └── demoScript.ts
│   ├── analysis/               # Prompts, Zod schemas, context builder, trigger logic, JSON repair
│   │   ├── prompts.ts
│   │   ├── schemas.ts
│   │   ├── contextBuilder.ts
│   │   ├── triggerLogic.ts
│   │   ├── jsonRepair.ts
│   │   └── cannedData.ts
│   ├── pdf/                    # High-fidelity vector print template, Urdu RTL, PDF generator
│   │   ├── printTemplate.ts
│   │   └── pdfGenerator.ts
│   ├── state/                  # Browser localStorage persistence
│   │   └── storage.ts
│   ├── types.ts                # TypeScript domain models
│   ├── rateLimit.ts            # Sliding-window in-memory rate limiter
│   ├── env.ts                  # Validated server environment variables
│   └── export.ts               # Markdown, Plain Text, and Blob export utilities
├── tests/                      # Vitest test suite (27 tests, all mocked)
│   ├── schemas.test.ts
│   ├── triggerLogic.test.ts
│   ├── contextBuilder.test.ts
│   ├── rateLimit.test.ts
│   ├── jsonRepair.test.ts
│   ├── export.test.ts
│   └── demoPipeline.test.ts
├── .env.example                # Sample environment variables
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── LICENSE                     # MIT License
├── CONTRIBUTING.md             # Contributor guidelines
└── README.md
```

---

## Testing

Run the full automated test suite:

```bash
npm test
```

The test suite runs **27 unit and integration tests** covering:
- **Schema validation**: `AnalysisResultSchema`, `TopicCardSchema`, `MeetingWrapUpSchema`, and `TaskItemSchema`.
- **Anti-hallucination task rules**: Ensuring tasks are never fabricated and inferred tasks are flagged as `Suggested`.
- **Trigger & debounce controller**: Client utterance detection, 2-second silence debouncing, minimum intervals, and active `AbortController` cancellation.
- **Context builder**: Chronological transcript formatting, window partitioning, and character buffer capping.
- **Sliding-window rate limiter**: IP-isolated rate limiting and expiration.
- **Resilient JSON repair**: Fence stripping, trailing comma fixes, unclosed bracket/quote balancing.
- **Audience switch security**: Proving confidential internal risks, signals, and research items NEVER appear in `Client-Facing` exports.
- **PDF option logic**: Verifying that the word-for-word transcript is excluded unless explicitly checked.
- **Urdu complex script handling**: Verifying right-to-left layout and `Noto Naskh Arabic` styling for Urdu text.
- **Demo mode pipeline**: Verifying real-time dual-channel simulated playback and speaker separation.

All tests run completely offline with mocked services and zero API costs.

To check types and linting:
```bash
npm run typecheck
npm run lint
npm run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).