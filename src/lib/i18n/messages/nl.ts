import type en from "./en";

// "Release", "Single", and "Album" are deliberately left untranslated
// throughout the app (see releasesBrowse/myReleases below) — they're used as
// English terms of art even in the Dutch interface.
const nl: typeof en = {
  nav: {
    browse: "VERKENNEN",
    organize: "ORGANISEREN",
    create: "MAKEN",
    refine: "VERFIJNEN",
    account: "ACCOUNT",
    developer: "ONTWIKKELAAR",
    discover: "Ontdekken",
    releasesBrowse: "Releases",
    library: "Bibliotheek",
    playlists: "Afspeellijsten",
    myReleases: "Mijn Releases",
    masterTracks: "Mastertracks",
    smartArchive: "Slim Archief",
    workspaces: "Werkruimtes",
    lyrics: "Songteksten",
    melody: "Melodie",
    music: "Muziek",
    timecodeEditor: "Tijdcode-editor",
    accountLink: "Account",
    settings: "Instellingen",
    logs: "Logs",
    admin: "Admin",
  },
  common: {
    save: "Opslaan",
    saving: "Opslaan…",
    cancel: "Annuleren",
  },
  settings: {
    language: "Taal",
    languageHint: "Wijzigt de interfacetaal en de taal van door AI gegenereerde analyses (bijv. Advanced Track DNA).",
  },
};

export default nl;
