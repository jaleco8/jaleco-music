import type { Cue } from '@/types'

export const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  const secs = total % 60
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export const formatTimeWithCentiseconds = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100)
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centiseconds
    .toString()
    .padStart(2, '0')}`
}

export const parseTimecode = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const asSeconds = Number(trimmed.replace(',', '.'))
  if (Number.isFinite(asSeconds)) return asSeconds

  const match = trimmed.match(/^(\d+):([0-5]\d(?:[.,]\d+)?)$/)
  if (!match) return null

  const minutes = Number(match[1])
  const seconds = Number(match[2].replace(',', '.'))
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null

  return minutes * 60 + seconds
}

export const formatSubtitleTimestamp = (seconds: number, separator: '.' | ','): string => {
  const safe = Math.max(0, seconds)
  const totalMs = Math.round(safe * 1000)
  const hours = Math.floor(totalMs / 3_600_000)
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
  const secs = Math.floor((totalMs % 60_000) / 1000)
  const milliseconds = totalMs % 1000

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}${separator}${milliseconds
    .toString()
    .padStart(3, '0')}`
}

export const serializeVtt = (cues: Cue[]): string => {
  const body = cues
    .map((cue) => {
      const start = formatSubtitleTimestamp(cue.start, '.')
      const end = formatSubtitleTimestamp(cue.end, '.')
      const text = cue.translation ? `${cue.text}\n${cue.translation}` : cue.text
      return `${start} --> ${end}\n${text}`
    })
    .join('\n\n')

  return `WEBVTT\n\n${body}\n`
}

export const serializeSrt = (cues: Cue[]): string => {
  return `${cues
    .map((cue, index) => {
      const start = formatSubtitleTimestamp(cue.start, ',')
      const end = formatSubtitleTimestamp(cue.end, ',')
      const text = cue.translation ? `${cue.text}\n${cue.translation}` : cue.text
      return `${index + 1}\n${start} --> ${end}\n${text}`
    })
    .join('\n\n')}\n`
}

export const downloadTextFile = (filename: string, content: string): void => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
