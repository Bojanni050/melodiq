# MelodIQ — AI Music Studio

MelodIQ is a **multi-provider AI music generation studio** built with Next.js. Generate songs across multiple AI music engines, manage tracks with workspaces and playlists, and stream high-quality audio — all from one interface.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

- **Multi-Provider Generation** — Generate music through PoYo, MusicGPT, Minimax, Tempolor, and Lyria
- **Lyrics Studio** — AI-powered lyric generation, style suggestion, and translation
- **Smart Workspaces** — Organize tracks into workspaces with automatic sorting and cover collages
- **Playlists & Queue** — Build playlists, drag-and-drop queue management
- **High-Quality Audio** — Automatic WAV conversion for HD downloads
- **Cover Art** — AI-generated cover art for every track
- **User Accounts** — JWT-based authentication with credit management
- **Responsive UI** — Tailwind CSS 4 with collapsible sidebar, dark theme, and resizable panels
- **Dockerized** — Full Docker Compose setup with PostgreSQL

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **UI** | React 19, Tailwind CSS 4 |
| **State** | Zustand 5 (persisted) |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Auth** | JWT (bcrypt + jsonwebtoken) |
| **Storage** | AWS S3 (presigned URLs) |
| **Deployment** | Docker Compose, GitHub Actions |
| **Audio** | music-metadata, PoYo API |

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- An S3-compatible storage bucket
- API keys for at least one music provider

### Installation

```bash
# Clone the repo
git clone https://github.com/bojanni050/melodiq.git
cd melodiq

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Generate database schema
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry (default: `7d`) |
| `S3_ENDPOINT` | S3-compatible endpoint URL |
| `S3_REGION` | S3 region |
| `S3_BUCKET` | S3 bucket name |
| `S3_ACCESS_KEY_ID` | S3 access key |
| `S3_SECRET_ACCESS_KEY` | S3 secret key |
| `BASE_URL` | Public application URL |
| `POYO_API_KEY` | API key for PoYo/Minimax |
| `MUSICGPT_API_KEY` | API key for MusicGPT |
| `TEMPOLOR_API_KEY` | API key for Tempolor |

---

## Music Providers

MelodIQ supports multiple AI music generation providers:

| Provider | Models | Features |
|----------|--------|----------|
| **PoYo** | V4, V4.5, V4 SALL, V4 SPLUS, V5, V5.5 | Custom lyrics, instrumental mode |
| **Minimax** | minimax-music-2.6 | High-quality audio, configurable sample rate |
| **MusicGPT** | — | Custom lyrics, instrumental mode |
| **Tempolor** | — | Prompt-based generation |
| **Lyria** | — | Pay-per-use, API-based |

---

## Deployment

### Docker Compose (recommended)

```bash
docker compose up -d --build
```

The application runs on port 3000 with a PostgreSQL database container.
Environment variables are loaded from `.env.production`.

### GitHub Actions

The repo includes an automated deploy workflow (`.github/workflows/deploy to vps.yml`) that:
1. Connects via SSH
2. Pulls the latest changes
3. Rebuilds and restarts Docker containers

---

## Project Structure

```
melodiq/
├── src/
│   ├── app/               # Next.js App Router pages & API routes
│   │   ├── api/           # REST API endpoints
│   │   │   ├── auth/      # Login, register, logout
│   │   │   ├── generate/  # Music generation
│   │   │   ├── tracks/    # Track CRUD, streaming, ratings
│   │   │   ├── webhooks/  # Provider webhook handlers
│   │   │   └── ...
│   │   └── pages/         # Studio, Library, Settings, Lyrics Studio
│   ├── components/        # React components
│   ├── db/                # Database schema & connection
│   └── lib/               # Utilities & providers
│       ├── providers/     # AI music provider integrations
│       ├── auth.ts        # JWT authentication
│       ├── s3.ts          # S3 storage
│       └── store.ts       # Zustand stores
├── docker-compose.yml     # Docker setup
├── Dockerfile             # Multi-stage build
└── drizzle.config.ts      # Drizzle ORM config
```

---

## API Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/register` | POST | User registration |
| `/api/auth/me` | GET | Current user info |
| `/api/generate` | POST | Generate music |
| `/api/tracks` | GET | List tracks |
| `/api/tracks/[id]` | GET/DELETE | Track details / delete |
| `/api/tracks/[id]/stream` | GET | Stream audio |
| `/api/tracks/[id]/download` | GET | Download HD audio |
| `/api/credits` | GET | Credit balances |
| `/api/llm` | POST | Optimize prompts / generate lyrics |
| `/api/webhooks/:provider` | POST | Provider callback handlers |

---

## License

MIT
