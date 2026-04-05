# Annotate

### Paste a URL. Get annotated tutorial images. No Canva needed.

> **"What if turning any webpage into annotated social media images took 10 seconds instead of 30 minutes in Canva?"**

Built for the **Scrapes.ai x Hostinger Hackathon 2026** · Live at **[annotate.felaniam.cloud](https://annotate.felaniam.cloud)**

---

## The Problem

Creators, educators, and marketers constantly find web content worth sharing — a product launch, a tutorial walkthrough, an interesting landing page. But turning that into visual social content means:

- Screenshotting the page and cropping manually
- Opening Canva/Figma to place highlights and callouts
- Drawing arrows, writing labels, picking colors by hand
- Exporting and resizing for every platform
- Repeating the whole process for each social network

**A 2-minute discovery becomes a 30-minute design task.** Most people just share a link and move on.

---

## The Solution

**Annotate** eliminates the design step entirely. Give it a URL, pick your platforms, and it delivers annotated tutorial images — with intelligent highlights, arrows, callouts, and a cohesive color scheme — rendered and ready to post.

No templates. No drag-and-drop. No design decisions. Claude Vision *sees* the page, *understands* what matters, and *annotates* it for you.

```
URL  →  Screenshot  →  AI Analysis  →  SVG Annotations  →  Rendered PNG  →  Download & Post
```

---

## Features

- **3 Instagram Formats** — IG Landscape (3:4), IG Feed (4:5), IG Stories (9:16) — each with a dedicated n8n pipeline tuned for its aspect ratio
- **Per-Format Intelligence** — Each format gets its own viewport-matched screenshot and Claude Vision analysis, producing annotations optimized for that specific aspect ratio
- **Parallel Fan-Out** — All selected formats render simultaneously via `Promise.all` — 3 formats take the same wall-clock time as 1
- **Ratio Deduplication** — Platforms sharing a ratio (IG Stories / TikTok / Snapchat) render once, not three times
- **User-Guided Focus** — Tell it what to highlight: *"Focus on the pricing table"* or *"Annotate the signup flow"*
- **Percentage-Based Coordinates** — Annotations scale naturally to any aspect ratio without re-running the AI
- **Image Upload Support** — Don't have a URL? Drop in a screenshot directly
- **Batch Download** — One click to grab every generated image
- **Dark Minimal UI** — Clean interface, no clutter

---

## Demo

| Step | What Happens |
|------|-------------|
| **1. Paste** | Drop any URL into the input field |
| **2. Select** | Check the platforms you want (Instagram, LinkedIn, X, etc.) |
| **3. Guide** *(optional)* | Add a prompt to steer what Claude focuses on |
| **4. Generate** | Hit go — results appear in ~10 seconds |
| **5. Download** | Grab individual images or batch download all |

**Try it live:** [annotate.felaniam.cloud](https://annotate.felaniam.cloud)

<p align="center">
  <img src="assets/demo-desktop.png" alt="Annotate Desktop UI" width="720" />
</p>

<details>
<summary>Mobile view</summary>
<p align="center">
  <img src="assets/demo-mobile.png" alt="Annotate Mobile UI" width="320" />
</p>
</details>

---

## How It Works

Annotate uses a **parallel fan-out** architecture — the Express server dispatches one request per format to dedicated n8n workflows that each handle the full pipeline independently:

```
                              ┌─▶  n8n (3:4)  ─▶  Screenshot(360×480) → Claude Vision → Browserless → PNG
┌──────────┐     ┌─────────┐ │
│  Browser  │────▶│ Express │─┼─▶  n8n (4:5)  ─▶  Screenshot(360×450) → Claude Vision → Browserless → PNG
│           │     │ (proxy) │ │
└──────────┘     └─────────┘ └─▶  n8n (9:16) ─▶  Screenshot(360×640) → Claude Vision → Browserless → PNG
```

Each format gets a **viewport-matched screenshot** (sized to its aspect ratio), its own **Claude Vision analysis**, and a dedicated **Browserless render**. This produces better annotations than a shared plan because each screenshot captures the page at the proportions that format will display. All formats run in parallel via `Promise.all`.

---

## Tech Stack

| Technology | Role | Why This |
|-----------|------|----------|
| **Node.js + Express** | Server & API proxy | Minimal, fast, handles the single `/api/annotate` endpoint |
| **Claude Sonnet** | Vision analysis + annotation planning | Best-in-class vision understanding — sees UI elements, not just pixels |
| **ScreenshotOne** | Page capture | HMAC-signed requests, viewport screenshots |
| **Browserless** | HTML → PNG rendering | Self-hosted headless Chrome — renders SVG overlays onto screenshots at exact pixel dimensions |
| **n8n** | Workflow orchestration | Three parallel workflows (one per format) — each: screenshot → analysis → rendering (6 nodes each) |
| **Coolify** | Deployment platform | One-click Docker deploys on Hostinger VPS — the entire stack self-hosted |

**Dependencies:** `express`

---

## Getting Started

### Prerequisites

- Node.js 18+
- Running [n8n](https://n8n.io) instance with the Annotate workflow
- [Browserless](https://browserless.io) instance (self-hosted or cloud)
- [ScreenshotOne](https://screenshotone.com) API credentials
- [Anthropic](https://anthropic.com) API key (configured in n8n)

### Local Setup

```bash
# Clone
git clone https://github.com/txmyer-dev/annotate.git
cd annotate

# Install
npm install

# Configure
export N8N_BASE=https://your-n8n-instance/webhook

# Run
npm start
```

App runs on `http://localhost:3100`

### Docker

```bash
docker build -t annotate .
docker run -p 3100:3100 \
  -e N8N_BASE=https://your-n8n/webhook \
  annotate
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3100` | Server port |
| `N8N_BASE` | `https://n8n.felaniam.cloud/webhook` | Base URL for n8n webhooks (per-format paths appended automatically) |

---

## Known Limitations

- **Authenticated pages not supported.** Pages behind login walls can't be captured. An auth feature was prototyped (Browserless Puppeteer login automation) but shelved due to environment-specific fragility. The core approach is sound — see [auth notes](#authenticated-page-support-shelved) below.
- **Long pages may produce large screenshots.** Content-heavy pages can generate oversized images. Landing pages and short-form content work best.

---

## Architecture

```
annotate/
├── server.js           # Express server — fans out to per-format n8n webhooks
├── public/
│   └── index.html      # Single-page frontend (dark minimal UI)
├── assets/
│   ├── demo-desktop.png
│   └── demo-mobile.png
├── Dockerfile          # Alpine Node container
├── docker-compose.yaml # Full stack compose with Traefik labels
└── package.json
```

**Cost per generation:** ~$0.03 per format (one Claude Sonnet vision call each). 3 IG formats = ~$0.09 total. Each format gets its own tailored analysis.

---

## Authenticated Page Support (Shelved)

An authenticated page capture feature was prototyped and reverted. The approach — Browserless Puppeteer login automation with credentials isolated from the LLM — worked end-to-end but hit too many environment-specific issues (Browserless v2 sandbox limitations, n8n expression engine quirks, template literal escaping in Code nodes) to stabilize within the hackathon timeline.

The core architecture is sound: credentials flow through Express → n8n → Browserless only, never reaching Claude Vision. A future implementation should isolate auth capture as a separate n8n workflow to avoid destabilizing the main pipeline.

---

## License

MIT

---

<p align="center">
  Built with frustration toward Canva and respect for Claude's vision capabilities.<br/>
  <strong>Scrapes.ai x Hostinger Hackathon 2026</strong>
</p>
