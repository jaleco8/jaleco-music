import type { CSSProperties } from 'react'
import type { Cue, StudyMode } from '@/types'

interface CueDisplayProps {
  cues: Cue[]
  activeCueIndex: number
  focusCueIndex: number
  currentCueProgress: number
  studyMode: StudyMode
  blindMode: boolean
  focusMode: boolean
  fontSize: number
  lineHeight: number
  cueRefs: React.MutableRefObject<Array<HTMLParagraphElement | null>>
}

export function CueDisplay({
  cues,
  activeCueIndex,
  focusCueIndex,
  currentCueProgress,
  studyMode,
  blindMode,
  focusMode,
  fontSize,
  lineHeight,
  cueRefs,
}: CueDisplayProps) {
  if (cues.length === 0) {
    return (
      <div className="text-center py-20 text-[var(--text-muted)]">
        <p className="text-lg">Sin contenido para mostrar</p>
      </div>
    )
  }

  const showTranslation = studyMode === 'with-translation'

  return (
    <div className="py-20">
      {cues.map((cue, index) => {
        const isActive = index === activeCueIndex
        const isFocus = index === focusCueIndex
        const isPast = index < activeCueIndex
        const isNext = index > activeCueIndex
        const isQuestion = cue.kind === 'question' && studyMode === 'interactive'

        let opacity = 1
        let scale = 1
        if (isPast) { opacity = 0.35; scale = 0.93 }
        else if (isActive) { opacity = 1; scale = 1.02 }
        else if (isNext && focusMode) { opacity = 0.55; scale = 0.97 }
        else if (isNext) { opacity = 0.7; scale = 0.97 }

        const style: CSSProperties = {
          fontSize,
          lineHeight,
          opacity,
          transform: `scale(${scale})`,
          transformOrigin: 'left center',
          transition: 'all 200ms ease-out',
          ...(blindMode ? { filter: isActive ? 'blur(0px)' : 'blur(6px)' } : {}),
          ...(isActive ? { '--cue-progress': `${currentCueProgress * 100}%` } as CSSProperties : {}),
        }

        return (
          <div
            key={cue.id}
            ref={(el) => { cueRefs.current[index] = el as HTMLParagraphElement | null }}
            className={`
              relative mb-4 px-4 py-2 rounded-[var(--radius-md)]
              transition-all duration-200
              ${isActive ? 'cue-line-active bg-[var(--accent-soft)]' : ''}
              ${isFocus && studyMode === 'interactive' ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-transparent' : ''}
            `}
            style={style}
            aria-current={isActive ? 'true' : undefined}
          >
            <p className={`
              font-sans font-medium text-[var(--text-main)] relative z-10
              ${isQuestion ? 'italic' : ''}
            `}>
              {isQuestion && (
                <span className="text-[var(--accent)] mr-1" aria-hidden="true">?</span>
              )}
              {cue.text}
            </p>

            {cue.translation && showTranslation && (
              <p className="text-[var(--text-muted)] mt-1 relative z-10" style={{ fontSize: fontSize * 0.7 }}>
                {cue.translation}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
