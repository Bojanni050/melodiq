/**
 * APIMart custom-model bounds, kept in a module with no imports so both the
 * server (model-fit, routes) and the settings UI can use the same numbers
 * without dragging the DNA aggregation into the client bundle.
 */

/** APIMart's documented bounds for one custom-model training run. */
export const DNA_MODEL_MIN_TRACKS = 6;
export const DNA_MODEL_MAX_TRACKS = 24;
/** How many clips the UI preselects — enough to learn a sound, cheap to review. */
export const DNA_MODEL_SUGGESTED_TRACKS = 12;
