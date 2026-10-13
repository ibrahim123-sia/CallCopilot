# CallCopilot - Architecture, Data Flow, Risks & Assumptions Plan

## 1. System Overview
**CallCopilot** is a stateless, live client-call assistant built with **Next.js (App Router), TypeScript (strict), Tailwind CSS**, Node 20+, Google Gemini (`@google/genai`), and Deepgram streaming STT. It operates entirely in-memory during a call, storing only user preferences in the browser's `localStorage`.

```
+-----------------------------------------------------------------------------------+
| Browser (Client)                                                                  |
|                                                                                   |
|  +--------------------+   +---------------------+   +--------------------------+  |
|  | Mic (Channel 0:    |   | Tab Audio (Chan 1:  |   | Demo Mode Script Player  |  |
|  | Our Team)          |   | Client)             |   | (Simulated dual-channel) |  |
|  +---------+----------+   +----------+----------+   +------------+-------------+  |
|            |                         |                           |                |
|            +------------+------------+                           |                |
|                         |                                        |                |
|                 [AudioContext & Worklet]                         |                |
|                 (2-Channel Stereo PCM16)                         |                |
|                         |                                        |                |
|                         v                                        v                |
|             +---------------------------------------------------------+           |
|             | TranscriptionProvider Interface                         |           |
|             |  - DeepgramTranscriptionProvider (Direct wss streaming) |           |
|             |  - DemoTranscriptionProvider (Stateless offline stream) |           |
|             +----------------------------+----------------------------+           |
|                                          |                                        |
|                               Live Transcript & Utterances                        |
|                                          |                                        |
|                                          v                                        |
|                          +-------------------------------+                        |
|                          | Analysis Trigger & Controller |                        |
|                          | - Endpoint / 2s Debounce      |                        |
|                          | - Rolling Context Management  |                        |
|                          | - Single-in-flight with Abort |                        |
|                          +---------------+---------------+                        |
+------------------------------------------|----------------------------------------+
                                           | Fetch / Stream
                                           v
+-----------------------------------------------------------------------------------+
| Next.js Server (Stateless Backend)                                               |
|                                                                                   |
|   GET  /api/stt-token  --> Issues short-lived Deepgram API token                  |
|   POST /api/analyze    --> Calls Gemini (@google/genai) with Search Grounding     |
|   POST /api/lookup     --> Quick topic lookup (Gemini + Zod schema)               |
|   POST /api/summarize  --> Meeting Wrap-up, Outcomes, Tasks, Email, Zod Validated |
|                                                                                   |
|   * Zero persistence (no DB, no disk, no transcript logging)                      |
|   * Per-IP memory rate limiter                                                    |
|   * Canned demo fallback when GEMINI_API_KEY is not provided                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Core Modules & Data Flow

### A. Dual-Channel Audio Capture
- **Channel 0**: Microphone (`getUserMedia({ audio: true })`) -> Speaker: `Our Team`.
- **Channel 1**: Browser Tab audio (`getDisplayMedia({ video: true, audio: true })`) -> Speaker: `Client`.
- Combined via `AudioContext.createChannelMerger(2)`.
- If tab audio is missing (user forgot to check "Share tab audio"), detected immediately by checking `stream.getAudioTracks().length === 0` and surfacing a friendly setup guide.
- Mic-only mode available if tab sharing is not desired.

### B. Transcription Pipeline
- Abstracted by `TranscriptionProvider`:
  - `connect(options: ProviderOptions): Promise<void>`
  - `sendAudio(pcmChunk: Int16Array): void`
  - `onTranscript(handler: (entry: TranscriptEntry) => void)`
  - `disconnect(): void`
- **Deepgram Provider**: Browser requests short-lived token via `/api/stt-token`, then connects directly to Deepgram WebSocket with `multichannel=true&interim_results=true&endpointing=300`.
- **Demo Mode Provider**: Replays a realistic multi-turn enterprise call (client asking for CRM MCP server, vector search, budget concerns, tech trade-offs) with simulated dual-channel timestamps.

### C. Analysis Engine & Trigger Logic
- **Trigger**: Client utterance finalized + debounced (2000ms silence).
- **Rate Limit & Concurrency**:
  - Enforce minimum interval between AI calls (5000ms).
  - Single in-flight request managed by `AbortController`. Newer client input supersedes pending analyses.
- **Context Builder**:
  - Last 4 minutes of chronological transcript.
  - Rolling summary of older transcript chunks.
  - User's Team Profile (strengths, non-focus areas) and active Call Context.
- **Gemini Engine**: Server-side `@google/genai` with structured JSON schema enforced via Zod. Google Search grounding enabled when supported.
- Fallback canned engine for zero-configuration demo testing without API keys.

### D. "NEW to Team" Highlighting
- Team Profile stored in browser `localStorage`.
- Topics identified by the model as outside the team's skillset or emerging technologies have `isNewToTeam: true`.
- Rendered with exclusive warm-amber visual treatment (`border-amber-500`, amber tag) and collected into a dedicated "New to us" tray.
- Interactive user overrides: "I knew this" vs "This is new to me", preserved in `localStorage`.

### E. Meeting Wrap-up & Reporting
- Single structured wrap-up call (`/api/summarize`):
  - Meeting outcome (agreed status, next steps, dates).
  - Executive summary and categorized discussion points.
  - Client requirements (explicit budget/timeline constraints).
  - Decisions and open questions.
  - Structured Action Items / Tasks (tagged `Requested by client` or `Suggested`, with owner, priority, due date, quote justification).
  - Internal risks, red flags, and "New to us" research list.
  - Cleaned user scratchpad notes.
  - Follow-up email draft with tone selector.
- **Audience Switch**: `Client-facing` (suppresses red flags, internal signals, new-to-us research) vs `Internal` (includes all strategy data).
- **PDF Export**:
  - Clean vector typesetting with cover block, outcome highlight, tasks table, page numbers, and optional transcript appendix (off by default).
  - Support for right-to-left complex script (Urdu) with proper shaping and embedded font styles.
  - Live preview & section toggles.

---

## 3. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Tab audio capture browser restrictions | User cannot capture Google Meet/Teams audio on unsupported browsers | Detect browser and audio track presence; provide clear visual checklist and mic-only fallback. |
| Urdu script shaping in PDF generation | Broken/disjointed Arabic letters or LTR text | Use print-optimized HTML vector styling with `@media print`, CSS `direction: rtl`, `font-family: 'Noto Naskh Arabic'`, verified via automated test. |
| Gemini API quota or invalid JSON output | Dropped insight cards during live call | Defensive JSON fence-stripping, Zod parsing with retry, and graceful failure without blocking call. |
| In-memory data loss on accidental reload | Loss of live call notes and wrap-up | `beforeunload` warning during active call; prompt user before wiping data. |
| Deepgram / Gemini key absence during testing | Inability to run/demo the application | Built-in offline Demo mode with canned analysis pipeline works 100% without keys. |

---

## 4. Key Assumptions
1. **Client Audio Separation**: Dual-channel mixing (channel 0 = mic, channel 1 = tab) provides deterministic speaker separation on modern desktop browsers (Chrome, Edge).
2. **Stateless Compliance**: No customer audio, transcript, or client data is ever saved to disk or database. Server operates purely as an ephemeral proxy.
3. **Environment**: Primary development on Node 20+, Windows PowerShell. All scripts and paths are platform-agnostic.
