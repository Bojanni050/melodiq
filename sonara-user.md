# Sonara — User Guide
**Versie: wo 15:17**

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
- Generated lyrics output is strict format: section tags + lyric lines only (no intro text, notes, or extra commentary)

**Instrumental mode:**
- No lyrics needed. Focus on the style prompt and give the track a descriptive title.

### Style & Prompt
Describe the musical style — genre, mood, instrumentation, production aesthetic.
- **Generate Style** — click to have AI rewrite your rough description into an optimized, provider-ready prompt
- **Style pill tags** — quick-add common descriptors (FX Risers, Lo-Fi, Synthwave, etc.)

### Provider & Model
Select which AI music service to use. Each provider shows its current credit balance.
- **Lyria** (Google) — synchronous, fast turnaround
- **PoYo** (Suno) — asynchronous, webhook-based; generated variants request their own HD/WAV conversion
- **Tempolor** — asynchronous, webhook-based
- **MusicGPT** — asynchronous, webhook-based, returns two generated variants

This selector now lives in the **Studio** card on the Create page.

### Language (Lyric Studio)
- **Language** — sets the language for AI-generated lyrics (English, Dutch, Spanish, etc.)
- **Other...** — lets you define a custom language or dialect

The language selector now lives on the **Lyric Studio** page.

### Lyric Studio
Use **Lyric Studio** to build lyrics as separate editable blocks before sending them to the main Studio.
- Add blocks such as Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro
- Reorder blocks by dragging the card or drag handle on both desktop and touch screens; the up/down buttons stay available as fallback
- Use presets like Pop, ABABCB, AABA, Extended, and EDM/Dance structures to create a full structure quickly
- **Repetitive chorus** (default ON) in Song Structure: when enabled, AI writes one chorus and repeats it; when disabled, AI generates chorus variations
- **Creativity** slider (1-10) adjusts LLM temperature from 0.1 to 1.2 with zones: low (1-3), medium (4-7), high (8-10)
- **Context (Top-P)** slider (1-10) adjusts Top-P from 0.1 to 1.0 and is sent with each lyric generation prompt
- Generate one block at a time with the song topic, mood, language, style, and existing blocks as context
- Generate a complete song from the selected structure; each section is placed in its own block
- While full-song generation is running, use **Stop generating** to cancel remaining AI block generation
- Save your current Lyric Studio setup as a named snapshot and load it later from **Load saved lyrics**
- Delete old snapshots directly from the load dialog to keep only useful drafts
- On each Chorus block, use **Unique (do not auto-repeat)** to force a fresh chorus even when Repetitive chorus is enabled
- Reorder blocks with the up/down controls, duplicate blocks, edit labels and lyrics manually, or delete sections
- Drag blocks directly with the grip handle on both desktop and touch screens to reorder them faster
- Drag blocks over the list to jump over multiple positions in one move; you do not need to stop on every neighboring block
- Voeg nu ook markerblokken toe zonder lyricsinhoud: `[intrumental]` en `[instrumetal drop]`
- Deze twee markerblokken zijn expliciet leeg (geen lyric-generatie, geen vertaling), maar worden wel als sectietag meegenomen in de gecombineerde lyrics
- In Song Metadata staat nu een Title veld met een **Generate title** knop die op basis van je huidige lyrics een AI-titel maakt
- **Copy all lyrics** copies the finished block sequence
- In the collapsible **Volledige lyrics** sidebar, a dedicated **Copy** button now copies the full combined lyrics directly
- **Use in Studio →** sends all filled blocks to the main Studio lyrics field
- **Style Suggestion (AI Fill)** now returns a more elaborate style direction with concrete guidance for genre/feel, instrumentation, production/mix, and vocal direction
- Confirmaties, foutmeldingen en snapshot-opslag gebruiken in-app dialogs/notificaties in plaats van browser popups

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

Lyria tracks complete in the same request. PoYo, Tempolor, and MusicGPT tracks may take longer; the app polls for status updates automatically and also processes provider webhooks when results arrive.

For MusicGPT, lyrics are limited to 3000 characters. If you exceed this, generation is blocked and the app shows a notification.

---

## Recent Tracks & Library

- **Recent Tracks** — shown in the lower half of the right Studio column. Click any track to open the detail panel.
- **Workspace Tracks** — shown in the upper half of the right Studio column for the currently selected workspace, with breadcrumb navigation (`Workspaces / {selected workspace}`). Workspace selection in Studio now uses the same folder cards (gradient + cover collage) as the dedicated Workspaces page.
- All track lists now include sorting controls: **New to old** and **Old to new**.
- All track lists now include a **Search tracks** bar to filter by title, prompt, provider, model, or lyrics.
- In all track lists except **Recent Tracks**, you can now drag and drop tracks to change the play order used when auto queueing tracks.
- **Library page** — browse all your tracks from the separate Library page in the sidebar.

### Library Views
- **Songs view** — full track list with playlist filter chips (`All tracks` + each playlist)
- In Library Songs view, use **Select MP3/WAV Files** to upload one or meerdere audiofiles tegelijk; Sonara ondersteunt batch-upload van MP3 en WAV
- Library upload ondersteunt maximaal 20 bestanden per keer; bij een te grote upload toont Sonara nu een duidelijke foutmelding in plaats van een technische JSON-parse fout
- De workspace-dropdown in Library upload wordt nu gevuld na persist-hydratie zodat je direct alle bestaande (sub)workspaces ziet
- Voor upload kies je eerst de doelworkspace in de workspace dropdown; alle succesvol geuploade tracks worden direct aan die workspace toegewezen
- Geuploade tracks tonen nu een duidelijke **Uploaded** badge in de tracklijst en **Uploaded file** label in Track Details
- Sonara berekent nu per upload een unieke audio-hash (SHA-256) en blokkeert dubbele uploads van exact hetzelfde audiobestand
- Sonara houdt nu per track bij hoe vaak je die afspeelt; een play telt pas mee na 10 seconden actieve playback, en het aantal plays staat onder de trackbeschrijving in de lijst
- Nieuwe tracks zonder plays tonen een gele glow-dot naast de titel; zodra de track afspeelt verdwijnt deze indicator automatisch
- Track acties bevatten nu **Regenerate Cover Art** om direct nieuwe cover art voor een song te laten maken
- In Library Songs view, selecting a track now opens a right-side detail panel on desktop (resizable) and an overlay panel on mobile
- **Playlists view** — gallery-style playlist cards with cover art collage generated from songs inside each playlist
- Clicking a playlist card opens that playlist in Songs view
- If you add a song to a playlist where it already exists, Sonara now asks: “Song is already on the playlist. Do you want to add it again?” with **Yes / No**

### Workspaces
- **Workspaces** live in the sidebar and open a dedicated page with folder-style cards
- The dedicated **Workspaces** page now uses the same layout and interaction model as the Library workspace section (same card/list views, create flow, and open behavior)
- Workspace cards keep a persistent gradient folder color and a seeded collage of cover art from the songs inside
- Studio now uses the same folder-card interaction (including create flow and active selection state) to choose which workspace is pinned in the Workspace Tracks panel
- Sonara now has a built-in **Default Workspace** that cannot be deleted
- All tracks that are not assigned to another workspace are automatically placed in **Default Workspace**
- New generated songs are assigned to **Default Workspace** when no specific workspace is selected
- If another workspace is currently open/selected in Studio, newly generated songs are assigned to that selected workspace
- In Studio, workspace cards now have a user grid setting with quick options **4 / 8 / 12 / 16** (saved locally per browser) as the exact number of folders per row
- In Library Workspaces en op de dedicated Workspaces-pagina kun je in grid mode nu ook **4 / 8 / 12 / 16** kiezen (wordt lokaal opgeslagen)
- The Studio workspace selector now keeps all folders visible and forces the selected row count exactly
- Clicking a workspace card in Studio now opens that folder view, hides the other workspace cards, and shows only tracks from that folder
- In folder view, use the **Back to folders** button or click the **Workspaces** breadcrumb to return to the overview grid
- If a workspace has exactly one cover image, the card now centers that cover instead of placing it in a corner of a 2x2 collage
- Workspace folder cards in Studio are now fully clickable across the full card surface
- The selected workspace section on the Workspaces page now uses the same playable **TrackList** component as other pages
- Moving a track to a workspace from **Recent Tracks** now immediately opens/focuses that target workspace in Studio
- If multiple tracks are selected in a track list, **Move To Workspace** applies to all selected tracks (tracks already in that workspace are skipped silently)
- Moving a track to a workspace that already contains it is now silently skipped (no duplicate assignment)
- Track listings now show which workspace each track belongs to
- Track actions include **Move To Workspace** so songs can be filed into workspace folders from the track menu
- **Move To Workspace** now opens a large overlay dialog with a scrollable workspace list, per-workspace clip counts, and an inline create field/button at the bottom
- Workspaces ondersteunen nu subfolders tot 1 niveau diep: **hoofdfolder -> tracks + subfolder -> tracks**
- In de Workspaces-pagina zie je in het overzicht alleen hoofdfolders; open een hoofdfolder om subfolders te zien en daar direct een subfolder toe te voegen
- In Studio kun je nu ook direct in een geopende hoofdfolder een subfolder aanmaken via **+ Add Subfolder**; in subfolders verschijnt deze optie bewust niet
- In **Move To Workspace** worden hoofdfolders en subfolders hiërarchisch weergegeven zodat je tracks direct naar de juiste subfolder kunt verplaatsen
- In de Workspaces-pagina opent een klik op een folder nu een aparte folderpagina (`/workspaces/{id}`) met alleen die tracklisting in beeld
- Op die folderpagina staat een **Back to folders** knop om terug te gaan naar het folderoverzicht

### Track Detail Panel
Click a track to open a slide-out panel with:
- Track info (provider, model, status, date)
- Full style prompt, collapsed by default; click Prompt to expand it
- Full lyrics (if vocal)
- **Play** — stream the audio inline
- **Download** — save the MP3 file (HD version if available)

### Fullscreen Player
- Album art now stays visible in fullscreen playback, including autoplay/next-track transitions
- Fullscreen background now has a fuzzy ambient glow based on the current artwork
- Lyrics are rendered in a smaller font for better readability on dense/long songs
- Playback blijft actief bij navigatie naar andere pagina's zoals Lyric Studio

---

## Settings

The Settings page lets you configure each provider independently:
- API keys and connection testing per provider
- S3 storage configuration and connectivity check
- LLM Routing for separate prompt and lyrics providers
- Separate OpenRouter/OpenAI models for prompt generation and lyric generation
- OpenRouter image prompt model selection with pricing info
- MusicGPT recovery can now retry both stuck `generating` tracks and already-failed MusicGPT tracks from the same recovery button

---

## Logs

- The Logs page now shows each API call as a collapsed item by default.
- Click a log row to expand details for that specific call.
- Expanded view shows both **Input** (request payload) and **Output** (response payload).
- Click the same row again to collapse it.

---

## Tips

- On desktop Studio Create page, **Generate Track** stays anchored at the bottom of the Studio column while the form content above it scrolls
- Als de Studio-kolom lang is, kun je door de velden scrollen terwijl de generate-sectie onderaan zichtbaar blijft, net boven de player
