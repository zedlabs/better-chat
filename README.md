# Better Chat UI

Frontend-only, bring-your-own-key (BYOK) chat workspace for people who want control, speed, and clean conversation structure.

## Why this exists

Most mainstream chat interfaces are great for quick prompts, but weak for power users who need:

- stable multi-provider workflows
- explicit settings control per provider/model
- branchable thinking directly from highlighted text
- predictable UX for long outputs and streaming

This project focuses on those gaps with a local-first UX and no backend lock-in.

## Core Features

- BYOK support for OpenAI, Anthropic, and Gemini
- Provider-native streaming (SSE) with retry/timeout safeguards
- Threaded workspace with persistence across reloads
- Branch dialog chat from text selections (`+ Create New Branch Here`)
- Global system prompt in Settings
- Markdown rendering with sanitization
- Assistant metadata footer (model + one-click copy)

## Where common chat UIs fall short

Not a dunk, just practical pain points teams repeatedly hit:

- hidden model/config behavior that changes output unpredictably
- limited branching and poor context traceability
- weak multi-provider parity for experimentation
- output truncation/streaming inconsistencies in long sessions

Better Chat UI is designed to make these tradeoffs explicit and controllable.

## Screenshots (placeholders)

- `docs/images/main-chat.png` - Main conversation workspace
- `docs/images/settings-panel.png` - Provider settings + global system prompt
- `docs/images/branch-dialog.png` - Branch chat dialog from highlighted text
- `docs/images/reading-mode.png` - Reading mode variants

## Local Development

```bash
npm install
npm run dev
```

Open the Vite URL (typically `http://localhost:5173`).

## Scripts

- `npm run dev` - start local dev server
- `npm run test -- --run` - run tests once
- `npm run build` - type-check and production build
