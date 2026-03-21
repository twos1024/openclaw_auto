export function normalizeChannelType(channelType?: string | null): string {
  return channelType || "openclaw";
}

export function toLegacyChannelType(channelType: string): string {
  return channelType;
}
