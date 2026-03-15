# Better Chat UI

Secure, Locally stored, bring-your-own-key (BYOK) chat workspace with an opinionated UI that focuses on usability.

## Why this exists

Most mainstream chat interfaces are great for quick prompts, but weak for power users who need:

- stable multi-provider workflows
- explicit settings control per provider/model
- branchable thinking directly from highlighted text
- predictable UX for long outputs and streaming
- a reading mode for focused reading sessions, that doesnt block half the screen (claude.ai is really bad at this)

This project focuses on those gaps with a local-first UX and no backend lock-in.

## Core Features

- BYOK support for OpenAI, Anthropic, and Gemini
- Provider-native streaming (SSE) with retry/timeout safeguards
- Threaded workspace with persistence across reloads
- Branch dialog chat from text selections (`+ Create New Branch Here`)
- Branching context workflow: turn any highlighted passage into a focused side conversation without losing your main thread
- Global system prompt in Settings
- Markdown rendering with sanitization
- Reading mode profiles that can hide top bar, sidebar, composer, and user messages for distraction-free review

## Why branching and reading mode matter

- **Branching is required** when you need to explore alternatives without derailing the primary conversation.
- **Selection-based branching** keeps source context explicit, so branch reasoning is anchored to the exact text that triggered it.
- **Reading mode is required** for long outputs where UI chrome competes with comprehension.
- **Full layout reduction** (hiding non-essential UI surfaces) creates a focused reading session similar to a clean document view, while keeping chat state intact.

## Where common chat UIs fall short


- hidden model/config behavior that changes output unpredictably
- limited branching and poor context traceability
- weak multi-provider parity for experimentation
- output truncation/streaming inconsistencies in long sessions

Better Chat UI is designed to make these tradeoffs explicit and controllable.

## Screenshots

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
