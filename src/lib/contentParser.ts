import type { Course, Lesson, CueDraft } from '@/types'

// File System Access API type augmentation
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>
  }
}
import { buildCueDrafts } from './cueBuilder'

/**
 * Parse a course.json file content into a Course object.
 */
export function parseCourseJson(raw: string): Course {
  const data = JSON.parse(raw) as Course
  return {
    id: data.id,
    title: data.title,
    description: data.description ?? '',
    language: data.language ?? { target: 'en', native: 'es' },
    coverColor: data.coverColor ?? '#4F46E5',
    totalUnits: data.totalUnits ?? 0,
  }
}

/**
 * Parse a lesson.json file content into a Lesson object.
 */
export function parseLessonJson(raw: string): Lesson {
  const data = JSON.parse(raw) as Lesson
  return {
    id: data.id,
    title: data.title,
    order: data.order ?? 0,
    estimatedMinutes: data.estimatedMinutes ?? 5,
    tags: data.tags ?? [],
    audioNormal: data.audioNormal ?? 'audio-normal.mp3',
    audioInteractive: data.audioInteractive ?? 'audio-interactive.mp3',
    textFile: data.textFile ?? 'text.txt',
    defaultRepeatTarget: data.defaultRepeatTarget ?? 20,
    defaultSpeed: data.defaultSpeed ?? 1,
  }
}

/**
 * Parse text.txt content into cue drafts (pair format: target/translation lines).
 */
export function parseTextFile(content: string): CueDraft[] {
  return buildCueDrafts(content, true)
}

/**
 * Read a text file from a FileSystemDirectoryHandle.
 */
async function readTextFile(dirHandle: FileSystemDirectoryHandle, filename: string): Promise<string | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename)
    const file = await fileHandle.getFile()
    return await file.text()
  } catch {
    return null
  }
}

/**
 * Read an audio file from a FileSystemDirectoryHandle and return an object URL.
 */
async function readAudioFile(dirHandle: FileSystemDirectoryHandle, filename: string): Promise<string | null> {
  try {
    const fileHandle = await dirHandle.getFileHandle(filename)
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

/**
 * Parse a course folder using the File System Access API.
 * Expects: course.json at root, subdirectories with lesson.json + text.txt + audio files.
 */
export async function parseCourseFolder(dirHandle: FileSystemDirectoryHandle): Promise<{
  course: Course
  lessons: Array<{
    lesson: Lesson
    cues: CueDraft[]
    audioNormalUrl: string | null
    audioInteractiveUrl: string | null
  }>
}> {
  const courseRaw = await readTextFile(dirHandle, 'course.json')
  if (!courseRaw) throw new Error('course.json not found in the selected folder')

  const course = parseCourseJson(courseRaw)
  const lessons: Array<{
    lesson: Lesson
    cues: CueDraft[]
    audioNormalUrl: string | null
    audioInteractiveUrl: string | null
  }> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const [, handle] of (dirHandle as any).entries()) {
    if (handle.kind !== 'directory') continue

    const lessonDir = handle as FileSystemDirectoryHandle
    const lessonRaw = await readTextFile(lessonDir, 'lesson.json')
    if (!lessonRaw) continue

    const lesson = parseLessonJson(lessonRaw)
    const textContent = await readTextFile(lessonDir, lesson.textFile)
    const cues = textContent ? parseTextFile(textContent) : []
    const audioNormalUrl = await readAudioFile(lessonDir, lesson.audioNormal)
    const audioInteractiveUrl = await readAudioFile(lessonDir, lesson.audioInteractive)

    lessons.push({ lesson, cues, audioNormalUrl, audioInteractiveUrl })
  }

  lessons.sort((a, b) => a.lesson.order - b.lesson.order)

  return { course, lessons }
}

/**
 * Fallback parser for browsers without File System Access API.
 * Parses files from a standard file input with webkitdirectory.
 */
export async function parseCourseFromFileList(files: FileList): Promise<{
  course: Course
  lessons: Array<{
    lesson: Lesson
    cues: CueDraft[]
    audioNormalUrl: string | null
    audioInteractiveUrl: string | null
  }>
}> {
  const fileMap = new Map<string, File>()
  for (const file of files) {
    // webkitRelativePath gives paths like "english-beginner/unit-01/lesson.json"
    const parts = file.webkitRelativePath.split('/')
    // Remove the root folder name, keep the rest
    const relativePath = parts.slice(1).join('/')
    fileMap.set(relativePath, file)
  }

  // Find course.json at the root level
  const courseFile = fileMap.get('course.json')
  if (!courseFile) throw new Error('course.json not found in the selected folder')

  const courseRaw = await courseFile.text()
  const course = parseCourseJson(courseRaw)

  // Group files by subdirectory
  const dirs = new Map<string, Map<string, File>>()
  for (const [path, file] of fileMap) {
    const parts = path.split('/')
    if (parts.length < 2) continue
    const dirName = parts[0]
    const fileName = parts.slice(1).join('/')
    if (!dirs.has(dirName)) dirs.set(dirName, new Map())
    dirs.get(dirName)!.set(fileName, file)
  }

  const lessons: Array<{
    lesson: Lesson
    cues: CueDraft[]
    audioNormalUrl: string | null
    audioInteractiveUrl: string | null
  }> = []

  for (const [, dirFiles] of dirs) {
    const lessonFile = dirFiles.get('lesson.json')
    if (!lessonFile) continue

    const lessonRaw = await lessonFile.text()
    const lesson = parseLessonJson(lessonRaw)

    const textFile = dirFiles.get(lesson.textFile)
    const textContent = textFile ? await textFile.text() : null
    const cues = textContent ? parseTextFile(textContent) : []

    const normalAudioFile = dirFiles.get(lesson.audioNormal)
    const interactiveAudioFile = dirFiles.get(lesson.audioInteractive)

    lessons.push({
      lesson,
      cues,
      audioNormalUrl: normalAudioFile ? URL.createObjectURL(normalAudioFile) : null,
      audioInteractiveUrl: interactiveAudioFile ? URL.createObjectURL(interactiveAudioFile) : null,
    })
  }

  lessons.sort((a, b) => a.lesson.order - b.lesson.order)

  return { course, lessons }
}
