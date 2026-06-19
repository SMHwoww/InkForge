/**
 * 配置管理 API — 统一配置读写
 *
 * GET  /api/config       — 获取全部配置
 * PUT  /api/config       — 更新配置
 * GET  /api/config/ai    — 获取 AI 配置
 * PUT  /api/config/ai    — 更新 AI 配置
 */

import { Router, type Request, type Response } from 'express';
import { loadConfig, saveConfig, reloadConfig } from '../services/mcpConfig.js';

const router = Router();

// ─── GET /api/config ─────────────────────────────────────────────────────────

router.get('/', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    // 脱敏：不返回完整 API Key
    const safe = {
      ...config,
      ai: { ...config.ai, apiKey: config.ai.apiKey ? '***' + config.ai.apiKey.slice(-4) : '' },
      image: { ...config.image, apiKey: config.image.apiKey ? '***' + config.image.apiKey.slice(-4) : '' },
    };
    res.json({ code: 0, data: safe, message: 'ok' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── PUT /api/config ─────────────────────────────────────────────────────────

router.put('/', (req: Request, res: Response) => {
  try {
    const updated = saveConfig(req.body);
    const safe = {
      ...updated,
      ai: { ...updated.ai, apiKey: updated.ai.apiKey ? '***' + updated.ai.apiKey.slice(-4) : '' },
      image: { ...updated.image, apiKey: updated.image.apiKey ? '***' + updated.image.apiKey.slice(-4) : '' },
    };
    res.json({ code: 0, data: safe, message: '配置已保存' });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
});

// ─── GET /api/config/ai ──────────────────────────────────────────────────────

const REGION_REVERSE_MAP: Record<string, string> = {
  'beijing': '北京',
  'singapore': '新加坡',
  'virginia': '弗吉尼亚',
};

router.get('/ai', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    // Return flattened format for frontend Settings page
    const data = {
      aiApiKey: config.ai.apiKey ? '***' + config.ai.apiKey.slice(-4) : '',
      apiUrl: config.ai.baseUrl,
      modelName: config.ai.model,
      imageMethod: config.image.provider,
      imageApiKey: config.image.apiKey ? '***' + config.image.apiKey.slice(-4) : '',
      imageApiUrl: config.image.baseUrl,
      imageModel: config.image.model,
      imageRegion: REGION_REVERSE_MAP[config.image.region] || config.image.region,
    };
    res.json({ code: 0, data, message: 'ok' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── PUT /api/config/ai ──────────────────────────────────────────────────────

const REGION_MAP: Record<string, string> = {
  '北京': 'beijing',
  '新加坡': 'singapore',
  '弗吉尼亚': 'virginia',
};

router.put('/ai', (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Build ai config from frontend flat fields
    const aiUpdate: Record<string, string> = {};
    if (body.aiApiKey !== undefined) {
      if (!body.aiApiKey.startsWith('***')) {
        aiUpdate.apiKey = body.aiApiKey;
      }
    }
    if (body.apiUrl !== undefined) aiUpdate.baseUrl = body.apiUrl;
    if (body.modelName !== undefined) aiUpdate.model = body.modelName;

    // Build image config from frontend flat fields
    const imageUpdate: Record<string, string> = {};
    if (body.imageMethod !== undefined) imageUpdate.provider = body.imageMethod;
    if (body.imageApiKey !== undefined) {
      if (!body.imageApiKey.startsWith('***')) {
        imageUpdate.apiKey = body.imageApiKey;
      }
    }
    if (body.imageApiUrl !== undefined) imageUpdate.baseUrl = body.imageApiUrl;
    if (body.imageModel !== undefined) imageUpdate.model = body.imageModel;
    if (body.imageRegion !== undefined) {
      imageUpdate.region = REGION_MAP[body.imageRegion] || body.imageRegion;
    }

    const updated = saveConfig({ ai: aiUpdate, image: imageUpdate });

    const data = {
      aiApiKey: updated.ai.apiKey ? '***' + updated.ai.apiKey.slice(-4) : '',
      apiUrl: updated.ai.baseUrl,
      modelName: updated.ai.model,
      imageMethod: updated.image.provider,
      imageApiKey: updated.image.apiKey ? '***' + updated.image.apiKey.slice(-4) : '',
      imageApiUrl: updated.image.baseUrl,
      imageModel: updated.image.model,
      imageRegion: updated.image.region,
    };
    res.json({ code: 0, data, message: 'AI 配置已保存' });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
});

// ─── POST /api/config/reload ─────────────────────────────────────────────────

router.post('/reload', (_req: Request, res: Response) => {
  try {
    const config = reloadConfig();
    res.json({ code: 0, data: config, message: '配置已重载' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── GET /api/config/modules ─────────────────────────────────────────────────

router.get('/modules', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    res.json({ code: 0, data: config.modules, message: 'ok' });
  } catch (e: any) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// ─── PUT /api/config/modules ─────────────────────────────────────────────────

router.put('/modules', (req: Request, res: Response) => {
  try {
    const updated = saveConfig({ modules: req.body });
    res.json({ code: 0, data: updated.modules, message: '模块配置已保存' });
  } catch (e: any) {
    res.status(400).json({ code: 400, message: e.message });
  }
});

export default router;