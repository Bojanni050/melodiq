# Sonara — AI Rules Document

> **For use in:** Visual Studio Code, Kilo Code, GitHub Copilot  
> **Project:** Sonara — AI Music Generation Web App  
> **Last updated:** 2026-05-16

---

## 🧠 Context & Memory

Bo uses a **three-layer system** of memory and documentation lookup across all AI-assisted workflows.

### Hindsight — Primary Personal Memory
- **What**: Cloud-based semantic memory via MCP (Vectorize.io)
- **Runs**: Docker container `hindsight` on `localhost:8888`
- **Data**: `C:\Users\Bo\.hindsight\pg0\`
- **Used for**: Personal context, project history, preferences, decisions across conversations
- **Bank name**: `Bojan`

### Stash — Structured Knowledge Store
- **What**: Self-hosted MCP memory layer (Docker + PostgreSQL + pgvector)
- **Runs**: Docker container `stash-stash-1` on `localhost:8080`
- **Used for**: Stable consolidated reference material — project specs, long-term reference

### Context7 — Live Library Documentation
- **What**: MCP tool for up-to-date library and framework documentation
- **Used for**: Checking current APIs, function signatures, config options before writing code
- **When to use**: Any time you work with Next.js, Drizzle, Zustand, Tailwind, AWS SDK, or any other dependency — look it up in Context7 first, don't rely on training data

### Behaviour rules for AI agents
- When Bo says "you should know this" or "we discussed this" — check Hindsight or Stash first
- Do **not** ask for information likely established in a prior session (tech stack, provider choices, decisions)
- If something seems inconsistent with established patterns, flag it — never silently override it
- Memory systems are Bo's own infrastructure — never suggest replacing or bypassing them
- Consult **Context7** before writing library-specific code or calling any external API

---

## 🗂 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6, strict mode |
| Styling | Tailwind CSS v4 |
| State management | Zustand 5 |
| ORM | Drizzle ORM |
| Database | PostgreSQL (via `postgres` driver) |
| Auth | JWT (jsonwebtoken) + httpOnly cookies |
| Storage | AWS S3 (via @aws-sdk/client-s3) |
| HTTP client | axios |
| LLM | OpenRouter (primary), OpenAI (fallback) |
| Music providers | Lyria (Google), PoYo, Tempolor |
| Package manager | npm |

---

## 📁 Project Structure

```
src/
  app/
    api/
      auth/
        login/route.ts
        register/route.ts
      generate/route.ts         # Main generation endpoint
      llm/route.ts              # Prompt optimize + lyrics generation
      tracks/
        route.ts                # GET all tracks for user
        [id]/route.ts           # GET single track + status polling
      webhooks/
        poyo/route.ts
        tempolor/route.ts
      credits/route.ts
      settings/
        route.ts                # GET/POST settings key-value
        test/route.ts           # Provider connection test
        s3/route.ts             # S3 config + HeadBucket test
    page.tsx                    # Main studio UI
    login/page.tsx
    register/page.tsx
    settings/page.tsx
  components/
    StudioForm.tsx
    Sidebar.tsx
    Player.tsx
  db/
    index.ts                    # Drizzle client
    schema.ts                   # All table definitions
  lib/
    auth.ts                     # generateToken / verifyToken
    logger.ts                   # Shared logApi function
    s3.ts                       # uploadToS3 / getPresignedUrl
    store.ts                    # Zustand stores
    providers/
      lyria.ts
      poyo.ts
      tempolor.ts
      llm.ts
middleware.ts
drizzle.config.ts
.env.local                      # Never commit — lives on VPS next to app
```

---

## 🗃 Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `email` | varchar(255) unique | not null |
| `password` | text | bcrypt hashed, cost 12 |
| `name` | varchar(255) | |
| `createdAt`, `updatedAt` | timestamps | |

### `tracks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid FK → users | |
| `title` | varchar(255) | |
| `provider` | varchar(50) | `"lyria"` \| `"poyo"` \| `"tempolor"` |
| `providerModel` | varchar(50) | |
| `prompt` | text | |
| `lyrics` | text | |
| `language` | varchar(50) | |
| `instrumental` | boolean | |
| `status` | varchar(20) | `"pending"` \| `"generating"` \| `"done"` \| `"failed"` |
| `audioUrl` | text | Internal path: `/api/tracks/{id}/download` |
| `audioUrlHd` | text | |
| `s3Key` | text | e.g. `tracks/{id}/audio.mp3` |
| `s3KeyHd` | text | |
| `duration` | integer | milliseconds |
| `jobId` | varchar(255) | External job ID from async providers |
| `creditsUsed` | integer | default 0 |
| `error` | text | |
| `createdAt`, `updatedAt` | timestamps | |

### `apiLogs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `userId` | uuid | nullable |
| `type` | varchar(50) | `"generation"` \| `"webhook"` \| `"llm"` |
| `provider` | varchar(50) | |
| `endpoint` | varchar(255) | |
| `request` | text | JSON |
| `response` | text | JSON |
| `statusCode` | integer | |
| `duration` | integer | ms |
| `createdAt` | timestamp | |

### `settings`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `key` | varchar(255) unique | |
| `value` | text | |

---

## 🔐 Auth Pattern

- JWT stored in httpOnly cookie named `token`
- Cookie: `secure` in production, `sameSite: lax`, `maxAge: 7 days`
- Every protected API route must manually read and verify the cookie:

```ts
const cookieStore = await cookies();
const token = cookieStore.get("token")?.value;
const decoded = verifyToken(token || "");
if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- `decoded.userId` is a UUID string
- Middleware handles **page-level redirects only** — it does NOT protect API routes
- **All API routes must do their own auth check — no exceptions**

---

## 🎵 Provider Architecture

### Lyria (synchronous)
- Calls external API → receives audio buffer directly
- Uploads buffer to S3 immediately
- Sets track status to `"done"` in the same request

### PoYo / Tempolor (asynchronous)
- Calls external API → receives a `jobId`
- Sets track status to `"generating"` with `jobId`
- Completion handled via webhook: `/api/webhooks/poyo` or `/api/webhooks/tempolor`
- Fallback polling available in `/api/tracks/[id]/route.ts`

### Webhook flow
1. Provider sends POST to webhook URL with `{ job_id, status, audio_url }`
2. Webhook looks up track by `jobId` + `provider`
3. If completed: download audio → upload to S3 → update track to `"done"`
4. If failed: update track to `"failed"` with error message

---

## 🤖 LLM Usage

- Two operations: `"optimize"` (style prompt for music AI) and `"lyrics"` (write song lyrics)
- Provider priority: OpenRouter → OpenAI
- **Emergent has been removed** — do not reintroduce it under any circumstance
- LLM logic lives in `src/lib/providers/llm.ts`
- Route `src/app/api/llm/route.ts` must call the lib — do not duplicate logic inline

---

## ☁️ S3 Storage

- Audio stored at key pattern: `tracks/{trackId}/audio.mp3` and `tracks/{trackId}/audio_hd.mp3`
- `audioUrl` stored in DB is an internal path: `/api/tracks/{id}/download`
- **Presigned URLs are generated on the fly** — never fetch them server-side and store in DB
- Never expose raw S3 URLs or S3 keys to the frontend

---

## 🔒 Security Rules — Always Enforce

**1. IDOR protection** — always filter by both `id` AND `userId`:
```ts
and(eq(tracks.id, id), eq(tracks.userId, decoded.userId))
```

**2. Webhook verification** — check secret header before processing any webhook:
```ts
const secret = request.headers.get("x-webhook-secret");
if (secret !== process.env.WEBHOOK_SECRET) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

**3. JWT_SECRET** — must throw if not set, never use a fallback:
```ts
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
```

**4. Input validation** — validate before DB insert:
- `prompt`: required, max 2000 chars
- `lyrics`: optional, max 10000 chars
- `title`: optional, max 255 chars

**5. Error handling** — never expose internal errors to the client:
```ts
catch (error) {
  console.error(error); // server-side log
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
```

---

## 📝 Logging

- Use the shared `logApi` from `src/lib/logger.ts` — **never define a local version**
- Logging gated by `process.env.ENABLE_API_LOGGING === "true"`
- Log all generation attempts, webhook events, and LLM calls

---

## 🌍 Environment Variables

```env
# Database
DATABASE_URL=

# Auth
JWT_SECRET=               # Required — no fallback, throws on missing
JWT_EXPIRES_IN=7d
WEBHOOK_SECRET=           # Shared secret for webhook auth

# Google Lyria 3
LYRIA_API_KEY=
LYRIA_MODEL=lyria-3

# PoYo (Suno)
POYO_API_KEY=
POYO_WEBHOOK_URL=         # Full public URL to /api/webhooks/poyo

# Tempolor
TEMPOLOR_API_KEY=
TEMPOLOR_WEBHOOK_URL=     # Full public URL to /api/webhooks/tempolor

# OpenRouter (primary LLM)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=

# OpenAI (fallback LLM)
OPENAI_API_KEY=
OPENAI_MODEL=

# S3 Storage
S3_ENDPOINT=
S3_REGION=auto
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=sonara-tracks

# App
NEXT_PUBLIC_APP_URL=
ENABLE_API_LOGGING=true
```

> All credentials must live in `.env.local` on the VPS — **never in the repository**

---

## 💻 Coding Conventions

- Use `async/await` — no raw `.then()` chains
- Import database client from `@/db` — never instantiate directly
- Import shared utilities from `@/lib/*` — never duplicate logic inline
- Track status updates always use Drizzle: `.update().set().where().returning()`
- TypeScript strict mode is on — no `any` unless absolutely necessary and commented
- Use `clsx` for conditional classnames
- **File names**: `kebab-case.ts` for lib files, Next.js convention for routes

---

## 🚫 What NOT To Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Use `localStorage` or `sessionStorage` | Use Zustand (with `skipHydration: true`) or server-side state |
| Add shadcn/ui | Use plain Tailwind — no component library |
| Add Prisma | Use Drizzle ORM only |
| Reference Emergent | It has been removed — do not reintroduce |
| Hardcode API keys or secrets | Use `.env.local` |
| Define `logApi` locally in route files | Import from `src/lib/logger.ts` |
| Fetch presigned URLs server-side and store in DB | Generate them on demand |
| Skip auth check on any API route | Always verify JWT before any protected operation |
| Use fallback values for `JWT_SECRET` | Throw if not set |
| Expose raw S3 URLs to frontend | Serve via `/api/tracks/{id}/download` |
| Install a new dependency without checking | Check if existing dep covers the need first |

---

## 🎼 Style Prompt Rules (LLM — `"optimize"`)

- No artist names — ever
- Comma-separated tags only
- Include BPM as a numeric tag when provided
- Include key/scale when provided
- No exaggerated descriptors (`"epic"`, `"powerful"`, `"massive"`)
- Where appropriate: include dry vocal descriptors (`dry vocals`, `close-mic`, `upfront vocal`, `no room sound`, `tight mix`, `minimal ambience`)
- No lyrics, section labels, or structural markers in the style prompt
- Production-oriented, precise language only
- Single unified prompt format — same rules for Lyria, PoYo, Tempolor, Suno, and MiniMax

---

## 📝 Lyrics Rules (LLM — `"lyrics"`)

- Write in the language specified by the app — do not switch unless explicitly mixed-language
- Follow the song structure exactly as provided — do not alter or reinterpret it
- Always include section labels in square brackets, e.g. `[Verse - sparse close-mic]`, `[Chorus - restrained delivery, layered harmonies]`
- Vocal/delivery instructions always go inside the section title brackets — never in the lyrics body
- All text inside square brackets must be in **English** regardless of the main lyric language
- Avoid exaggerated emotional descriptors (`emotional`, `epic`, `powerful`) — favor controlled, nuanced direction
- Write with vivid imagery, emotional specificity, and poetic freedom
- Avoid literal or generic phrasing — prioritize natural, grammatically correct language
- Song structure and language are set via the Sonara UI — **do not ask the user for them**

---

## 📋 Walkthrough Format

After every significant change, append to `walkthrough.md` (oldest → newest):

```markdown
## YYYY-MM-DD (Short title)

- Findings: [What was the problem or trigger?]
- Conclusions: [Why this approach?]
- Actions: [Which files changed and what exactly?]; validated.
```

- Always run `npm run build` to validate before marking a task complete
- Update `sonara-user.md` when user-facing functionality changes
- Never install a new dependency without checking if an existing one covers the need

---

## 🚀 Deployment

- **VPS**: Strato VPS with Plesk as reverse proxy (SSL via Let's Encrypt)
- **Container setup**: Docker Compose — Next.js app (standalone output) + PostgreSQL 16 alpine
- **Port**: App runs on port 3000; Plesk forwards traffic via nginx `proxy_pass`
- **DB migrations**: `docker compose exec app npx drizzle-kit push`
- **Env file**: `.env.local` on the VPS next to the app, never in the repository

---

## ⚠️ Open Issues / Known Risks

| Issue | Risk | Status |
|---|---|---|
| Registration is open | Anyone can create an account | Consider closing for private use |
| Rate limiting | Missing on `/api/generate` | Add in-memory rate limit (5 req/min per userId) |
| `gpt-5` in `.env.example` as default OpenRouter model | Model likely unavailable | Update to a valid model |
| MiniMax webhook route | Listed in settings UI but `/api/webhooks/minimax` may not exist | Verify or create route |

---

*This document was auto-generated from the Sonara project knowledge base. Keep it in sync with `walkthrough.md` and `sonara-user.md`.*