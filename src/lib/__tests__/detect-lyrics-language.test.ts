import { describe, expect, it } from "vitest";
import { detectLyricsLanguage, detectedLanguageLabel } from "../detect-lyrics-language";

// Real lyric excerpts, one per language Lyric Studio offers. These exercise the
// whole path: the franc trigram match, the `only` filter that must reject
// franc's 400+ other languages, and the mapping back to Lyric Studio's codes.
describe("detectLyricsLanguage", () => {
  it("detects every supported language from real lyrics", () => {
    const cases: [string, string][] = [
      [
        "nl",
        "De nacht is stil en ik denk aan jou, want ik hou van jou en dat is meer dan wat we hebben samen overleefd, daar",
      ],
      [
        "en",
        "I know that you have been waiting for me, all of the things that we have said are not what they seem, but I will not be the one to say it out loud",
      ],
      [
        "de",
        "Ich will dir sagen, dass es mir nicht gut geht. Wir haben uns so viel gesagt und doch ist es nicht so, aber ich weiß, dass du mich auch nicht verstehen wirst",
      ],
      [
        "fr",
        "Je ne sais pas ce que je dois faire maintenant, tu me dis que tout est bien mais je ne te crois pas, nous avons tout dit et il n'y a plus rien pour nous",
      ],
      [
        "es",
        "No sé lo que tengo que hacer ahora que estás aquí, todo lo que hemos dicho no es lo que parece ser, pero no voy a ser el que lo diga en voz alta",
      ],
      [
        "it",
        "Non so quello che devo fare adesso che sei qui, tutto quello che ci siamo detti non è quello che sembra, però non sarò io quello che lo dice ad alta voce",
      ],
      [
        "pt",
        "Não sei o que eu tenho que fazer agora que você está aqui, tudo o que nós dissemos não é o que parece ser, eu não vou ser aquele que diz isso em voz alta",
      ],
      [
        "pl",
        "Nie wiem co mam teraz zrobić, że tu tu jesteś. Wszystko co mówiliśmy nie jest tym co się wydaje, ale to ja nie powiem tego na głos",
      ],
      ["ja", "君のことが大好きだから季節を越えて"],
      ["zh", "我真的很喜歡你這是我唯一想說的事情"],
      ["ko", "너를 정말로 사랑해 이제는"],
      ["hi", "मैं तुमसे बहुत प्यार करता हूँ यह सब"],
      ["sr", "Не знам шта да радим сада када си ту овде са мном"],
    ];

    for (const [expected, lyrics] of cases) {
      expect(detectLyricsLanguage(lyrics), `lyrics in "${expected}"`).toBe(expected);
    }
  });

  it("returns Lyric Studio codes, not franc's ISO 639-3 codes", () => {
    // franc answers "nld"/"cmn"; the rest of the app stores "nl"/"zh". If this
    // regresses, every detected language silently stops matching the value the
    // user picked by hand.
    expect(detectLyricsLanguage("Ik hou van jou en dat is meer dan wat we hebben")).toBe("nl");
    expect(detectLyricsLanguage("我真的很喜歡你這是我唯一想說的事情")).toBe("zh");
  });

  it("stays inside Lyric Studio's language set", () => {
    // franc recognises 400+ languages and would happily answer "nds" (Low
    // German) for Dutch or "bho" (Bhojpuri) for Hindi. The `only` filter exists
    // precisely to turn those into "unknown" instead of a wrong label.
    const allowed = new Set(["nl", "en", "fr", "de", "es", "it", "pt", "pl", "sr", "ja", "ko", "hi", "zh"]);
    const samples = [
      "De nacht is stil en ik denk aan jou want ik hou van jou en dat is meer dan wat",
      "मैं तुमसे बहुत प्यार करता हूँ यह सब है कहने के लिए",
      "No sé lo que tengo que hacer ahora que estás aquí todo lo que hemos dicho",
      "Ich will dir sagen dass es mir nicht gut geht wir haben uns so viel gesagt",
    ];
    for (const sample of samples) {
      const detected = detectLyricsLanguage(sample);
      if (detected !== null) expect(allowed.has(detected)).toBe(true);
    }
  });

  it("returns null on empty or missing input", () => {
    expect(detectLyricsLanguage("")).toBeNull();
    expect(detectLyricsLanguage(null)).toBeNull();
    expect(detectLyricsLanguage(undefined)).toBeNull();
  });

  it("returns null on too little text to call", () => {
    // franc's own floor. A one-word hook is exactly where a guess would be
    // wrong, and a wrong language mis-groups two songs in Smart Archive.
    expect(detectLyricsLanguage("yeah")).toBeNull();
    expect(detectLyricsLanguage("oh")).toBeNull();
  });

  it("returns null on a repeated-word chant rather than naming its language", () => {
    // Instrumental intros are literally this. franc reads "la la la la la la"
    // as Spanish, which would label a track that has no words at all.
    expect(detectLyricsLanguage("la la la la la la")).toBeNull();
    expect(detectLyricsLanguage("oh oh oh oh oh oh oh")).toBeNull();
  });

  it("does not crash on nonsense input", () => {
    // franc confidently answers a language for anything long enough, including
    // keyboard-mashing. This test documents that boundary rather than claiming
    // it is handled: guaranteeing against it would need a real text-vs-noise
    // check, and the cost of a wrong label is one Smart Archive group. Worth
    // revisiting if that ever becomes visible.
    expect(() => detectLyricsLanguage("asdf qwer zxcv hjkl")).not.toThrow();
  });

  it("ignores bracketed section tags", () => {
    // [Verse]/[Chorus] are English boilerplate on every track. Counting them
    // made short non-English tracks look English.
    expect(
      detectLyricsLanguage(
        "[Chorus]\nDe nacht is stil en ik denk aan jou, want ik hou van jou en dat is meer dan wat\n[Verse]\nWe hebben samen alles overleefd, daar"
      )
    ).toBe("nl");
  });

  it("ignores parenthetical direction notes", () => {
    expect(
      detectLyricsLanguage(
        "Ik hou van jou (softly) en dat is meer dan wat we hebben samen overleefd, daar"
      )
    ).toBe("nl");
  });
});

describe("detectedLanguageLabel", () => {
  it("maps Lyric Studio codes to display labels", () => {
    expect(detectedLanguageLabel("nl")).toBe("Dutch");
    expect(detectedLanguageLabel("en")).toBe("English");
    expect(detectedLanguageLabel("zh")).toBe("Mandarin");
  });

  it("is case-insensitive", () => {
    expect(detectedLanguageLabel("NL")).toBe("Dutch");
  });

  it("returns null for unknown or missing codes", () => {
    expect(detectedLanguageLabel("und")).toBeNull();
    expect(detectedLanguageLabel(null)).toBeNull();
    expect(detectedLanguageLabel(undefined)).toBeNull();
  });
});
