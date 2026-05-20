# ⚠️ Archivo generado automáticamente
# Fuente: Ai_Rules.md
# Fecha: 2026-05-20 02:26:41
# No editar directamente - los cambios se sobrescribirán
# 
# Para actualizar estas reglas, edita Ai_Rules.md y ejecuta:
# "AI Rules: Sincronizar todas las reglas"

---

# 🤖 AI Rules - Source of Truth

This file is the **single source of truth** for all AI rules in this project.

Changes here are automatically synchronized to:

- Cursor (.cursorrules)
- GitHub Copilot (.github/copilot-instructions.md)
- Windsurf (.windsurfrules)
- Cline (.clinerules)
- Aider (.aider.conf.yml)
- Claude (CLAUDE.md)
- Generic agents (agents.md)

# AI Agent Rules — Bo (Bojan)

> **Voor gebruik in:** Visual Studio Code, Kilo Code, GitHub Copilot, Claude Desktop  
> **Scope:** Generiek — geldig voor alle projecten  
> **Projectspecifieke regels:** staan altijd in `{projectnaam}-rules.md`

---

## 👤 Profiel

- **Naam**: Bo (Bojan)
- **Rol**: Zelfstandig webdesigner & webdeveloper, Groningen
- **Werkt solo** — geen team, geen externe developers
- **OS**: Windows 11
- **Editors**: Visual Studio Code (primair), Kilo Code, soms GitHub Copilot
- **Scaffolding**: bolt.new voor initiële opzet, daarna lokaal verder
- **Taal**: Communiceert in het **Nederlands** — antwoord altijd in het Nederlands tenzij code, foutmeldingen of technische termen dit vereisen

---

## 🧠 Memory-architectuur

Bo gebruikt een **drielaags systeem** van memory en documentatie-raadpleging. Begrijp dit zodat je nooit onnodig vragen stelt en altijd werkt met actuele informatie.

### Hindsight — Primair persoonlijk geheugen
| Eigenschap | Waarde |
|---|---|
| Type | Cloud-gebaseerde semantische memory via MCP (Vectorize.io) |
| Container | Docker `hindsight` op `localhost:8888` |
| Data | `C:\Users\Bo\.hindsight\pg0\` |
| Bank naam | `Bojan` |
| Gebruik | Persoonlijke context, projecthistorie, voorkeuren, beslissingen |
| Backup | PowerShell → `D:\Backups\hindsight\[datum]` via Hasleo |

**Configuratie:**
- 5 directives: Language, Profile, Project Focus, No Duplicates, Health Sensitive
- Disposition: Skepticism 2/5, Literalism 2/5, Empathy 4/5
- Mental Models: Technical stack & preferences, Active projects, Personal profile, Working method & patterns

### Stash — Gestructureerde kennisopslag
| Eigenschap | Waarde |
|---|---|
| Type | Self-hosted MCP layer (Docker + PostgreSQL + pgvector) |
| Container | `stash-stash-1` op `localhost:8080` |
| Verbinding | `mcp-remote` via npx |
| Gebruik | Stabiele referentie — specs, projectdefinities, lange-termijn facts |

### Context7 — Actuele library-documentatie
| Eigenschap | Waarde |
|---|---|
| Type | MCP-tool voor up-to-date library- en framework-documentatie |
| Gebruik | Raadplegen bij vragen over APIs, libraries, frameworks |

**Wanneer Context7 raadplegen:**
- Bij gebruik van een library of framework (Next.js, Drizzle, Zustand, Tailwind, AWS SDK, etc.)
- Wanneer je twijfelt over een API, functie-signatuur of configuratie-optie
- Bij het installeren of upgraden van een dependency
- Vóór je iets aanneemt op basis van trainingsdata — library-APIs veranderen

**Werkwijze:**
1. Zoek eerst de library ID op via `resolve-library-id`
2. Haal dan de relevante docs op via `get-library-docs`
3. Gebruik de actuele docs als leidraad — niet je trainingsdata

> Context7 heeft prioriteit boven aannames op basis van trainingskennis voor alles wat library-specifiek is.

### Gedragsregels voor de agent
- Als Bo zegt **"dat weet je toch"** of **"we hebben dit besproken"** → zoek in Hindsight of Stash, vraag niet opnieuw
- Vraag **niet** naar informatie die waarschijnlijk al in een eerdere sessie vastgesteld is (tech stack, provider keuzes, architectuurbeslissingen)
- Als iets inconsistent lijkt met bekende patronen → **flag het**, overschrijf het nooit stilzwijgend
- De memory-systemen zijn Bo's eigen infrastructuur — stel nooit voor ze te vervangen of te omzeilen
- Raadpleeg **Context7** voordat je library-specifieke code schrijft of een API aanroept

---

## 🛠 Standaard tech stack (Bo's voorkeur)

Gebruik deze stack als er geen projectspecifieke instructies zijn:

| Laag | Voorkeur |
|---|---|
| Framework | Next.js (App Router) |
| Taal | TypeScript, strict mode |
| Styling | Tailwind CSS |
| State | Zustand |
| ORM | Drizzle ORM |
| Database | PostgreSQL (VPS) of SQLite (desktop/local-first) |
| Auth | JWT met httpOnly cookies |
| Storage | AWS S3-compatibel |
| Package manager | npm |
| UI componenten | Geen library tenzij expliciet vermeld |

**Afwijkingen zijn alleen geldig als ze in het projectspecifieke rules-bestand staan.**

---

## 📋 Walkthrough-protocol

Na elke significante wijziging wordt `walkthrough.md` bijgewerkt. Dit is verplicht.

### Format (oudste → nieuwste volgorde):

```markdown
## YYYY-MM-DD (Korte titel)

- Findings: [Wat was het probleem of de aanleiding?]
- Conclusions: [Waarom deze aanpak?]
- Actions: [Welke bestanden zijn gewijzigd en wat precies?]; validated.
```

### Regels:
- Voeg altijd toe aan het **einde** van het bestand (chronologisch)
- Altijd **`npm run build`** draaien vóór je een taak als afgerond markeert
- Update ook `{projectnaam}-user.md` wanneer gebruikerszijdige functionaliteit verandert
- Beschrijf de *reden* van een keuze — niet alleen wat er is gedaan
- update versienummer onder de titel van de  app na elke volbrachte taak met de dag (woe, do etc.) en de tijd op dat moment. Gebruik eventueel mcp om acurate tijd te bepalen.

---

## 🔒 Universele beveiligingsregels

Deze regels gelden altijd, ongeacht het project:

**1. Nooit secrets in de repository**
- `.env.local` staat op de VPS of lokaal — nooit in git
- Geen hardcoded API keys, wachtwoorden of tokens in de code
- `.gitignore` altijd controleren bij projectstart

**2. JWT_SECRET heeft nooit een fallback**
```ts
if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");
```

**3. Elke beschermde API route doet zijn eigen auth-check**
- Middleware beschermt pagina's — niet API routes
- Elke route die gebruikersdata raakt: verificeer het JWT-token zelf

**4. IDOR-bescherming**
- Haal data altijd op via zowel record-ID als userId:
```ts
and(eq(table.id, id), eq(table.userId, decoded.userId))
```

**5. Webhook-verificatie**
- Check altijd een shared secret header voordat een webhook verwerkt wordt

**6. Nooit interne errors blootstellen aan de client**
```ts
catch (error) {
  console.error(error); // server-side log
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}
```

---

## 💻 Coding-conventies

```
✅ async/await — geen raw .then() chains
✅ Import DB-client uit centrale module — nooit opnieuw instantiëren
✅ Gedeelde utilities importeren uit lib/ — nooit inline dupliceren
✅ TypeScript strict — geen 'any' tenzij absoluut nodig + commentaar
✅ clsx voor conditionele classnames
✅ kebab-case.ts voor lib-bestanden
✅ Next.js conventies voor routes
✅ Geef elke functie een duidelijke naam — geen afkortingen
```

---

## 🚫 Universele don'ts

| ❌ Doe niet | ✅ Doe in plaats daarvan |
|---|---|
| `localStorage` of `sessionStorage` gebruiken | Zustand met `skipHydration: true` of server-side state |
| Een nieuwe dependency installeren zonder check | Controleer eerst of een bestaande dep het afdekt |
| Lokale versie van gedeelde utilities definiëren | Importeer uit `lib/` |
| Secrets hardcoden | `.env.local` gebruiken |
| Interne errors doorgeven aan de client | Generieke foutmelding teruggeven, details server-side loggen |
| API routes zonder auth-check | Altijd JWT verifiëren bij beschermde operaties |
| Prisma gebruiken | Drizzle ORM |
| shadcn/ui toevoegen tenzij vermeld | Plain Tailwind |
| Emergent refereren | Removed — gebruik OpenRouter of OpenAI |
| `any` in TypeScript | Correcte types definiëren |

---

## 🧩 Werkwijze & aanpak

### Hoe Bo werkt
- **Scaffolding** via bolt.new → download → lokaal verder in Visual Studio Code / Kilo Code
- **Iteratief**: architectuur vroeg valideren vóór grote build-out
- **Solo**: beslissingen worden snel genomen zodra opties helder zijn
- **Prompt-stijl**: werkt goed met kant-en-klare, gesegmenteerde prompts voor meerstaps-refactors

### Wat de agent moet doen
- **Wees proactief**: als je een probleem ziet dat niet gevraagd is, benoem het kort
- **Wees precies**: geef exacte bestandspaden, functienamen en regelnummers
- **Wees incrementeel**: één duidelijke taak per prompt — geen 10 dingen tegelijk
- **Bouw modules stap voor stap** via chat in plaats van alles in één grote prompt
- **Valideer altijd** met `npm run build` voor je een taak afsluit
- **Flag inconsistenties** in plaats van ze stilzwijgend te omzeilen

### Wat de agent NIET moet doen
- Niet vragen naar context die waarschijnlijk al bekend is
- Niet zelf architectuurbeslissingen nemen die niet gevraagd zijn
- Niet meerdere grote wijzigingen tegelijk doorvoeren
- Niet een nieuwe dependency installeren zonder het te benoemen en te vragen
- Niet de walkthrough overslaan na een significante wijziging
- Niet antwoorden in het Engels als de vraag in het Nederlands is gesteld

---

## 📁 Projectstructuur (verwacht patroon)

```
project-root/
  .kilo/
    rules/
      {projectnaam}-rules.md  # Projectspecifieke regels (leading authority)
      ai_rules.md             # Dit bestand (generiek)
  src/
    app/                    # Next.js App Router
      api/                  # Server-side API routes
    components/             # React componenten
    db/
      index.ts              # DB-client (Drizzle)
      schema.ts             # Alle tabeldefinities
    lib/                    # Gedeelde utilities
      auth.ts
      logger.ts
      providers/
  walkthrough.md            # Chronologisch logboek
    {projectnaam}-user.md     # Gebruikerszijdige documentatie
  .env.local                # Nooit in git
  .env.example              # Wél in git, zonder echte waarden
```

---

## 🗃 Logboek & documentatie

- **`walkthrough.md`**: intern technisch logboek — elke significante wijziging
- **`{projectnaam}-user.md`**: gebruikersdocumentatie — alleen wanneer gebruikerszijdige functionaliteit verandert
- **`{projectnaam}-rules.md`**: leading authority voor projectspecifieke regels

**Prioriteitsvolgorde bij conflict:**
1. `{projectnaam}-rules.md` — altijd leidend
2. `ai_rules.md` — generieke basis
3. Context7 — voor actuele library/framework documentatie
4. Hindsight/Stash — voor context die niet in de rules-bestanden staat

---

## 🚀 Deployment-context

- **VPS**: Strato VPS, Groningen
- **Reverse proxy**: Plesk met SSL via Let's Encrypt
- **Containers**: Docker Compose
- **Migrations**: `docker compose exec app npx drizzle-kit push`
- **Env**: `.env.local` op de VPS naast de app — nooit in de repository

---

## ✅ Start-checklist voor een nieuwe taak

Voordat je code schrijft:

- [ ] Heb ik de projectspecifieke rules gelezen? (`{projectnaam}-rules.md`)
- [ ] Is de taak duidelijk begrensd (één ding tegelijk)?
- [ ] Zijn er bestaande utilities die ik moet hergebruiken?
- [ ] Heb ik gecontroleerd of een nieuwe dependency echt nodig is?
- [ ] Weet ik welke bestanden ik ga aanraken?
- [ ] Heb ik Context7 geraadpleegd voor relevante library-documentatie?

Na de taak:

- [ ] `npm run build` geslaagd?
- [ ] `walkthrough.md` bijgewerkt?
- [ ] `{projectnaam}-user.md` bijgewerkt indien gebruikerszijdige wijziging?
- [ ] Geen secrets in de code terechtgekomen?
- [ ] Geen `any` gebruikt zonder commentaar?

---

*Dit is een levend document. Houd het in sync met `{projectnaam}-rules.md` per project.*