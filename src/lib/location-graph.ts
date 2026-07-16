export type SimpleConn = { a_id: string; b_id: string };

/** Retorna a menor distância em número de arestas entre `from` e `to`. -1 se não houver caminho. */
export function shortestPathDistance(conns: SimpleConn[], from: string, to: string): number {
  if (from === to) return 0;
  const adj = new Map<string, Set<string>>();
  for (const c of conns) {
    if (!adj.has(c.a_id)) adj.set(c.a_id, new Set());
    if (!adj.has(c.b_id)) adj.set(c.b_id, new Set());
    adj.get(c.a_id)!.add(c.b_id);
    adj.get(c.b_id)!.add(c.a_id);
  }
  const visited = new Set<string>([from]);
  let frontier: string[] = [from];
  let dist = 0;
  while (frontier.length > 0) {
    dist += 1;
    const next: string[] = [];
    for (const node of frontier) {
      const neighbors = adj.get(node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        if (n === to) return dist;
        visited.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return -1;
}