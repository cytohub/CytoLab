/**
 * At most `max` x-axis labels at an even stride, counted back from the latest
 * period so it is always labelled. Chosen here rather than by the chart's
 * collision logic, which drops labels irregularly.
 */
export function evenTicks(values: readonly string[], max = 6): string[] {
  if (values.length <= max) return [...values];
  const stride = Math.ceil(values.length / max);
  const ticks: string[] = [];
  for (let i = values.length - 1; i >= 0; i -= stride) ticks.unshift(values[i]!);
  return ticks;
}
