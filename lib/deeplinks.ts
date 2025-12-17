/**
 * Deep Link Helpers
 *
 * Builds deep link URLs for the Trackmate Timing native app.
 * See docs/DEEP_LINK_SPEC.md for the full specification.
 */

// ============================================================
// Constants
// ============================================================

/** Current deep link version */
const DEEP_LINK_VERSION = '1';

const DEEP_LINK_SCHEME = 'trackmate://';
const TIMING_PATH = 'timing';

// ============================================================
// Types
// ============================================================

/**
 * Track conditions values supported by the Timing app (v1)
 */
export type TrackConditions = 'dry' | 'damp' | 'wet';

/**
 * Parameters for building a Timing deep link
 */
export type TimingDeepLinkParams = {
  /** Required: The track UUID */
  trackId: string;
  /** Optional: The car UUID */
  carId?: string;
  /** Optional: Track conditions */
  conditions?: TrackConditions;
};

// ============================================================
// Functions
// ============================================================

/**
 * Builds a deep link URL for the Trackmate Timing app.
 *
 * Always includes:
 * - v=1 (version parameter)
 * - trackId (required)
 *
 * Optionally includes:
 * - carId (if provided)
 * - conditions (if provided)
 *
 * @param params - The deep link parameters
 * @returns The formatted deep link URL, or null if trackId is missing
 *
 * @example
 * buildTimingDeepLink({ trackId: 'abc-123' })
 * // => 'trackmate://timing?v=1&trackId=abc-123'
 *
 * @example
 * buildTimingDeepLink({ trackId: 'abc-123', carId: 'def-456', conditions: 'dry' })
 * // => 'trackmate://timing?v=1&trackId=abc-123&carId=def-456&conditions=dry'
 */
export function buildTimingDeepLink(params: TimingDeepLinkParams): string | null {
  const { trackId, carId, conditions } = params;

  // trackId is required
  if (!trackId) {
    return null;
  }

  const searchParams = new URLSearchParams();

  // Always include version first
  searchParams.set('v', DEEP_LINK_VERSION);

  // Always include trackId (required)
  searchParams.set('trackId', encodeURIComponent(trackId));

  // Include carId only if provided and non-empty
  if (carId) {
    searchParams.set('carId', encodeURIComponent(carId));
  }

  // Include conditions only if provided and non-empty
  if (conditions) {
    searchParams.set('conditions', encodeURIComponent(conditions));
  }

  return `${DEEP_LINK_SCHEME}${TIMING_PATH}?${searchParams.toString()}`;
}

/**
 * Valid conditions values for the deep link
 */
const VALID_CONDITIONS: TrackConditions[] = ['dry', 'damp', 'wet'];

/**
 * Validates that a string is a valid track conditions value.
 *
 * @param value - The value to validate
 * @returns True if the value is a valid TrackConditions
 */
export function isValidConditions(value: string): value is TrackConditions {
  return VALID_CONDITIONS.includes(value as TrackConditions);
}

/**
 * Maps UI conditions values to deep link conditions.
 * UI may use more specific values (dry_warm, dry_cool) but deep link uses simplified (dry).
 *
 * @param uiConditions - The conditions value from the UI
 * @returns The normalized conditions value for the deep link, or undefined
 */
export function normalizeConditions(uiConditions: string): TrackConditions | undefined {
  switch (uiConditions) {
    case 'dry_warm':
    case 'dry_cool':
    case 'dry':
      return 'dry';
    case 'damp':
      return 'damp';
    case 'wet':
      return 'wet';
    default:
      return undefined;
  }
}
