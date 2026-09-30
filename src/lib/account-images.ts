// Serving route for the account profile/hero images uploaded via
// /api/account/upload-image. That endpoint stores S3 keys shaped like
// `users/{userId}/{profile|hero}.{ext}` and hands out URLs shaped like
// `/api/account/{key}` — but no route ever served those URLs, so every
// account portrait rendered as a broken image.
//
// The validator below is the security boundary of the serving route: it only
// ever allows keys under the `users/` prefix with the exact shape the upload
// endpoint writes. A bare catch-all would also resolve keys like
// `tracks/{id}/audio.mp3` straight out of S3, leaking private audio to anyone
// who can guess (or enumerate) a key.
const ACCOUNT_IMAGE_KEY_PATTERN =
  /^users\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(profile|hero)\.(avif|webp|jpg|jpeg|png|gif)$/;

/**
 * Turns the catch-all URL segments back into an S3 key, or returns null when
 * they are not an account image. The strict pattern (lowercase uuid, only the
 * two type names the upload endpoint writes, only image extensions) is what
 * keeps the serving route from becoming a public window into the whole bucket.
 */
export function parseAccountImageKey(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return null;
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\\"))) {
    return null;
  }
  const key = segments.join("/");
  return ACCOUNT_IMAGE_KEY_PATTERN.test(key) ? key : null;
}
