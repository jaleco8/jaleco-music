import { useRef } from 'react'
import { useContentStore } from '@/stores/useContentStore'
import { Button } from '@/components/ui/Button'
import { UiIcon } from '@/components/ui/Icons'

interface ContentLoaderProps {
  onLoaded?: () => void
}

const supportsFileSystemAccess = typeof window !== 'undefined' && 'showDirectoryPicker' in window

export function ContentLoader({ onLoaded }: ContentLoaderProps) {
  const loadCourseFromDirectory = useContentStore((s) => s.loadCourseFromDirectory)
  const loadCourseFromFileList = useContentStore((s) => s.loadCourseFromFileList)
  const loading = useContentStore((s) => s.loading)
  const error = useContentStore((s) => s.error)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePickFolder = async () => {
    if (supportsFileSystemAccess) {
      try {
        const dirHandle = await (window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
        await loadCourseFromDirectory(dirHandle)
        onLoaded?.()
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to load course folder:', err)
        }
      }
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await loadCourseFromFileList(files)
    onLoaded?.()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Button
        variant="primary"
        size="lg"
        onClick={handlePickFolder}
        disabled={loading}
        className="gap-3"
      >
        <UiIcon name="folder" size={22} />
        {loading ? 'Cargando...' : 'Cargar curso'}
      </Button>

      {!supportsFileSystemAccess && (
        <input
          ref={fileInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in the type definitions
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
      )}

      {error && (
        <p className="text-sm text-[var(--state-error)] text-center max-w-xs">
          {error}
        </p>
      )}
    </div>
  )
}
