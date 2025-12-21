type FeatureFlags = {
  useSingleKeyForNewScreenings: boolean;
};

const flags: FeatureFlags = {
  useSingleKeyForNewScreenings: false,
};

export function getFlags(): FeatureFlags {
  return { ...flags };
}

export function setFlag(flag: keyof FeatureFlags, value: boolean): FeatureFlags {
  flags[flag] = value;
  return getFlags();
}
