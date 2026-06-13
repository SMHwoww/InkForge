/**
 * 小说作者服务平台 - API Server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db/index.js'
import projectRoutes from './routes/projects.js'
import characterRoutes from './routes/characters.js'
import worldbuildingRoutes from './routes/worldbuilding.js'
import chapterRoutes from './routes/chapters.js'
import outlineRoutes from './routes/outlines.js'
import starchartRoutes from './routes/starchart.js'
import aiRoutes from './routes/ai.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env — override so .env takes priority over shell env vars
dotenv.config({ override: true })

// init database
initDatabase().catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

/**
 * API Routes
 */
app.use('/api/projects', projectRoutes)
app.use('/api/projects/:projectId/characters', characterRoutes)
app.use('/api/projects/:projectId/worldbuilding', worldbuildingRoutes)
app.use('/api/projects/:projectId/chapters', chapterRoutes)
app.use('/api/projects/:projectId/outlines', outlineRoutes)
app.use('/api/projects/:projectId/starchart', starchartRoutes)
app.use('/api/ai', aiRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      code: 0,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error.message);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    code: 404,
    message: 'API 不存在',
  })
})

export default app