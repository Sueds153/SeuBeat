import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authorizeComAmorOrder, ComAmorIntegrationError, isComAmorIntegrationEnabled } from '../services/comamor/client';
import { createOrGetComAmorJob, dispatchComAmorCallbacks, getComAmorJob, publicJobStatus, queueJobStatusCallback } from '../services/comamor/jobs';

const router = express.Router();
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados pedidos. Tenta novamente daqui a pouco.' },
});

const orderSchema = z.object({ orderId: z.string().uuid() }).strict();
const createJobSchema = z.object({
  orderId: z.string().uuid(),
  instruction: z.string().trim().min(10).max(3000).optional(),
  lyrics: z.string().trim().min(10).max(5000).optional(),
  musicStyle: z.enum(['Kizomba', 'Semba', 'Zouk', 'Afrobeat', 'Gospel', 'R&B', 'Pop']),
}).strict().refine(input => Boolean(input.instruction) !== Boolean(input.lyrics), {
  message: 'Indica uma instrução ou uma letra, mas não ambas.',
});

function assertEnabled(): void {
  if (!isComAmorIntegrationEnabled()) {
    throw new ComAmorIntegrationError('Esta opção ainda não está disponível.', 503, 'integration_disabled');
  }
}

function sendError(res: express.Response, error: unknown): void {
  if (error instanceof ComAmorIntegrationError) {
    res.status(error.statusCode).json({ success: false, error: error.message, code: error.code });
    return;
  }
  res.status(503).json({ success: false, error: 'Serviço temporariamente indisponível. Tenta novamente.', code: 'service_unavailable' });
}

router.use(limiter);

router.post('/authorize', async (req, res) => {
  try {
    assertEnabled();
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Referência inválida.' });
    const authorization = await authorizeComAmorOrder(parsed.data.orderId);
    return res.json({
      success: true,
      orderId: authorization.orderId,
      occasion: authorization.occasion,
      generationAttempt: authorization.generationAttempt,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/jobs', async (req, res) => {
  try {
    assertEnabled();
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Preenche uma instrução ou letra válida e escolhe o estilo.' });
    const authorization = await authorizeComAmorOrder(parsed.data.orderId);
    const job = await createOrGetComAmorJob(authorization, {
      instruction: parsed.data.instruction,
      lyrics: parsed.data.lyrics,
      musicStyle: parsed.data.musicStyle,
    });
    void dispatchComAmorCallbacks();
    return res.status(202).json({
      success: true,
      jobId: job.id,
      status: publicJobStatus(job.status),
      generationAttempt: job.generation_attempt,
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/jobs/:jobId', async (req, res) => {
  try {
    assertEnabled();
    const jobId = z.string().uuid().safeParse(req.params.jobId);
    const orderId = orderSchema.safeParse({ orderId: req.query.orderId });
    if (!jobId.success || !orderId.success) return res.status(400).json({ success: false, error: 'Pedido inválido.' });
    const { job, song } = await getComAmorJob(jobId.data);
    if (job.order_id !== orderId.data.orderId) return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });

    const authorization = await authorizeComAmorOrder(orderId.data.orderId);
    if (authorization.generationAttempt !== job.generation_attempt || authorization.campaignId !== job.campaign_id) {
      return res.status(404).json({ success: false, error: 'Pedido não encontrado.' });
    }

    const status = publicJobStatus(job.status);
    await queueJobStatusCallback(job, status, song);
    void dispatchComAmorCallbacks();
    return res.json({
      success: true,
      jobId: job.id,
      generationAttempt: job.generation_attempt,
      status,
      ...(status === 'completed' ? {
        title: typeof song?.title === 'string' ? song.title : 'Canção personalizada',
        genre: job.music_style,
        audioUrl: typeof song?.audio_url === 'string' ? song.audio_url : undefined,
      } : {}),
      ...(status === 'failed' ? { errorCode: job.error_code || 'generation_failed' } : {}),
    });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
