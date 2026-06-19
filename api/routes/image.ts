/**
 * 真珠 (Pearl) AI 图像生成 API
 *
 * POST /api/image/generate   — 生成图像
 * GET  /api/image/task/:taskId — 查询任务状态
 * POST /api/image/variation  — 图像变体
 */

import { Router, type Request, type Response } from 'express';
import { getImageConfig } from '../services/mcpConfig.js';
import { getDb, saveDb } from '../db/index.js';

const router = Router();

// ─── POST /api/image/generate ────────────────────────────────────────────────

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, negativePrompt, size, n, model, projectId } = req.body;

    if (!prompt) {
      res.status(400).json({ code: 400, message: 'prompt 不能为空' });
      return;
    }

    const imageConfig = getImageConfig();
    const provider = imageConfig.provider || 'bailian';

    if (provider === 'bailian') {
      // Aliyun DashScope async API
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

      // Check for top-level error
      if (result.code) {
        res.status(400).json({ code: 400, message: result.message || '百炼 API 错误' });
        return;
      }

      // Check for nested error in output
      if (result.output?.code) {
        res.status(400).json({ code: 400, message: result.output.message || result.output.code || '百炼 API 错误' });
        return;
      }

      // Sync response: model returns images directly in output.choices
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

        // Save to database
        if (projectId) {
          const db = await getDb();
          db.run(
            `INSERT INTO image_generations (project_id, prompt, negative_prompt, model, size, images, status)
             VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
            [
              projectId,
              prompt,
              negativePrompt || '',
              model || imageConfig.model || 'wan2.6-t2i',
              size || '1280*1280',
              JSON.stringify(images),
            ],
          );
          saveDb();
        }

        res.json({ code: 0, data: { images, provider: 'bailian' }, message: 'ok' });
        return;
      }

      // Async response: model returns a task_id for polling
      const taskId = result.output?.task_id;
      if (taskId) {
        // Save to database
        if (projectId) {
          const db = await getDb();
          db.run(
            `INSERT INTO image_generations (project_id, prompt, negative_prompt, model, size, task_id, status)
             VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [
              projectId,
              prompt,
              negativePrompt || '',
              model || imageConfig.model || 'wan2.6-t2i',
              size || '1280*1280',
              taskId,
            ],
          );
          saveDb();
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

      // Save to database
      if (projectId) {
        const db = await getDb();
        db.run(
          `INSERT INTO image_generations (project_id, prompt, negative_prompt, model, size, images, status)
           VALUES (?, ?, ?, ?, ?, ?, 'completed')`,
          [
            projectId,
            prompt,
            negativePrompt || '',
            model || 'dall-e-3',
            size || '1024x1024',
            JSON.stringify(images),
          ],
        );
        saveDb();
      }

      res.json({ code: 0, data: { images, provider: 'openai' }, message: 'ok' });
      return;
    }

    res.status(400).json({ code: 400, message: `不支持的图像生成方式: ${provider}` });
  } catch (e: any) {
    console.error('[Image] Generate error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── GET /api/image/task/:taskId ─────────────────────────────────────────────

router.get('/task/:taskId', async (req: Request, res: Response) => {
  try {
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

    // Update DB if task completed
    if (status === 'SUCCEEDED' || status === 'FAILED') {
      const db = await getDb();
      db.run(
        `UPDATE image_generations SET status = ?, images = ? WHERE task_id = ?`,
        [status.toLowerCase(), status === 'SUCCEEDED' ? JSON.stringify(images) : '', taskId],
      );
      saveDb();
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
  } catch (e: any) {
    console.error('[Image] Task error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

// ─── POST /api/image/variation ───────────────────────────────────────────────

router.post('/variation', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl) {
      res.status(400).json({ code: 400, message: 'imageUrl 不能为空' });
      return;
    }

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
  } catch (e: any) {
    console.error('[Image] Variation error:', e);
    res.status(500).json({ code: 500, message: e.message || '服务器内部错误' });
  }
});

export default router;