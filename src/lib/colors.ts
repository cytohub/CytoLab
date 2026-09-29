import type { Tone } from '@/domain/labels';

/** Tailwind class for a semantic tone chip (defined in globals.css @layer components). */
export function toneClass(tone: Tone): string {
  return `tone-${tone}`;
}

export function dotClass(tone: Tone): string {
  return `dot-${tone}`;
}

const COLOR_TOKENS = new Set(['slate', 'blue', 'indigo', 'violet', 'pink', 'red', 'orange', 'amber', 'green', 'teal']);

/** Solid identity color class for an avatar (falls back to slate for unknown values). */
export function avatarClass(color: string | null | undefined): string {
  return `avatar-${color && COLOR_TOKENS.has(color) ? color : 'slate'}`;
}

/** Subtle chip class for a tag or colored label. */
export function chipClass(color: string | null | undefined): string {
  return `chip-${color && COLOR_TOKENS.has(color) ? color : 'slate'}`;
}
