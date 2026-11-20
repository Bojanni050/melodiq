/**
 * APIMart returns two variants per generation. The second one is stored with a
 * " (2)" suffix appended to its title so the two rows stay distinguishable in
 * the data — but that marker is internal: it means nothing to the user and must
 * never show up in the UI, in a download filename, or in an auto-created
 * release/artist title.
 *
 * Everything that *displays* a title should pass it through here. (Other
 * call-sites still inline the same regex; this is the canonical version for new
 * code.)
 */
export function stripVariantSuffix(title: string | null | undefined): string {
  return (title ?? "").replace(/\s*\(2\)\s*$/, "");
}
