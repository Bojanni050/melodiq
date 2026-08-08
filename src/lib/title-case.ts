// Small Dutch connector words that stay lowercase in a title, except when
// they're the first word (e.g. "Ik Hou van Je", but "Het Regent Buiten").
const LOWERCASE_WORDS = new Set(["van", "de", "het"]);

export function toTitleCase(title: string): string {
  return title
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      if (index !== 0 && LOWERCASE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}
