[中文](README.md) | [English](README.en.md)

# Claude Export History Viewer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single File](https://img.shields.io/badge/single%20file-HTML-orange.svg)](viewer.html)
[![Offline](https://img.shields.io/badge/runs-offline-brightgreen.svg)](#)
[![No Build](https://img.shields.io/badge/no%20build-zero%20dependencies-blue.svg)](#)
[![GitHub stars](https://img.shields.io/github/stars/Artistkisa/claude-rescue-reader?style=social)](https://github.com/Artistkisa/claude-rescue-reader/stargazers)

> Hello,
>
> An internal investigation of suspicious signals associated with your account indicates a violation of our Usage Policy. As a result, we have revoked your access to Claude.
>
> To appeal our decision, log in to claude.ai with this account and you'll be taken to the appeals page.
>
> Regards,
> Anthropic's Safeguards Team

So your account is gone, but the conversations aren't. This tool lets you read them.

**All data is processed locally. Nothing is uploaded to any server.**

---

## Why You Need This

Claude's export file looks like this:

```json
[{"uuid": "3f8a1c2d-e947-4b6f-9d3e-72a5b8c1f0e4", "name": "Technical Research Notes", "summary": "**Conversation Overview**\n\nThis conversation focused entirely on technical research...", "chat_messages": [{"uuid":"01a2b3c4-d5e6-7f8a-9b0c-d1e2f3a4b5c6", "text":"...", "content": [{"start_timestamp":"2024-11-08T09:23:14.882341Z","stop_timestamp":"2024-11-08T09:23:17.103Z","flags":null,"type":"thinking","thinking":"Let me analyze the user's request..."}, {"type":"text","text":"...actual response...","citations":[]}], "sender":"assistant", "parent_message_uuid":"00000000-0000-4000-8000-000000000000", ...}]}]
```

150MB. One line. No newlines. All non-ASCII characters Unicode-escaped. Thinking blocks and actual responses mixed in the same `content` array. Conversation trees linked by `parent_message_uuid`. Project docs are a separate pile of JSON files. Memories are Markdown strings embedded inside JSON strings.

**What happens when you open it in a text editor:**

> **SHOW MORE (150MB)**
> Rendering paused for long line for performance reasons.
> This can be configured via `editor.stopRenderingLineAfter`.

VS Code gives up and refuses to render the rest. One line. 150MB. It silenced the editor.

This tool turns it into a readable conversation interface.

## Use Cases

- 🔒 Rescue conversation history after an account ban via Claude's official export
- 📦 Browse and review your Claude conversation archive
- 🔍 Search and export specific conversations

## Quick Start

### Step 1: Export Your Claude Data

After a ban, logging in redirects you to [claude.ai/restricted](https://claude.ai/restricted). There's a button on the page:

> **Export your data**
> We'll package up your conversations, projects, and settings for download. This might take some time to complete.

Click it, wait for the email, download, unzip. That's it — at least they made the export process humane.

<details>
<summary>The official FAQ is also worth a read (click to expand)</summary>

**Q: Why was my account put on hold?**
> We put your account on hold because of unusual activity. We can't share the specifics—that would help bad actors get around the same checks.

Translation: We won't tell you why we banned you, because telling you would help bad actors. Whether you're actually a bad actor is a separate question.

**Q: How long will the review take?**
> Reviews take about 10 days.

Ten days. Good luck finding a replacement in that time — you probably won't.

**Q: Will my billing be affected?**
> We cancelled your subscription and refunded your most recent payment in full.

This part they actually handled well.

**Q: What if I think this is a mistake?**
> Request a review and our team will look over your account. The more specific you are about what you were working on, the better.

So you need to explain to Anthropic what you were using Claude for, so they can decide if you're a bad actor. Hopefully your worldbuilding, debugging sessions, or casual conversations are self-evidently innocent.

</details>

The export folder structure:

```
claude-export/
├── conversations.json   # All conversations (with full messages)
├── users.json           # Account info
├── memories.json        # Claude's memories (global + per-project)
└── projects/
    └── <uuid>.json      # Project documents
```

### Step 2: Open the Viewer

1. Download [`viewer.html`](viewer.html) and open it directly in a browser (Chrome / Edge / Firefox recommended)
2. Load your data either way:
   - Click **"🗜️ Select ZIP Archive"** and pick the ZIP from the email (**no unzipping needed**)
   - Or click **"📂 Select Export Folder"** and choose the manually unzipped folder
3. Wait for loading to complete (a few seconds for large files; ~3–5s for 150MB)

> **Note:** An internet connection is required to load rendering dependencies (from jsDelivr CDN). For offline use, see [Offline Mode](#offline-mode) below.

## Features

### Conversation List
- Sort by last updated / created / message count
- Search by title and summary; enable **Full-text search** to search message content
- Search within a conversation, highlight matches, and navigate between results
- ↑ / ↓ or J / K keyboard navigation

### Message Rendering
- Full Markdown rendering (headings, tables, code blocks, blockquotes, etc.)
- Code blocks with language labels + one-click copy button
- 💭 **Thinking blocks** collapsible
- ⚙ **Tool calls** and results collapsible
- Switch between conversation branches created by edits or regenerated responses
- Render rich content including artifacts, Mermaid diagrams, generated files, web search panels, attachments, and citations
- Copy an individual message as plain text

### Projects
- View project documents (Markdown rendered, collapsible)
- High-confidence conversation association: unique file evidence → project knowledge search → project-unique keywords
- Project-match explanations show matched memories, files, keywords, and confidence
- Manually correct project assignments; confirmations stay only in local browser storage and never modify the source export
- Project-level search, statistics, Markdown export, and a project memory → document → conversation reference graph
- **Note:** Claude's official export does not include project-conversation ownership data. Duplicate filenames, ties, and low-confidence results remain unassigned instead of being forced into a project

### Memories
- Global memories displayed in 4 sections (work / personal / highlights / history)
- Per-project memories displayed in 6 standard sections, collapsible

### Analytics
- Analytics starts in the persistent Data Worker only after opening the **Analytics** tab; normal reading performs no analytics scan
- Summarizes conversations, messages, roles, characters, thinking blocks, tool calls, attachments, and web searches
- Shows monthly/weekday/hourly activity, conversation depth, message and character distribution by role, content-block composition, model information (when present in the export), and longest conversations
- Builds Chinese/English frequent-word clouds inside the Worker and summarizes searches, files, artifacts, and thinking blocks
- Adds history-health metrics for active-day streaks, response latency, conversation span, branches/alternatives, and empty messages
- Analytics, word frequency, full-text indexing, and project matching reuse the raw records already owned by the Worker; the main thread no longer reserializes every message, and no content is uploaded

### Large-export performance
- `conversations.json` is read in 4 MiB chunks and transferred to a persistent Data Worker with Transferable `ArrayBuffer`s
- Initial import scans only the top-level array and returns titles, timestamps, summaries, and message counts; full messages are parsed only when a conversation is opened
- Parsed records are cached locally in IndexedDB behind a source-size, modification-time, and edge-content fingerprint; changed sources cannot reuse stale cache entries
- The cache never leaves the current browser and can be removed at any time with **Clear local parse cache** in the sidebar
- Syntax highlighting, Mermaid, Artifact iframes, and ZIP parsing load only when their feature or viewport requires them, keeping the initial conversation list responsive

### Other
- 🌙 / ☀️ Light/dark theme toggle, preference saved automatically
- ⬇ **Export:** Export the current conversation as Markdown (Ctrl/Cmd+E) or PDF
- PDF reuses the reader's complete message rendering, preserving code, Artifacts, thinking/tool panels, and branch-integrity warnings
- Artifacts can be exported as PNG; computed styles are inlined for SVG, Mermaid, and static HTML, with automatic source fallback on failure
- Claude Design exports are detected and classified separately without mixing them into regular conversations or analytics
- Floating controls provide quick jumps to the top or bottom of the conversation

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ↑ / K    | Previous conversation |
| ↓ / J    | Next conversation |
| Ctrl+E   | Export current conversation as Markdown |

## Offline Mode

Download `claude-rescue-reader-offline.zip` from GitHub Releases, extract it, and open its `viewer.html`. Keep the `vendor/` folder beside `viewer.html`; the Markdown, ZIP, syntax-highlighting, and Mermaid dependencies are bundled and require no network access.

The regular `viewer.html` remains a convenient single-file build for connected environments or basic viewing. External resources hard-coded by historical Artifacts are not viewer dependencies and may still be unavailable offline.

To build an offline copy manually, place these files beside `viewer.html` and update the import paths:

```
marked.min.js          ← https://cdn.jsdelivr.net/npm/marked/marked.min.js
highlight.min.js       ← https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js
jszip.min.js           ← https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js
mermaid.min.js         ← https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js
github.min.css         ← https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css
github-dark.min.css    ← https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css
```

## Privacy

- ✅ Runs entirely locally — no backend, no telemetry, no network requests (CDN excepted)
- ✅ Your data is never uploaded or shared
- ✅ Nothing persists after closing the browser except theme and UI-language preferences (`localStorage` stores only `cv-theme` / `cv-lang`)
- ⚠️ The exported JSON files contain your complete conversation history — store them carefully

## Known Limitations

- Export files do not contain image binary data; images are shown as placeholders
- Interactive HTML Artifacts that depend on scripts or dynamically drawn Canvas content may export only their static structure as PNG; the original source remains available through the automatic fallback
- Conversation trees show the longest path by default; branches created by edits or regeneration can be switched beside the affected message
- Project-conversation associations are high-confidence inferences, not official data; low-confidence conversations remain unassigned to avoid false matches
- Very large datasets (tested with: 300+ conversations / 150MB+ / single conversation with 600+ messages) may load slowly on low-memory devices
- If an account has no projects or no memories, the corresponding tab is hidden automatically — no error is shown

## Data Structure

This tool parses the Claude export format (as of 2026):

| File | Contents |
|------|----------|
| `conversations.json` | All conversations with full message trees, `content` blocks (text/thinking/tool_use/tool_result), and attachments |
| `memories.json` | Global memories + per-project memories, in Markdown format, organized by section |
| `projects/<uuid>.json` | Project metadata + document content |

**Note:** Claude's official export does not include a field indicating which project a conversation belongs to. This tool infers that relationship using a three-layer heuristic — see the Projects section for details.

## Tech Stack

- Pure vanilla HTML + CSS + JavaScript; the release remains a directly openable single file with no framework dependencies
- [marked.js](https://marked.js.org/) — Markdown rendering
- [highlight.js](https://highlightjs.org/) — Code syntax highlighting
- [JSZip](https://stuk.github.io/jszip/) — Direct ZIP archive loading (no unzipping)

The maintainable persistent data pipeline and compatibility analytics Worker sources live in `src/data-worker.js` and `src/analytics-worker.js`. After editing either file, run `scripts/build-single-file.ps1` to embed it back into `viewer.html`; regular users do not need the build script.

## Changelog

**v1.3** *(2026-07-29)*
- Added Claude Behavior Lab with tool-call auditing, hidden-result probing, Thinking integrity, and answer evidence-chain reporting
- Reused the persistent Data Worker for large-history parsing, full-text search, analytics, project matching, and behavior analysis to reduce main-thread copies and stalls
- Added project-association explanations, local manual corrections, project search/analytics/export, and a memory-reference graph
- Added a ready-to-use offline distribution containing pinned Markdown, ZIP, syntax-highlighting, and Mermaid dependencies
- Published both the regular single-file viewer and offline ZIP with SHA-256 checksums

**v1.2** *(2026-07-28)*
- Added direct ZIP loading and drag-and-drop input, including wrapper folders, loose JSON files, and macOS `__MACOSX` entries
- Added conversation branch switching, in-conversation search navigation, and plain-text copying for individual messages
- Added rich rendering for artifacts, Mermaid diagrams, generated-file cards, and web search results
- Fixed missing orphan messages, artifact theme rendering, SVG external-resource handling, and iframe sandboxing
- Fixed syntax highlighting under `file://` and made raw Markdown HTML handling safe
- Added progressive message rendering, deferred rich-content rendering, and page caching to reduce blocking on large histories
- Moved project relationship indexing to deferred batches with failure recovery and stale-generation protection
- Made project inference precision-first using unique file evidence, project knowledge, and project-unique keywords while rejecting ties and low-confidence matches

**v1.1** *(2026-07-17)*
- **Fix: Wrong message count** (e.g. showing 3 messages when there are actually 7)
  Root cause: conversation tree traversal always picked the last child node, which could dead-end on an empty message branch. Fixed by recursively selecting the **longest path**, with a tiebreaker that prefers branches with actual content.
- **Fix: Some messages showing as "(empty message)"**
  Claude's export `files` array sometimes has an empty string for `file_name`. Now falls back to `file_type` → `file_uuid` to ensure attachment bubbles always display something.
- **Fix: Code blocks displaying `[object Object]`**
  marked.js v5+ changed the `renderer.code` signature from `(code, lang)` to passing a token object. `String(code)` therefore became `[object Object]`. Now handles both signatures.
- **Fix: Clicking a conversation does nothing**
  The `forEach(el => ...)` callback parameter `el` shadowed an outer variable of the same name, causing `el.dataset.convUuid` to read from the container element (which has no such attribute). Renamed the callback parameter to `item`.
- **Fix: "Oldest" sort produces nearly the same result as "Newest"**
  "Oldest" was mistakenly using descending order (`b - a`). Fixed to ascending (`a - b`).
- Added full-text search, sort buttons, stats panel, Markdown export, keyboard navigation
- Added dark/light theme with full color variable coverage (thinking blocks, tool call blocks, etc.)
- Added mobile responsive layout (≤640px sidebar moves to top)
- Project conversation association replaced with three-layer heuristic: file path → PKS query match → keyword fuzzy match

**v1.0** *(2026-07-16)*
- Initial release: load Claude export folder, render conversation list and message content

## License

MIT
