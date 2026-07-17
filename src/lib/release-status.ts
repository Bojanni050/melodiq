export const RELEASE_STATUSES = ["concept", "published", "unpublished"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];
