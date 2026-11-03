export const getOperatorColorClass = (opType: string): string => {
  const upper = opType.toUpperCase();
  if (upper.includes('JOIN')) {
    return 'bg-purple-500/15 text-purple-400 border-purple-500/40';
  }
  if (upper.includes('SCAN')) {
    return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40';
  }
  if (upper.includes('FILTER') || upper.includes('PROJECTION')) {
    return 'bg-amber-500/15 text-amber-400 border-amber-500/40';
  }
  if (upper.includes('AGG') || upper.includes('GROUP')) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  }
  return 'bg-accent/15 text-accent border-accent/40';
};
