import path from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

/**
 * Dev-only plugin: exposes POST /api/timing/save so the browser can persist
 * VTT timing files directly into src/content/courses/.
 * The files are committed to git and available on any device after git pull.
 */
function timingSavePlugin(): Plugin {
  return {
    name: 'timing-save',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/timing/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const { relativePath, content } = JSON.parse(body) as {
              relativePath: string
              content: string
            }

            // Reject any path traversal attempts
            const safe = relativePath.replaceAll('..', '').replace(/^\/+/, '')
            const abs = path.resolve(__dirname, 'src/content/courses', safe)
            const base = path.resolve(__dirname, 'src/content/courses')
            if (!abs.startsWith(base)) throw new Error('Invalid path')

            mkdirSync(path.dirname(abs), { recursive: true })
            writeFileSync(abs, content, 'utf-8')

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: String(e) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: isGitHubActions && repoName ? `/${repoName}/` : '/',
  plugins: [react(), tailwindcss(), timingSavePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
