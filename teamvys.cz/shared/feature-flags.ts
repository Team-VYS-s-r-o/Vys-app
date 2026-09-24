// Multi-tenant feature flags — mirrors organizations.feature_flags (jsonb).
// Canonical key list lives in supabase/migrations/20260612120000 (VYS seed)
// and server/server.js provisionOrganizationFromCheckout (external defaults).

export const VYS_ORG_ID = '00000000-0000-4000-8000-000000000001';

export type OrgType = 'vys' | 'external';

export type FeatureFlagKey =
  | 'participant_wristbands'
  | 'participant_trick_xp'
  | 'participant_vys_leaderboard'
  | 'participant_spots_map'
  | 'participant_vys_quest_map'
  | 'participant_tutorials'
  | 'trainer_workshop_registration'
  | 'trainer_qr_codes'
  | 'trainer_spots'
  | 'trainer_leaderboard_qr_xp'
  | 'trainer_camps'
  | 'shared_arenas'
  | 'shared_mascots'
  | 'shared_attendance_quest_map'
  | 'shared_leaderboard';

export type FeatureFlags = Record<FeatureFlagKey, boolean> & { org_type: OrgType };

export const VYS_FEATURE_FLAGS: FeatureFlags = {
  org_type: 'vys',
  participant_wristbands: true,
  participant_trick_xp: true,
  participant_vys_leaderboard: true,
  participant_spots_map: true,
  participant_vys_quest_map: true,
  participant_tutorials: true,
  trainer_workshop_registration: true,
  trainer_qr_codes: true,
  trainer_spots: true,
  trainer_leaderboard_qr_xp: true,
  trainer_camps: true,
  shared_arenas: true,
  shared_mascots: true,
  shared_attendance_quest_map: true,
  shared_leaderboard: true,
};

export const EXTERNAL_FEATURE_FLAGS: FeatureFlags = {
  org_type: 'external',
  participant_wristbands: false,
  participant_trick_xp: false,
  participant_vys_leaderboard: false,
  participant_spots_map: false,
  participant_vys_quest_map: false,
  participant_tutorials: false,
  trainer_workshop_registration: false,
  trainer_qr_codes: false,
  trainer_spots: false,
  trainer_leaderboard_qr_xp: false,
  trainer_camps: true,
  shared_arenas: true,
  shared_mascots: true,
  shared_attendance_quest_map: true,
  shared_leaderboard: true,
};

/** Parse a raw feature_flags jsonb value; unknown/missing keys fall back to org-type defaults. */
export function parseFeatureFlags(raw: unknown, orgType?: string | null): FeatureFlags {
  const type: OrgType = orgType === 'external' ? 'external' : 'vys';
  const defaults = type === 'external' ? EXTERNAL_FEATURE_FLAGS : VYS_FEATURE_FLAGS;
  if (!raw || typeof raw !== 'object') return defaults;

  const source = raw as Record<string, unknown>;
  const flags = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof FeatureFlags>) {
    if (key === 'org_type') continue;
    const value = source[key];
    if (typeof value === 'boolean') flags[key] = value;
  }
  return flags;
}
