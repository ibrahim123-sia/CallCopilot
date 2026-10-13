# Contributing to CallCopilot

Thank you for your interest in contributing to CallCopilot!

## Development Guidelines

1. **Strict TypeScript & Zero Lints**: All code must pass `npm run typecheck` and `npm run lint` without errors or warnings.
2. **Stateless Guarantee**: Never introduce server-side file, database, or disk persistence for audio, transcripts, or call data. Everything lives ephemerally in browser memory during a call.
3. **Dual-Channel Audio Separation**: Channel 0 must remain reserved for Microphone (Our Team) and Channel 1 for Shared Tab Audio (Client).
4. **Visual Hierarchy**: Amber (`#f59e0b` / `newAmber`) is strictly reserved for "NEW to team" topic tags and borders. Do not use amber or gradients for general styling.
5. **Testing**: Add unit tests in `tests/` for any new logic, parsing utilities, or export generators. Run `npm test` before submitting changes.
