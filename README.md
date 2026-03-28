# Annotate

**Paste a URL. Get annotated tutorial images. No Canva needed.**

Annotate takes any URL, screenshots it, uses Claude Vision to identify the most important elements, and renders annotated tutorial images with highlights, arrows, and callouts — ready to post on social media.

Built for the **Scrapes.ai x Hostinger Hackathon 2026**.

**Live at [annotate.felaniam.cloud](https://annotate.felaniam.cloud)**

---

## How It Works

```
URL → ScreenshotOne API → Claude Vision Analysis → SVG Overlay → Browserless PNG Render
```

1. **Screenshot** — ScreenshotOne captures a viewport screenshot (HMAC-signed requests)
2. **Metadata** — Parallel HTML fetch extracts title, description, headings, OG image
3. **Claude Vision** — Sends screenshot + metadata to Claude Sonnet. Claude returns a structured JSON annotation plan: highlights, arrows, callouts, color scheme, sections — all in percentage-based coordinates
4. **Render** — Builds an HTML page with the screenshot as background and SVG annotations overlaid. Browserless (headless Chromium) renders it to a final PNG
5. **Serve** — Node.js frontend displays the result with download buttons

## Key Design Decision: Separate Annotation from Rendering

Annotation is the expensive, creative step — it requires Claude Vision to understand the page and decide what to highlight. Rendering is mechanical — it just composites an SVG overlay onto a screenshot at specific pixel dimensions.

By separating these concerns:

- **Claude runs once per URL**, regardless of how many output formats you need
- The same annotation plan (percentage-based coordinates) scales naturally to any aspect ratio
- 1 format or 8 formats = same ~$0.03 Claude API cost
- Rendering N formats only adds a few seconds of Browserless compute, not N expensive vision API calls

This means selecting Instagram Feed + Facebook + LinkedIn + X/Twitter generates **one** annotation plan and renders it four ways — same highlights, same arrows, same callouts, just resized. You get consistent visual identity across platforms without paying 4x.

## Features

- **8 social platforms** — Instagram Feed (4:5), Instagram Stories (9:16), Facebook (1:1), LinkedIn (1.91:1), X/Twitter (16:9), TikTok (9:16), Snapchat (9:16), Pinterest (2:3)
- **Multi-select** — Check multiple platforms, generates all from a single annotation pass
- **User prompt** — Guide what Claude focuses on: "Highlight the pricing section" or "Focus on the signup flow"
- **Ratio deduplication** — Platforms sharing a ratio (IG Stories/TikTok/Snapchat) render once
- **Download All** — Batch download every generated image
- **Dark UI** — Clean, minimal interface

## Architecture

```
[Browser] → [Node.js Express Server] → [n8n Webhook Pipeline]
                                              ├── ScreenshotOne API (screenshot)
                                              ├── HTML fetch (metadata)
                                              ├── Claude Vision API (annotations)
                                              └── Browserless (HTML → PNG per format)
```

| Component | Role | Hosting |
|-----------|------|---------|
| Frontend + Proxy | Express server, static HTML | Coolify on Hostinger VPS |
| n8n Workflow | Orchestration pipeline (9 nodes) | Coolify on Hostinger VPS |
| Browserless | Headless Chromium for HTML→PNG | Docker on Hostinger VPS |
| ScreenshotOne | External screenshot API | SaaS |
| Claude Vision | AI annotation analysis | Anthropic API |

## Stack

- **n8n** — Workflow automation (webhook → pipeline → response)
- **Claude Sonnet** — Vision analysis and annotation planning
- **ScreenshotOne** — Signed screenshot capture
- **Browserless** — Self-hosted headless Chrome for HTML→PNG rendering
- **Node.js / Express** — Frontend proxy server
- **Hostinger VPS** — All infrastructure via Coolify

## Running Locally

```bash
npm install
N8N_WEBHOOK=https://your-n8n-instance/webhook/annotate npm start
```

The app runs on port 3100. You'll need a running n8n instance with the Annotate workflow configured.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `N8N_WEBHOOK` | `https://n8n.felaniam.cloud/webhook/annotate` | n8n webhook URL |

## Docker

```bash
docker build -t annotate .
docker run -p 3100:3100 -e N8N_WEBHOOK=https://your-n8n/webhook/annotate annotate
```

## Future Work: Authenticated Page Support

### Status: Shelved (2026-03-27)

We attempted to add support for screenshotting pages behind authentication (SaaS dashboards, admin panels). The feature was partially implemented but proved too fragile for the hackathon timeline. It's documented here for future reference.

### What Was Built

- **Frontend**: "Login Required?" toggle with two modes — Credentials (username/password) and Cookies (JSON paste). Collapsible auth section with advanced CSS selector overrides.
- **Express proxy**: Passes `auth` field through to n8n webhook. Credential-safe logging (redacts passwords from error messages).
- **n8n workflow**: "Has Auth?" IF node routing to "Auth Screenshot" Code node that calls Browserless `/function` with a dynamically-built Puppeteer script for login automation.

### Architecture (Credentials Never Touch the LLM)

```
Browser → Express (TLS) → n8n → Browserless (Docker network)
                                       │
                                  login + screenshot
                                       │
                                  screenshot only (image)
                                       │
                              n8n → Claude Vision (NO credentials)
```

### What Worked

- Auth routing (Has Auth? IF node) — after fixing n8n expression engine issues with optional chaining and strict type validation
- Browserless login automation — form fill, submit button detection with text-based fallback (`/sign.?in|log.?in/`), cookie injection mode
- Screenshot capture of authenticated pages — Claude Vision correctly analyzed auth-gated content
- Full pipeline completion — annotations generated accurately from authenticated page screenshots

### What Failed

The implementation hit a cascade of environment-specific issues:

1. **Browserless v2 sandbox**: No `Buffer` global — `screenshot.toString('base64')` fails. Fix: use `page.screenshot({ encoding: 'base64' })`.
2. **n8n expression engine**: Optional chaining (`$json.body?.auth?.mode`) resolves to objects instead of string values with `strict` type validation. Fix: ternary with `String()` cast + `loose` validation.
3. **n8n MCP updates**: Workflow updates via MCP API sometimes silently failed to apply code changes. Required repeated verification cycles.
4. **Template literal escaping**: Dynamically-built Puppeteer scripts using JS template literals broke in the Code node. Fix: string concatenation with `JSON.stringify()` for value interpolation.
5. **Browserless `/screenshot` rendering**: `setContent` with large inline base64 images (~400KB) defaults to `waitUntil: "networkidle0"`, which never fires for data URIs. This caused the screenshot background to render as black/empty. Fix: `gotoOptions: { waitUntil: "load" }` — but applying this fix destabilized other parts of the pipeline.

### Files Changed (reverted)

- `server.js` — auth passthrough + logging guard (3 lines)
- `public/index.html` — auth UI section (~250 lines CSS/HTML/JS)
- n8n workflow `qQKlp8rg5E7GVRXR` — 2 added nodes (Has Auth?, Auth Screenshot)

### Resuming This Work

The core approach is sound. Key prerequisites for a stable implementation:

1. **Isolate the Browserless render fix** (`waitUntil: "load"`) and verify it doesn't break existing non-auth rendering
2. **Build the Auth Screenshot as a separate n8n workflow** to avoid destabilizing the main pipeline during iteration
3. **Add execution error visibility** — the n8n MCP tool doesn't expose node-level error details, making debugging extremely slow
4. **Test with real credentials end-to-end** before merging into the main workflow

## License

MIT
