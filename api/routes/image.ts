/**
 * 真珠 (Pearl) AI 图像生成 API
 *
 * POST /api/image/generate   — 生成图像
 * GET  /api/image/task/:taskId — 查询任务状态
 * POST /api/image/variation  — 图像变体
 */

import { Router, type Request, type Response } from 'express';
import { getImageConfig } from '../services/mcpConfig.js';
import { getDb } from '../db/index.js';
import { imageGenerations } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { validateRequest } from '../middlewares/validateRequest.js';
import { asyncHandler } from '../common/asyncHandler.js';
import { generateImageBody, imageVariationBody, taskIdParam } from '../schemas/index.js';

const router = Router();

// ─── POST /api/image/generate ────────────────────────────────────────────────

router.post('/generate', validateRequest({ body: generateImageBody }), asyncHandler(async (req: Request, res: Response) => {
  const { prompt, negativePrompt, size, n, model, projectId } = req.body;

  const imageConfig = getImageConfig();
  const provider = imageConfig.provider || 'bailian';

  if (provider === 'bailian') {
    const apiKey = imageConfig.apiKey;
    if (!apiKey) {
      res.status(400).json({ code: 400, message: '请先配置百炼 API Key' });
      return;
    }

    const reqBody: any = {
      model: model || imageConfig.model || 'wan2.6-t2i',
      input: {
        messages: [
          { role: 'user', content: [{ text: prompt }] },
        ],
      },
      parameters: {
        prompt_extend: true,
        watermark: false,
        n: n || 1,
      },
    };

    if (negativePrompt) {
      reqBody.parameters.negative_prompt = negativePrompt;
    }
    if (size) {
      reqBody.parameters.size = size;
    }

    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(reqBody),
      },
    );

    const result: any = await response.json();

    console.log('[Image] Bailian API response:', JSON.stringify(result).substring(0, 500));

    if (result.code) {
      res.status(400).json({ code: 400, message: result.message || '百炼 API 错误' });
      return;
    }

    if (result.output?.code) {
      res.status(400).json({ code: 400, message: result.output.message || result.output.code || '百炼 API 错误' });
      return;
    }

    // Sync response
    if (result.output?.choices) {
      const images: string[] = [];
      for (const choice of result.output.choices) {
        const contents = choice.message?.content || [];
        for (const content of contents) {
          if (content.image) {
            images.push(content.image);
          }
        }
      }

      if (images.length === 0) {
        console.error('[Image] Sync response contained no images:', JSON.stringify(result));
        res.status(500).json({ code: 500, message: '百炼 API 返回了同步响应但未包含图片' });
        return;
      }

      if (projectId) {
        const db = getDb();
        db.insert(imageGenerations).values({
          projectId,
          prompt,
          negativePrompt: negativePrompt || null,
          model: model || imageConfig.model || 'wan2.6-t2i',
          size: size || '1280*1280',
          images: JSON.stringify(images),
          status: 'completed',
        } as any).run();
      }

      res.json({ code: 0, data: { images, provider: 'bailian' }, message: 'ok' });
      return;
    }

    // Async response
    const taskId = result.output?.task_id;
    if (taskId) {
      if (projectId) {
        const db = getDb();
        db.insert(imageGenerations).values({
          projectId,
          prompt,
          negativePrompt: negativePrompt || null,
          model: model || imageConfig.model || 'wan2.6-t2i',
          size: size || '1280*1280',
          taskId,
          status: 'pending',
        } as any).run();
      }

      res.json({ code: 0, data: { taskId, provider: 'bailian' }, message: 'ok' });
      return;
    }

    console.error('[Image] Bailian API returned unexpected response:', JSON.stringify(result));
    res.status(500).json({ code: 500, message: '百炼 API 返回了未知响应格式，请检查模型名称是否正确' });
    return;
  }

  if (provider === 'openai') {
    const apiKey = imageConfig.apiKey;
    const baseUrl = imageConfig.baseUrl || 'https://api.openai.com';

    if (!apiKey) {
      res.status(400).json({ code: 400, message: '请先配置 OpenAI API Key' });
      return;
    }

    const reqBody: any = {
      prompt,
      n: n || 1,
      size: size || '1024x1024',
      response_format: 'url',
    };
    if (model) {
      reqBody.model = model;
    }

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(reqBody),
    });

    const result: any = await response.json();

    if (result.error) {
      res.status(400).json({ code: 400, message: result.error.message || 'OpenAI API 错误' });
      return;
    }

    const images = (result.data || []).map((item: any) => item.url || item.b64_json || '');

    if (projectId) {
      const db = getDb();
      db.insert(imageGenerations).values({
        projectId,
        prompt,
        negativePrompt: negativePrompt || null,
        model: model || 'dall-e-3',
        size: size || '1024x1024',
        images: JSON.stringify(images),
        status: 'completed',
      } as any).run();
    }

    res.json({ code: 0, data: { images, provider: 'openai' }, message: 'ok' });
    return;
  }

  res.status(400).json({ code: 400, message: `不支持的图像生成方式: ${provider}` });
}));

// ─── GET /api/image/task/:taskId ─────────────────────────────────────────────

router.get('/task/:taskId', validateRequest({ params: taskIdParam }), asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const imageConfig = getImageConfig();
  const apiKey = imageConfig.apiKey;

  if (!apiKey) {
    res.status(400).json({ code: 400, message: '请先配置 API Key' });
    return;
  }

  const response = await fetch(
    `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const result: any = await response.json();

  if (result.code) {
    res.status(400).json({ code: 400, message: result.message || '查询任务失败' });
    return;
  }

  const output = result.output || {};
  const taskStatus = output.task_status || result.status || 'UNKNOWN';

  let status: string;
  if (taskStatus === 'PENDING' || taskStatus === 'RUNNING') {
    status = taskStatus;
  } else if (taskStatus === 'SUCCEEDED') {
    status = 'SUCCEEDED';
  } else {
    status = 'FAILED';
  }

  let images: string[] = [];
  if (status === 'SUCCEEDED' && output.results) {
    images = output.results.map((r: any) => r.url || '');
  }

  if (status === 'SUCCEEDED' || status === 'FAILED') {
    const db = getDb();
    db.update(imageGenerations)
      .set({
        status: status.toLowerCase(),
        images: status === 'SUCCEEDED' ? JSON.stringify(images) : '',
      } as any)
      .where(eq(imageGenerations.taskId, taskId))
      .run();
  }

  res.json({
    code: 0,
    data: {
      status,
      images: status === 'SUCCEEDED' ? images : undefined,
      error: status === 'FAILED' ? (output.message || '任务失败') : undefined,
    },
    message: 'ok',
  });
}));

// ─── POST /api/image/variation ───────────────────────────────────────────────

router.post('/variation', validateRequest({ body: imageVariationBody }), asyncHandler(async (req: Request, res: Response) => {
  const { imageUrl, prompt } = req.body;

  const imageConfig = getImageConfig();
  const apiKey = imageConfig.apiKey;
  const baseUrl = imageConfig.baseUrl || 'https://api.openai.com';

  if (!apiKey) {
    res.status(400).json({ code: 400, message: '请先配置 API Key' });
    return;
  }

  const reqBody: any = {
    image: imageUrl,
    n: 1,
    size: '1024x1024',
    response_format: 'url',
  };
  if (prompt) {
    reqBody.prompt = prompt;
  }

  const response = await fetch(`${baseUrl}/v1/images/variations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(reqBody),
  });

  const result: any = await response.json();

  if (result.error) {
    res.status(400).json({ code: 400, message: result.error.message || 'OpenAI API 错误' });
    return;
  }

  const images = (result.data || []).map((item: any) => item.url || '');

  res.json({ code: 0, data: { images }, message: 'ok' });
}));

export default router;