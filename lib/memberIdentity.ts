export function normalizedEmail(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}
// Display one row per email, while preserving stored IDs and associated data.
export function uniqueMembers<T extends { id: string; email?: string }>(members: T[], preferredId?: string): T[] {
  const rows = new Map<string, T>();
  for (const member of members) {
    const email = normalizedEmail(member.email);
    const key = email ? `email:${email}` : `id:${member.id}`;
    if (!rows.has(key) || member.id === preferredId) rows.set(key, member);
  }
  return [...rows.values()];
}
