export type SortableConversation = {
  id: string;
  unread: number;
  updatedAt: string;
  urgency?: 'normal' | 'high' | 'critical';
};

const urgencyRank = { critical: 3, high: 2, normal: 1 } as const;

/** Home: urgência de posse → não lidas → mais recentes (heurística de updatedAt). */
export function sortForHome<T extends SortableConversation>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ua = urgencyRank[a.urgency ?? 'normal'];
    const ub = urgencyRank[b.urgency ?? 'normal'];
    if (ua !== ub) return ub - ua;
    if (a.unread !== b.unread) return b.unread - a.unread;
    return String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}
