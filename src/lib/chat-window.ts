export function mergeChatWindow<T extends { id: string; created_at: string }>(previous: T[], incoming: T[], limit = 80): T[] {
  const rows = new Map(previous.map((row) => [row.id, row]));
  for (const row of incoming) rows.set(row.id, { ...rows.get(row.id), ...row });
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).slice(-limit);
}
