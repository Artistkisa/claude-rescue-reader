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
2. Click **"📂 Select Export Folder"** and choose the unzipped folder
3. Wait for loading to complete (a few seconds for large files; ~3–5s for 150MB)

> **Note:** An internet connection is required to load rendering dependencies (from jsDelivr CDN). For offline use, see [Offline Mode](#offline-mode) below.

## Features

### Conversation List
- Sort by last updated / created / message count
- Search by title and summary; enable **Full-text search** to search message content
- ↑ / ↓ or J / K keyboard navigation

### Message Rendering
- Full Markdown rendering (headings, tables, code blocks, blockquotes, etc.)
- Code blocks with language labels + one-click copy button
- 💭 **Thinking blocks** collapsible
- ⚙ **Tool calls** and results collapsible
- Supports attachments, image placeholders, web links, search citations, and more

### Projects
- View project documents (Markdown rendered, collapsible)
- Three-layer heuristic to associate conversations: file path match → knowledge search query match → keyword fuzzy match
- **Note:** Claude's official export does not include project-conversation ownership data; associations are inferred and may have gaps or false positives

### Memories
- Global memories displayed in 4 sections (work / personal / highlights / history)
- Per-project memories displayed in 6 standard sections, collapsible

### Other
- 🌙 / ☀️ Light/dark theme toggle, preference saved automatically
- ⬇ **Export:** Export current conversation as a Markdown file (Ctrl/Cmd+E)
- Export includes summary, full message stream, and thinking blocks (wrapped in `<details>`)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ↑ / K    | Previous conversation |
| ↓ / J    | Next conversation |
| Ctrl+E   | Export current conversation as Markdown |

## Offline Mode

To use without an internet connection, place these files in the same directory as `viewer.html` and update the import paths accordingly:

```
marked.min.js          ← https://cdn.jsdelivr.net/npm/marked/marked.min.js
highlight.min.js       ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js
github.min.css         ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css
github-dark.min.css    ← https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css
```

## Privacy

- ✅ Runs entirely locally — no backend, no analytics, no network requests (CDN excepted)
- ✅ Your data is never uploaded or shared
- ✅ Nothing persists after closing the browser, except theme preference (`localStorage` only stores `cv-theme`)
- ⚠️ The exported JSON files contain your complete conversation history — store them carefully

## Known Limitations

- Export files do not contain image binary data; images are shown as placeholders
- Branching conversation trees are displayed as the longest path (consistent with claude.ai's behavior)
- Project-conversation associations are inferred, not official data — expect some gaps and mismatches
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

- Pure vanilla HTML + CSS + JavaScript — no build step, no framework dependencies
- [marked.js](https://marked.js.org/) — Markdown rendering
- [highlight.js](https://highlightjs.org/) — Code syntax highlighting

## Changelog

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
