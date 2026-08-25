/**
 * The camera background vocabulary, shared by the in-meeting settings dialog,
 * the dashboard preferences dialog, and the on-join applier.
 *
 * Extracted from the in-meeting dialog because three places now need to agree
 * on the identifiers AND on the file paths. A drifting copy of the paths is not
 * a cosmetic bug here: BackgroundTransformer swallows its own image load
 * failure, so a wrong path produces a processor that silently does nothing —
 * which is exactly how two options stayed broken while the files in
 * public/backgrounds were git-lfs pointer stubs.
 */

export type BackgroundEffect = 'none' | 'blur' | 'office' | 'mountains'

export const BACKGROUND_IMAGES: Record<'office' | 'mountains', string> = {
  office: '/backgrounds/office.jpg',
  mountains: '/backgrounds/mountains.jpg',
}

const EFFECTS: BackgroundEffect[] = ['none', 'blur', 'office', 'mountains']

/** Human labels, so the two dialogs cannot disagree about what "Peaks" is. */
export const BACKGROUND_LABELS: Record<BackgroundEffect, string> = {
  none: 'None',
  blur: 'Blur',
  office: 'Office',
  mountains: 'Peaks',
}

export function isBackgroundEffect(value: unknown): value is BackgroundEffect {
  return EFFECTS.includes(value as BackgroundEffect)
}

export function backgroundImageFor(
  effect: BackgroundEffect,
): string | undefined {
  return effect === 'office' || effect === 'mountains'
    ? BACKGROUND_IMAGES[effect]
    : undefined
}

export const BACKGROUND_EFFECTS: readonly BackgroundEffect[] = EFFECTS
