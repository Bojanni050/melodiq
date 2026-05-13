# Sonara — Kilo Code Rules

## Project Overview

Sonara is an AI music generation web app. Users log in, describe a song idea, optionally generate lyrics via LLM, and submit to one of multiple music generation providers. Async providers (PoYo, Tempolor) complete via webhooks; synchronous providers (Lyria) return audio directly.

---

## Tech Stack

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

## Project Structure

```
src/
  app/
    api/
      auth/
        login/route.ts
        register/route.ts
      generate/route.ts       # Main generation endpoint
      llm/route.ts            # Prompt optimize + lyrics generation
      tracks/
        route.ts              # GET all tracks for user
        [id]/route.ts         # GET single track + status polling
      webhooks/
        poyo/route.ts
        tempolor/route.ts
      credits/route.ts
    page.tsx                  # Main studio UI
    login/page.tsx
    register/page.tsx
  components/
    StudioForm.tsx
  db/
    index.ts                  # Drizzle client
    schema.ts                 # All table definitions
  lib/
    auth.ts                   # generateToken / verifyToken
    logger.ts                 # Shared logApi function
    s3.ts                     # uploadToS3 / getPresignedUrl
    providers/
      lyria.ts
      poyo.ts
      tempolor.ts
      llm.ts
middleware.ts
drizzle.config.ts
```

---

## Database Schema

### users
- `id` uuid PK
- `email` varchar(255) unique not null
- `password` text (bcrypt hashed, cost 12)
- `name` varchar(255)
- `createdAt`, `updatedAt` timestamps

### tracks
- `id` uuid PK
- `userId` uuid FK → users
- `title` varchar(255)
- `provider` varchar(50) — values: `"lyria"` | `"poyo"` | `"tempolor"`
- `providerModel` varchar(50)
- `prompt` text
- `lyrics` text
- `language` varchar(50)
- `instrumental` boolean
- `status` varchar(20) — values: `"pending"` | `"generating"` | `"done"` | `"failed"`
- `audioUrl` text — internal download path `/api/tracks/{id}/download`
- `audioUrlHd` text
- `s3Key` text — e.g. `tracks/{id}/audio.mp3`
- `s3KeyHd` text
- `duration` integer (ms)
- `jobId` varchar(255) — external job ID from provider
- `creditsUsed` integer default 0
- `error` text
- `createdAt`, `updatedAt` timestamps

### apiLogs
- `id` uuid PK
- `userId` uuid (nullable)
- `type` varchar(50) — `"generation"` | `"webhook"` | `"llm"`
- `provider` varchar(50)
- `endpoint` varchar(255)
- `request` text (JSON)
- `response` text (JSON)
- `statusCode` integer
- `duration` integer (ms)
- `createdAt` timestamp

### settings
- `id` uuid PK
- `key` varchar(255) unique
- `value` text

---

## Auth Pattern

- JWT stored in httpOnly cookie named `token`
- Cookie: `secure` in production, `sameSite: lax`, `maxAge: 7 days`
- Every protected API route reads and verifies the cookie manually:

```ts
const cookieStore = await cookies();
const token = cookieStore.get("token")?.value;
const decoded = verifyToken(token || "");
if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- `decoded.userId` is a UUID string
- Middleware handles page-level redirects but does NOT protect API routes
- **All API routes must do their own auth check**

---

## Provider Architecture

### Lyria (synchronous)
- Calls external API, receives audio buffer directly
- Uploads buffer to S3 immediately
- Sets track status to `"done"` in the same request

### PoYo / Tempolor (asynchronous)
- Calls external API, receives a `jobId`
- Sets track status to `"generating"` with `jobId`
- Completion handled via webhook: `/api/webhooks/poyo` or `/api/webhooks/tempolor`
- Fallback polling available in `/api/tracks/[id]/route.ts`

### Webhook flow
1. Provider sends POST to webhook URL with `{ job_id, status, audio_url }`
2. Webhook looks up track by `jobId` + `provider`
3. If completed: download audio → upload to S3 → update track to `"done"`
4. If failed: update track to `"failed"` with error message

---

## LLM Usage

- Two operations: `"optimize"` (rewrite prompt for music AI) and `"lyrics"` (write song lyrics)
- Provider priority: OpenRouter → OpenAI
- **Emergent has been removed** — do not reintroduce it
- LLM logic lives in `src/lib/providers/llm.ts`
- Route `src/app/api/llm/route.ts` should call the lib, not duplicate logic

---

## S3 Storage

- Audio stored at key pattern: `tracks/{trackId}/audio.mp3` and `tracks/{trackId}/audio_hd.mp3`
- `audioUrl` stored in DB is an internal path: `/api/tracks/{id}/download`
- Presigned URLs generated on the fly when serving track data
- Never expose S3 keys or raw S3 URLs to the frontend

---

## Security Rules

**Always enforce these — never skip:**

1. **IDOR protection**: when fetching a track by ID, always filter by both `id` AND `userId`:
   ```ts
   and(eq(tracks.id, id), eq(tracks.userId, decoded.userId))
   ```

2. **Webhook verification**: check `x-webhook-secret` header against `process.env.WEBHOOK_SECRET` before processing any webhook

3. **JWT_SECRET**: must throw if not set — never use a fallback value in production code:
   ```ts
   if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
   ```

4. **Input validation**: validate all user inputs before DB insert:
   - `prompt`: required, max 2000 chars
   - `lyrics`: optional, max 10000 chars
   - `title`: optional, max 255 chars

5. **Never expose internal errors**: catch blocks should return generic messages to the client, log details server-side

---

## Logging

- Use the shared `logApi` from `src/lib/logger.ts` — never define a local version
- Logging is gated by `process.env.ENABLE_API_LOGGING === "true"`
- Log all generation attempts, webhook events, and LLM calls

---

## Environment Variables

```
DATABASE_URL=
JWT_SECRET=               # Required — no fallback
JWT_EXPIRES_IN=7d
TEMPOLOR_API_KEY=
TEMPOLOR_WEBHOOK_URL=     # Full public URL to /api/webhooks/tempolor
POYO_API_KEY=
POYO_WEBHOOK_URL=         # Full public URL to /api/webhooks/poyo
LYRIA_API_KEY=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
OPENROUTER_API_KEY=       # Primary LLM
OPENROUTER_MODEL=
OPENAI_API_KEY=           # Fallback LLM
OPENAI_MODEL=
WEBHOOK_SECRET=           # Shared secret for webhook auth
ENABLE_API_LOGGING=true
NEXT_PUBLIC_APP_URL=
```

---

## Coding Conventions

- Use `async/await` — no raw `.then()` chains
- Import database client from `@/db` — never instantiate directly
- Import shared utilities from `@/lib/*` — never duplicate logic inline
- Track status updates always use Drizzle `.update().set().where().returning()`
- TypeScript strict mode is on — no `any` unless absolutely necessary and commented
- Use `clsx` for conditional classnames
- File names: `kebab-case.ts` for lib files, Next.js convention for routes

---

## Developer Memory Systems

Bo uses a dual-layer memory architecture across all AI-assisted workflows. Understanding this prevents confusion and avoids redundant questions.

### Hindsight — Primary Personal Memory
- **What**: Cloud-based semantic memory via MCP (Vectorize.io)
- **Runs**: Docker container `hindsight` on `localhost:8888`, image `ghcr.io/vectorize-io/hindsight:latest`
- **Data location**: `C:\Users\Bo\.hindsight\pg0\`
- **Used for**: Personal context, project history, preferences, decisions across all conversations
- **Bank name**: `Bojan` — configured with 5 directives: Language, Profile, Project Focus, No Duplicates, Health Sensitive
- **Disposition**: Skepticism 2/5, Literalism 2/5, Empathy 4/5
- **Mental Models**: Technical stack & preferences, Active projects, Personal profile, Working method & patterns
- **Backup**: PowerShell script → `D:\Backups\hindsight\[date]` using Hasleo

### Stash — Structured Knowledge Store
- **What**: Open-source self-hosted MCP memory layer (Docker + PostgreSQL + pgvector)
- **Runs**: Docker container `stash-stash-1` on `localhost:8080`
- **Connected via**: `mcp-remote` via npx (Claude Desktop does not support direct http-url configs)
- **Used for**: Core consolidated reference material — stable facts, project specs, long-term reference
- **Tools**: 28 MCP tools available
- **Purpose vs Hindsight**: Stash = consolidated reference; Hindsight = granular session details

### How This Affects Kilo Code Behaviour
- When Bo says "you should know this" or "we discussed this before" — context likely lives in Hindsight or Stash, not in the current session
- Do not ask for information that was likely established in a prior session (tech stack, project decisions, provider choices)
- If something seems inconsistent with established patterns, flag it rather than silently overriding it
- Memory systems are Bo's own infrastructure — never suggest replacing or bypassing them

## 📝 Walkthrough Format

After every significant change, append to `walkthrough.md` (oldest → newest):

```markdown
## YYYY-MM-DD (Short title)

- Findings: [What was the problem or trigger?]
- Conclusions: [Why this approach?]
- Actions: [Which files changed and what exactly?]; validated.
```

---

---

## What NOT to Do

- Do not use localStorage or sessionStorage — all state is server-side or Zustand
- Do not add shadcn/ui — it is not in the project (no component library beyond Tailwind)
- Do not add Prisma — Drizzle ORM is the only ORM
- Do not reference Emergent — it has been removed
- Do not hardcode API keys or secrets
- Do not define `logApi` locally in route files — use the shared logger
- Do not fetch presigned URLs server-side and store them in the DB — generate them on demand
- Do not skip auth checks on API routes