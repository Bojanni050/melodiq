# Sonara — User Guide
**Versie: do 05:34**

> AI Music Generation Web App

---

## What is Sonara

Sonara is a web app that lets you create music using AI providers. You describe your song in plain language, optionally generate lyrics and style prompts with AI, then produce audio tracks through connected music generation services.

---

## Quick Start

1. **Open the Studio** — the Create page is the main workspace
2. **Describe your song** — use the Style & Prompt textarea to describe genre, mood, instrumentation, tempo
3. **Set lyrics** — either write your own or use the AI lyrics generator (see below)
4. **Pick a provider** — choose from Lyria, PoYo (Suno), or Tempolor
5. **Give it a title** — required for instrumental tracks; auto-generated for vocal tracks if left empty
6. **Hit Generate** — the app sends everything to the chosen provider and saves the result

---

## Studio Form Sections

### Structure (top section)
Pick how your song should be arranged. Presets cover pop, dance/TCH, and singer-songwriter styles.
- **Kies jij maar** — let the AI decide the best structure
- **Handmatig** — write your own structure in plain text

### Lyrics
Toggle between **VOCAL** and **INSTRUMENTAL** mode.

**Vocal mode:**
- **Topic & Mood** — short description to guide the AI (e.g. "heartbreak, melancholic")
- **Lyrics textarea** — write lyrics manually or click **Generate Lyrics** to have AI write them based on your topic and style prompt
- Section labels in square brackets are expected: `[Verse]`, `[Chorus]`, `[Bridge]`

**Instrumental mode:**
- No lyrics needed. Focus on the style prompt and give the track a descriptive title.

### Style & Prompt
Describe the musical style — genre, mood, instrumentation, production aesthetic.
- **Generate Style** — click to have AI rewrite your rough description into an optimized, provider-ready prompt
- **Style pill tags** — quick-add common descriptors (FX Risers, Lo-Fi, Synthwave, etc.)

### Provider & Model
Select which AI music service to use. Each provider shows its current credit balance.
- **Lyria** (Google) — synchronous, fast turnaround
- **PoYo** (Suno) — asynchronous, webhook-based
- **Tempolor** — asynchronous, webhook-based

This selector now lives in the **Studio** card on the Create page.

### Language (Lyric Studio)
- **Language** — sets the language for AI-generated lyrics (English, Dutch, Spanish, etc.)
- **Other...** — lets you define a custom language or dialect

The language selector now lives on the **Lyric Studio** page.

### Lyric Studio
Use **Lyric Studio** to build lyrics as separate editable blocks before sending them to the main Studio.
- Add blocks such as Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro
- Use presets like Pop, ABABCB, AABA, Extended, and EDM/Dance structures to create a full structure quickly
- Generate one block at a time with the song topic, mood, language, style, and existing blocks as context
- Generate a complete song from the selected structure; each section is placed in its own block
- Reorder blocks with the up/down controls, duplicate blocks, edit labels and lyrics manually, or delete sections
- **Copy all lyrics** copies the finished block sequence
- **Use in Studio →** sends all filled blocks to the main Studio lyrics field

### Vocal Gender
- **Vocal Gender** — choose Female or Male vocals (only shown in vocal mode)

### Song Title
- **Instrumental tracks** — title is **required**
- **Vocal tracks** — if left empty, the AI will automatically extract a title from your lyrics when you generate. You can also click **Generate Title** to preview it beforehand

---

## Generating a Track

When you click **Generate Track**:
1. The app validates required fields (title for instrumental, lyrics + prompt for vocal)
2. If vocal and no title is set, AI auto-generates one from your lyrics
3. Your prompt, lyrics, and settings are sent to the selected provider
4. A new track appears in the **Recent Tracks** list
5. Status updates: `pending` → `generating` → `done` (or `failed`)

Lyria tracks complete in the same request. PoYo and Tempolor tracks may take longer — the app polls for status updates automatically.

---

## Recent Tracks & Library

- **Recent Tracks** — shown alongside the form on the Studio Create page. Click any track to open the detail panel.
- **Library page** — browse all your tracks from the separate Library page in the sidebar.

### Library Views
- **Songs view** — full track list with playlist filter chips (`All tracks` + each playlist)
- **Playlists view** — gallery-style playlist cards with cover art collage generated from songs inside each playlist
- Clicking a playlist card opens that playlist in Songs view

### Track Detail Panel
Click a track to open a slide-out panel with:
- Track info (provider, model, status, date)
- Full style prompt
- Full lyrics (if vocal)
- **Play** — stream the audio inline
- **Download** — save the MP3 file (HD version if available)

### Fullscreen Player
- Album art now stays visible in fullscreen playback, including autoplay/next-track transitions
- Fullscreen background now has a fuzzy ambient glow based on the current artwork
- Lyrics are rendered in a smaller font for better readability on dense/long songs

---

## Settings

The Settings page lets you configure each provider independently:
- API keys and connection testing per provider
- S3 storage configuration and connectivity check
- LLM Routing for separate prompt and lyrics providers
- Separate OpenRouter/OpenAI models for prompt generation and lyric generation
- OpenRouter image prompt model selection with pricing info

---

## Tips

- On desktop Studio Create page, **Generate Track** stays anchored at the bottom of the Studio column while the form content above it scrolls
