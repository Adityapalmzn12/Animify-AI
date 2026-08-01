/** User-selectable quality tiers. Economy is default (cheapest). */

export type QualityTierId = 'economy' | 'standard' | 'premium';

export type QualityTierDef = {
  id: QualityTierId;
  name: string;
  tagline: string;
  default?: boolean;
  /** Replicate (or special) video model slug */
  videoModelT2v: string;
  videoModelI2v: string;
  imageModel: string;
  /** Engine hint for pipeline */
  engine: 'ltx' | 'wan' | 'minimax' | 'oss_motion';
  /** Transparent user credits by story length */
  storyCredits: { 10: number; 30: number; 60: number };
  imageCredits: number;
};

/**
 * Defaults aligned to real-ish API COGS + ~55% margin (not shown in UI):
 * - Economy: LTX (~$0.02/clip) → cheap
 * - Standard: Wan 1.3B / 480p (~$0.20/clip)
 * - Premium: MiniMax video-01 (~$0.50/sec ≈ $2.5–3/clip)
 */
export const DEFAULT_QUALITY_TIERS: QualityTierDef[] = [
  {
    id: 'economy',
    name: 'Economy',
    tagline: 'Cheapest · fast AI clips',
    default: true,
    videoModelT2v: 'lightricks/ltx-video',
    videoModelI2v: 'lightricks/ltx-video',
    imageModel: 'black-forest-labs/flux-schnell',
    engine: 'ltx',
    storyCredits: { 10: 15, 30: 29, 60: 55 },
    imageCredits: 3,
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Balanced quality · Wan AI',
    videoModelT2v: 'wan-video/wan-2.1-1.3b',
    videoModelI2v: 'wavespeedai/wan-2.1-i2v-480p',
    imageModel: 'black-forest-labs/flux-schnell',
    engine: 'wan',
    storyCredits: { 10: 45, 30: 119, 60: 229 },
    imageCredits: 4,
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Cinema · MiniMax Hailuo',
    videoModelT2v: 'minimax/video-01',
    videoModelI2v: 'minimax/video-01',
    imageModel: 'black-forest-labs/flux-dev',
    engine: 'minimax',
    storyCredits: { 10: 249, 30: 699, 60: 1299 },
    imageCredits: 8,
  },
];

export function normalizeQualityTier(raw?: string | null): QualityTierId {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'standard' || v === 'balanced') return 'standard';
  if (v === 'premium' || v === 'pro' || v === 'cinema') return 'premium';
  return 'economy';
}
