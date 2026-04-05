# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Annotate turns a URL (or uploaded image) into annotated tutorial images for social media. The frontend collects a URL + platform selections + optional prompt, sends it to a Node.js proxy, which fans out requests in parallel to per-format n8n workflows — each handling its own screenshotting, Claude Vision analysis, and Browserless rendering at the correct aspect ratio.

## Commands

```bash
npm install          # Install dependencies (only express)
npm start            # Run server on port 3100
npm run dev           # Same as npm start (no hot reload)
```

Docker:
```bash
docker compose up --build
```

No tests, no linter, no build step. The app is a single Express server serving static files.

## Architecture

```
public/index.html  →  server.js  ──┬──▶  n8n workflow (3:4)  →  [ScreenshotOne + Claude Vision + Browserless]
     (SPA)          (Express proxy) ├──▶  n8n workflow (4:5)  →  [ScreenshotOne + Claude Vision + Browserless]
                    (fan-out)       └──▶  n8n workflow (9:16) →  [ScreenshotOne + Claude Vision + Browserless]
```

- **`server.js`** — Express server with one API endpoint (`POST /api/annotate`) and a health check. Fans out requests in parallel to per-format n8n webhooks (`/annotate-3-4`, `/annotate-4-5`, `/annotate-9-16`). Collects results via `Promise.all`. Handles both URL and base64 image uploads. No auth, no sessions, no database.
- **`public/index.html`** — Single-file SPA (HTML + CSS + JS, no framework). Contains all UI logic: platform selection grid, URL/image toggle, drag-and-drop upload, logo upload, lightbox viewer, download functionality. ~1200 lines.
- **n8n workflows** (external) — Three separate workflows, one per aspect ratio. Each independently orchestrates: ScreenshotOne API (viewport sized for the format) → HTML metadata fetch → Claude Vision analysis → Browserless HTML→PNG rendering. Workflows are named `Annotate — IG Landscape (3:4)`, `Annotate — IG Feed (4:5)`, `Annotate — IG Stories (9:16)`.

## Key Concepts

- **Per-format pipelines**: Each aspect ratio has its own n8n workflow with a viewport-matched screenshot, independent Claude Vision analysis, and dedicated render. This produces better annotations than a shared plan because each format's screenshot captures the page at the right proportions.
- **Parallel fan-out**: The Express server fires all format requests simultaneously via `Promise.all`, so 3 formats take the same wall-clock time as 1.
- **Ratio deduplication**: The frontend deduplicates platforms sharing an aspect ratio (e.g., IG Stories/TikTok/Snapchat all use 9:16) so n8n only runs once per unique ratio.
- **3 active format workflows**: 3:4 (IG Landscape, viewport 360x480), 4:5 (IG Feed, viewport 360x450), 9:16 (IG Stories, viewport 360x640). The frontend lists 12 platforms but only these 3 ratios have n8n workflows — other ratios will return errors until workflows are added.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `N8N_BASE` | `https://n8n.felaniam.cloud/webhook` | Base URL for n8n webhooks (format-specific paths are appended: `/annotate-3-4`, `/annotate-4-5`, `/annotate-9-16`) |

## Deployment

Deployed via Coolify on Hostinger VPS. Docker Compose includes Traefik labels for HTTPS routing at `annotate.felaniam.cloud`. The app connects to the `coolify` Docker network.

## Shelved Feature: Authenticated Pages

Auth support (login automation via Browserless Puppeteer) was attempted and reverted. See README.md "Future Work" section for the full post-mortem. The revert commit is `f1aff3e`.
