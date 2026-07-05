import { logWarn } from '../utils/logger';

const SUNO_TIMEOUT_MS = Number(process.env.SUNO_TIMEOUT_MS || 60000);

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = SUNO_TIMEOUT_MS, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status === 429 && attempt < retries) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        logWarn(`[Suno Voice] 429 Too Frequent, retry ${attempt}/${retries} in ${backoff}ms`);
        clearTimeout(timeout);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`Suno Voice request timeout after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        logWarn(`[Suno Voice] Attempt ${attempt}/${retries} failed: ${err.message}, retrying...`);
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Suno Voice request failed after ${retries} retries`);
}

function getApiKey(): string {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error('SUNO_API_KEY nao configurada.');
  return key;
}

function apiHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`
  };
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export interface SunoVoiceValidationResult {
  taskId: string;
  validateInfo?: string;
  status: string;
}

export interface SunoVoiceRecordResult {
  taskId: string;
  voiceId: string | null;
  status: string;
  errorCode?: number;
  errorMessage?: string;
}

export interface SunoVoiceCheckResult {
  isAvailable: boolean;
}

export async function generateValidationPhrase(
  voiceUrl: string,
  vocalStartS: number = 0,
  vocalEndS: number = 30,
  language: string = 'pt'
): Promise<SunoVoiceValidationResult> {
  const res = await fetchWithTimeout('https://api.sunoapi.org/api/v1/voice/validate', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      voiceUrl,
      vocalStartS,
      vocalEndS,
      language
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice validate failed: ${res.status} - ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice validate error: ${data.msg || 'Erro desconhecido'}`);
  }

  return {
    taskId: data.data?.taskId || '',
    status: 'processing'
  };
}

export async function getValidationPhraseResult(taskId: string): Promise<SunoVoiceValidationResult> {
  const res = await fetchWithTimeout(`https://api.sunoapi.org/api/v1/voice/validate-info?taskId=${taskId}`, {
    headers: apiHeaders()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice validate-info failed: ${res.status} - ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice validate-info error: ${data.msg || 'Erro desconhecido'}`);
  }

  const validateInfo = firstString(
    data.data?.validateInfo,
    data.data?.validate_info,
    data.data?.phrase
  );

  return {
    taskId,
    validateInfo: validateInfo || undefined,
    status: data.data?.status || 'processing'
  };
}

export async function waitForValidationPhrase(taskId: string, maxAttempts = 30): Promise<SunoVoiceValidationResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 2000));
    const result = await getValidationPhraseResult(taskId);
    if (result.validateInfo) {
      return result;
    }
    if (result.status === 'fail') {
      throw new Error(`Suno Voice validation failed after ${attempt + 1} attempts`);
    }
  }
  throw new Error(`Suno Voice validation phrase not ready after ${maxAttempts} attempts`);
}

export async function createCustomVoice(
  validationTaskId: string,
  verifyUrl: string,
  voiceName: string = 'SeuBeat Voice',
  description: string = 'Custom voice for SeuBeat',
  style: string = '',
  singerSkillLevel: string = 'beginner'
): Promise<SunoVoiceRecordResult> {
  const res = await fetchWithTimeout('https://api.sunoapi.org/api/v1/voice/generate', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({
      taskId: validationTaskId,
      verifyUrl,
      voiceName,
      description,
      style,
      singerSkillLevel
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice generate failed: ${res.status} - ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice generate error: ${data.msg || 'Erro desconhecido'}`);
  }

  return {
    taskId: data.data?.taskId || '',
    voiceId: null,
    status: 'processing'
  };
}

export async function getVoiceRecord(taskId: string): Promise<SunoVoiceRecordResult> {
  const res = await fetchWithTimeout(`https://api.sunoapi.org/api/v1/voice/record-info?taskId=${taskId}`, {
    headers: apiHeaders()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice record-info failed: ${res.status} - ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice record-info error: ${data.msg || 'Erro desconhecido'}`);
  }

  const record = data.data;
  return {
    taskId,
    voiceId: record?.voiceId || null,
    status: record?.status || 'unknown',
    errorCode: record?.errorCode,
    errorMessage: record?.errorMessage
  };
}

export async function waitForVoiceId(taskId: string, maxAttempts = 60): Promise<SunoVoiceRecordResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 5000));
    const result = await getVoiceRecord(taskId);
    if (result.status === 'success' && result.voiceId) {
      return result;
    }
    if (result.status === 'fail') {
      throw new Error(`Suno Voice creation failed: ${result.errorMessage || 'Erro desconhecido'}`);
    }
  }
  throw new Error(`Suno Voice creation timed out after ${maxAttempts} attempts`);
}

export async function checkVoiceAvailability(taskId: string): Promise<SunoVoiceCheckResult> {
  const res = await fetchWithTimeout('https://api.sunoapi.org/api/v1/voice/check-voice', {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ task_id: taskId })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice check-voice failed: ${res.status} - ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    isAvailable: data.data?.isAvailable === true
  };
}
