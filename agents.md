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
- Als Bo zegt **"dat weet je toch"** of **"we hebben dit besproken"** → zoek in Hindsight 
- Vraag **niet** naar informatie die waarschijnlijk al in een eerdere sessie vastgesteld is (tech stack, provider keuzes, architectuurbeslissingen)
- Als iets inconsistent lijkt met bekende patronen → **flag het**, overschrijf het nooit stilzwijgend
- De memory-systemen zijn Bo's eigen infrastructuur — stel nooit voor ze te vervangen of te omzeilen
- Raadpleeg **Context7** voordat je library-specifieke code schrijft of een API aanroept

## Memory Protocol
Start session: use hindsight recall to load my profile and recent project context. Summarize what you know about me, then we begin.

Before answering, always recall relevant context using the hindsight MCP tool.
Query: current topic, project name, or user preferences.

After important decisions or changes, store a summary using hindsight retain.

## 📋 Walkthrough-protocol

Na elke significante wijziging wordt `walkthrough.md` bijgewerkt. Dit is verplicht. Maak na 1000 regels een nieuw walkthrough2.md aan, daarna eventueel walkthrough3.md enz.

### Format (oudste → nieuwste volgorde):

```markdown
## YYYY-MM-DD (Korte titel)

- Findings: [Wat was het probleem of de aanleiding?]
- Conclusions: [Waarom deze aanpak?]
- Actions: [Welke bestanden zijn gewijzigd en wat precies?]; validated.
```

### Regels:
- Voeg altijd toe aan het **einde** van het bestand (chronologisch)
- Beschrijf de *reden* van een keuze — niet alleen wat er is gedaan



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
