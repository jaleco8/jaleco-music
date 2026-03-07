import type { Cue, CueDraft, CueKind } from '@/types'
import { MIN_CUE_GAP_SEC } from '@/types'

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const splitLines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

export const classifyCueText = (text: string): CueKind => {
  const trimmed = text.trim()
  if (!trimmed) return 'statement'
  return /\[YES\/NO\]/i.test(trimmed) || trimmed.endsWith('?') ? 'question' : 'statement'
}

export const buildCueDrafts = (text: string, parseByPairs: boolean): CueDraft[] => {
  const lines = splitLines(text)

  if (!parseByPairs) {
    return lines.map((line) => ({ text: line, kind: classifyCueText(line) }))
  }

  const drafts: CueDraft[] = []

  for (let index = 0; index < lines.length; index += 2) {
    const target = lines[index]
    if (!target) continue

    const translation = lines[index + 1]
    drafts.push({
      text: target,
      translation: translation ?? undefined,
      kind: classifyCueText(target),
    })
  }

  return drafts
}

export const buildCues = (drafts: CueDraft[], totalDuration?: number): Cue[] => {
  if (drafts.length === 0) return []

  const weights = drafts.map((draft) => Math.max(1, draft.text.split(/\s+/).filter(Boolean).length))

  if (totalDuration && totalDuration > 0) {
    const totalWeight = weights.reduce((sum, value) => sum + value, 0)
    let cursor = 0

    return drafts.map((draft, index) => {
      const duration = (weights[index] / totalWeight) * totalDuration
      const start = cursor
      const end = index === drafts.length - 1 ? totalDuration : start + duration
      cursor = end

      return {
        id: `cue-${index}`,
        text: draft.text,
        translation: draft.translation,
        kind: draft.kind,
        start,
        end,
        duration: end - start,
        weight: weights[index],
      }
    })
  }

  let cursor = 0

  return drafts.map((draft, index) => {
    const duration = clamp(weights[index] * 0.5, 1.1, 5.4)
    const start = cursor
    const end = start + duration
    cursor = end

    return {
      id: `cue-${index}`,
      text: draft.text,
      translation: draft.translation,
      kind: draft.kind,
      start,
      end,
      duration,
      weight: weights[index],
    }
  })
}

export const sanitizeManualStarts = (
  starts: number[],
  cueCount: number,
  totalDuration: number,
  fallbackStarts: number[],
): number[] => {
  if (cueCount === 0) return []

  const normalized: number[] = []
  const safeDuration = totalDuration > 0 ? totalDuration : cueCount * 2

  for (let index = 0; index < cueCount; index += 1) {
    const fallback =
      fallbackStarts[index] ??
      (cueCount > 1 ? (index / (cueCount - 1)) * safeDuration : 0)
    const source = Number.isFinite(starts[index]) ? starts[index] : fallback
    const min = index === 0 ? 0 : normalized[index - 1] + MIN_CUE_GAP_SEC
    const max = Math.max(min, safeDuration - (cueCount - index - 1) * MIN_CUE_GAP_SEC)
    normalized.push(clamp(source, min, max))
  }

  return normalized
}

export const buildManualCues = (drafts: CueDraft[], starts: number[], totalDuration: number): Cue[] => {
  if (drafts.length === 0) return []

  const safeTotalDuration = Math.max(totalDuration, starts[drafts.length - 1] + MIN_CUE_GAP_SEC)
  const weights = drafts.map((draft) => Math.max(1, draft.text.split(/\s+/).filter(Boolean).length))

  return drafts.map((draft, index) => {
    const start = starts[index]
    const targetEnd = index === drafts.length - 1 ? safeTotalDuration : starts[index + 1]
    const end = Math.max(start + MIN_CUE_GAP_SEC, targetEnd)

    return {
      id: `cue-${index}`,
      text: draft.text,
      translation: draft.translation,
      kind: draft.kind,
      start,
      end,
      duration: end - start,
      weight: weights[index],
    }
  })
}
