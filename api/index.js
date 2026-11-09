var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/config/env.ts
var env_exports = {};
__export(env_exports, {
  ENV: () => ENV,
  getEnv: () => getEnv,
  hasEnv: () => hasEnv,
  validateEnv: () => validateEnv
});
function validateEnv() {
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";
  }
  if (!process.env.SUNO_API_KEY && process.env.VITE_SUNO_API_KEY) {
    process.env.SUNO_API_KEY = process.env.VITE_SUNO_API_KEY;
  }
  if (!process.env.ADMIN_PASSWORD && process.env.VITE_ADMIN_PASSWORD) {
    process.env.ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD;
  }
  if (!process.env.JWT_SECRET && process.env.VITE_JWT_SECRET) {
    process.env.JWT_SECRET = process.env.VITE_JWT_SECRET;
  }
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const isTest = process.env.CI || process.env.NODE_ENV === "test";
    if (isTest) {
      console.warn(`[WARN] Variaveis de ambiente em falta no arranque: ${missing.join(", ")}`);
    } else {
      throw new Error(`[FATAL] Variaveis de ambiente obrigatorias em falta: ${missing.join(", ")}. Configure-as no .env ou no Vercel Dashboard.`);
    }
  }
  const hasDeepSeekKey = !!(process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_SECRET_KEY);
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY && !hasDeepSeekKey) {
    if (process.env.CI || process.env.NODE_ENV === "test") {
      console.warn("[WARN] Nenhuma chave de IA configurada (DEEPSEEK_API_KEY/DEEPSEEK_SECRET_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY ou GEMINI_API_KEY)");
      return;
    }
    console.warn("[WARN] Nenhuma chave de IA configurada \u2014 a gera\xE7\xE3o de letras n\xE3o funcionar\xE1.");
  }
}
function getEnv(key, fallback) {
  return process.env[key] || fallback || "";
}
function hasEnv(key) {
  return !!process.env[key];
}
var REQUIRED_ENV, ENV;
var init_env = __esm({
  "server/config/env.ts"() {
    "use strict";
    REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "SUNO_API_KEY", "BREVO_API_KEY", "ADMIN_PASSWORD", "JWT_SECRET"];
    ENV = {
      PORT: Number(process.env.PORT) || 3e3,
      NODE_ENV: process.env.NODE_ENV || "development",
      SUNO_API_KEY: process.env.SUNO_API_KEY || "",
      SUNO_COST_PER_CREDIT_USD: Number(process.env.SUNO_COST_PER_CREDIT_USD) || 5e-3,
      CLAUDE_COST_PER_GENERATION_USD: Number(process.env.CLAUDE_COST_PER_GENERATION_USD) || 0.03,
      OPENAI_COST_PER_GENERATION_USD: Number(process.env.OPENAI_COST_PER_GENERATION_USD) || 0.01,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
      MONTHLY_FIXED_COST_USD: Number(process.env.MONTHLY_FIXED_COST_USD) || 0,
      USD_TO_KZ_RATE: Number(process.env.USD_TO_KZ_RATE) || 1200
    };
  }
});

// server/utils/logger.ts
import pino from "pino";
import fs from "fs";
import path from "path";
async function ensureSentry() {
  if (sentryModule === null) {
    try {
      sentryModule = await import("@sentry/node");
    } catch {
      sentryModule = null;
    }
  }
  return sentryModule;
}
async function captureSentry(level, message, err, metadata) {
  const Sentry = await ensureSentry();
  if (!Sentry || typeof Sentry !== "object" || !("captureException" in Sentry)) return;
  const sentry = Sentry;
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const error = err instanceof Error ? err : new Error(String(err || message));
  sentry.captureException(error, {
    level: level === "fatal" ? "fatal" : "error",
    tags: { source: "pino" },
    extra: { ...meta, logMessage: message }
  });
}
function logInfo(message, metadata) {
  if (metadata && typeof metadata === "object") {
    logger.info(metadata, message);
  } else {
    logger.info(message);
  }
}
function logWarn(message, metadata) {
  if (metadata && typeof metadata === "object") {
    logger.warn(metadata, message);
  } else {
    logger.warn(message);
  }
}
function logError(message, error, metadata) {
  const errorObj = error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : { error: String(error) };
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  logger.error({ ...errorObj, ...meta }, message);
  captureSentry("error", message, error, metadata);
}
function logDebug(message, metadata) {
  if (metadata && typeof metadata === "object") {
    logger.debug(metadata, message);
  } else {
    logger.debug(message);
  }
}
function logHttp(message, metadata) {
  if (metadata && typeof metadata === "object") {
    logger.http(metadata, message);
  } else {
    logger.http(message);
  }
}
var customLevels, logsDir, canWriteLogs, isVercel, isProduction, isDev, defaultLogLevel, logger, sentryModule;
var init_logger = __esm({
  "server/utils/logger.ts"() {
    "use strict";
    customLevels = {
      fatal: 60,
      error: 50,
      warn: 40,
      info: 30,
      http: 25,
      debug: 20,
      trace: 10
    };
    logsDir = path.join(process.cwd(), "logs");
    canWriteLogs = false;
    try {
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      canWriteLogs = true;
    } catch {
      canWriteLogs = false;
    }
    isVercel = !!process.env.VERCEL;
    isProduction = process.env.NODE_ENV === "production";
    isDev = process.env.NODE_ENV !== "production" && !isVercel;
    defaultLogLevel = isProduction ? "info" : "debug";
    if (isVercel) {
      logger = pino({
        level: process.env.LOG_LEVEL || defaultLogLevel,
        customLevels,
        formatters: {
          level(label) {
            return { level: label };
          }
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: { service: "seubeat" }
      });
    } else if (isDev) {
      logger = pino({
        level: process.env.LOG_LEVEL || defaultLogLevel,
        customLevels,
        formatters: {
          level(label) {
            return { level: label };
          }
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: { service: "seubeat" }
      }, pino.transport({
        targets: [{
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname",
            singleLine: false
          }
        }]
      }));
    } else {
      const transports = [];
      if (canWriteLogs) {
        transports.push({
          target: "pino/file",
          options: { destination: path.join(logsDir, "error.log"), mkdir: true },
          level: "error"
        });
        transports.push({
          target: "pino/file",
          options: { destination: path.join(logsDir, "combined.log"), mkdir: true }
        });
      }
      logger = pino({
        level: process.env.LOG_LEVEL || defaultLogLevel,
        customLevels,
        formatters: {
          level(label) {
            return { level: label };
          }
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        base: { service: "seubeat" }
      }, pino.transport({ targets: transports }));
    }
    sentryModule = null;
  }
});

// server/services/supabase.ts
import { createClient } from "@supabase/supabase-js";
import fs2 from "fs";
function getSupabaseUrl() {
  return process.env.SUPABASE_URL || "";
}
function getAdminSupabase() {
  if (adminClient) return adminClient;
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n\xE3o configurada. O admin client n\xE3o pode ser inicializado.");
  }
  adminClient = createClient(url, key);
  return adminClient;
}
async function uploadToSupabase(bucket, filename, filePath, mimeType) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error("Supabase client n\xE3o inicializado para upload de fallback.");
  const fileBuffer = await fs2.promises.readFile(filePath);
  const { error } = await supabase.storage.from(bucket).upload(filename, fileBuffer, { contentType: mimeType, upsert: true });
  if (error) {
    throw new Error(`Falha no upload para Supabase Storage: ${error.message}`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}
var adminClient;
var init_supabase = __esm({
  "server/services/supabase.ts"() {
    "use strict";
    adminClient = null;
  }
});

// server/services/storage.ts
var storage_exports = {};
__export(storage_exports, {
  createSignedStorageUrl: () => createSignedStorageUrl,
  deleteStorageFile: () => deleteStorageFile,
  deleteStorageFiles: () => deleteStorageFiles,
  getPublicStorageUrl: () => getPublicStorageUrl,
  listStorageFiles: () => listStorageFiles,
  uploadFileToStorage: () => uploadFileToStorage
});
import fs3 from "fs";
import { Readable } from "stream";
function getEnv2(key, fallback = "") {
  return process.env[key] || fallback;
}
async function loadAwsSdk() {
  if (awsSdkModule) return awsSdkModule;
  if (awsSdkLoadAttempted) return null;
  awsSdkLoadAttempted = true;
  try {
    const s3 = await import("@aws-sdk/client-s3");
    const presigner = await import("@aws-sdk/s3-request-presigner");
    awsSdkModule = {
      S3Client: s3.S3Client,
      PutObjectCommand: s3.PutObjectCommand,
      DeleteObjectCommand: s3.DeleteObjectCommand,
      DeleteObjectsCommand: s3.DeleteObjectsCommand,
      GetObjectCommand: s3.GetObjectCommand,
      ListObjectsV2Command: s3.ListObjectsV2Command,
      getSignedUrl: presigner.getSignedUrl
    };
    return awsSdkModule;
  } catch (err) {
    logWarn("[Storage] M\xF3dulos AWS S3 SDK n\xE3o dispon\xEDveis no ambiente, a usar Supabase Storage como fallback:", err);
    return null;
  }
}
async function getR2Client() {
  const isTestEnv = process.env.NODE_ENV === "test" || !!process.env.VITEST;
  if (isTestEnv) return null;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  const sdk = await loadAwsSdk();
  if (!sdk) return null;
  if (!s3ClientInstance) {
    s3ClientInstance = new sdk.S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }
  return { client: s3ClientInstance, sdk };
}
function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicDomain };
}
async function uploadFileToStorage(bucket, filename, filePathOrBuffer, mimeType) {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  const r2 = await getR2Client();
  const { bucketName, publicDomain } = getR2Config();
  if (provider === "r2" && r2 && bucketName && publicDomain) {
    try {
      const objectKey = `${bucket}/${filename}`;
      const client = r2.client;
      const { Upload } = await import("@aws-sdk/lib-storage");
      const body = typeof filePathOrBuffer === "string" ? fs3.createReadStream(filePathOrBuffer) : Buffer.isBuffer(filePathOrBuffer) ? Readable.from(filePathOrBuffer) : filePathOrBuffer;
      const upload = new Upload({
        client,
        params: {
          Bucket: bucketName,
          Key: objectKey,
          Body: body,
          ContentType: mimeType
        },
        queueSize: 1,
        partSize: 10 * 1024 * 1024
      });
      await upload.done();
      const baseUrl = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
      const publicUrl = `${baseUrl}/${objectKey}`;
      logInfo("[Storage] Ficheiro enviado com sucesso para Cloudflare R2", { bucket, filename, url: publicUrl });
      return publicUrl;
    } catch (err) {
      logError("[Storage] Falha ao enviar para Cloudflare R2, a recorrer ao Supabase Storage", err, {
        bucket,
        filename,
        r2Account: getEnv2("R2_ACCOUNT_ID") ? `${getEnv2("R2_ACCOUNT_ID").slice(0, 6)}...` : "(missing)",
        bucketName
      });
    }
  } else {
    logInfo("[Storage] Fallback para Supabase Storage", { provider, r2Client: !!r2, bucketName: !!bucketName, publicDomain: !!publicDomain });
  }
  if (typeof filePathOrBuffer === "string") {
    return await uploadToSupabase(bucket, filename, filePathOrBuffer, mimeType);
  } else {
    const tempPath = `./tmp_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await fs3.promises.writeFile(tempPath, filePathOrBuffer);
    try {
      return await uploadToSupabase(bucket, filename, tempPath, mimeType);
    } finally {
      await fs3.promises.unlink(tempPath).catch(() => {
      });
    }
  }
}
async function createSignedStorageUrl(bucket, filename, expiresInSeconds = 3600) {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();
  if (provider === "r2" && r2 && bucketName) {
    try {
      const objectKey = `${bucket}/${filename}`;
      const command = new r2.sdk.GetObjectCommand({ Bucket: bucketName, Key: objectKey });
      const client = r2.client;
      const signedUrl = await r2.sdk.getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      logInfo("[Storage] URL assinada gerada para R2", { bucket, filename });
      return signedUrl;
    } catch (err) {
      logError("[Storage] Falha ao gerar URL assinada R2", err, { bucket, filename });
    }
  }
  try {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient2(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filename, expiresInSeconds);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  } catch (err) {
    logError("[Storage] Fallback Supabase signed URL falhou", err, { bucket, filename });
  }
  return null;
}
async function deleteStorageFiles(bucket, filenames) {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();
  if (provider === "r2" && r2 && bucketName && filenames.length > 0) {
    try {
      const objects = filenames.map((f) => ({ Key: `${bucket}/${f}` }));
      const client = r2.client;
      await client.send(new r2.sdk.DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects }
      }));
      logInfo("[Storage] Ficheiros removidos do R2", { bucket, count: filenames.length });
      return;
    } catch (err) {
      logError("[Storage] Falha ao remover ficheiros do R2", err, { bucket, filenames });
    }
  }
  try {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient2(supabaseUrl, supabaseKey);
      const { error } = await supabase.storage.from(bucket).remove(filenames);
      if (error) throw error;
      logInfo("[Storage] Ficheiros removidos do Supabase (fallback)", { bucket, count: filenames.length });
    }
  } catch (err) {
    logError("[Storage] Fallback Supabase delete falhou", err, { bucket, filenames });
  }
}
async function deleteStorageFile(bucket, filename) {
  await deleteStorageFiles(bucket, [filename]);
}
async function listStorageFiles(bucket, prefix = "") {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  const r2 = await getR2Client();
  const { bucketName } = getR2Config();
  if (provider === "r2" && r2 && bucketName) {
    try {
      const command = new r2.sdk.ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: `${bucket}/${prefix}`
      });
      const client = r2.client;
      const response = await client.send(command);
      if (response.Contents) {
        return response.Contents.map((obj) => ({
          name: obj.Key?.replace(`${bucket}/`, "") || "",
          size: obj.Size || 0,
          lastModified: obj.LastModified || /* @__PURE__ */ new Date()
        }));
      }
      return [];
    } catch (err) {
      logError("[Storage] Falha ao listar ficheiros R2", err, { bucket, prefix });
    }
  }
  try {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient2(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.storage.from(bucket).list(prefix);
      if (error) throw error;
      return (data || []).map((f) => ({
        name: f.name,
        size: f.metadata?.size || 0,
        lastModified: f.updated_at ? new Date(f.updated_at) : /* @__PURE__ */ new Date()
      }));
    }
  } catch (err) {
    logError("[Storage] Fallback Supabase list falhou", err, { bucket, prefix });
  }
  return [];
}
async function getPublicStorageUrl(bucket, filename) {
  const provider = (process.env.STORAGE_PROVIDER || "r2").toLowerCase();
  const { bucketName, publicDomain } = getR2Config();
  if (provider === "r2" && bucketName && publicDomain) {
    const objectKey = `${bucket}/${filename}`;
    const baseUrl = publicDomain.endsWith("/") ? publicDomain.slice(0, -1) : publicDomain;
    return `${baseUrl}/${objectKey}`;
  }
  try {
    const { createClient: createClient2 } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient2(supabaseUrl, supabaseKey);
      const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
      return data?.publicUrl || null;
    }
  } catch (err) {
    logError("[Storage] Fallback Supabase public URL falhou", err, { bucket, filename });
  }
  return null;
}
var awsSdkModule, awsSdkLoadAttempted, s3ClientInstance;
var init_storage = __esm({
  "server/services/storage.ts"() {
    "use strict";
    init_supabase();
    init_logger();
    awsSdkModule = null;
    awsSdkLoadAttempted = false;
    s3ClientInstance = null;
  }
});

// server/utils/helpers.ts
import pg from "pg";
function logRouteError(req, err, extra) {
  const method = req?.method || "?";
  const url = req?.originalUrl || req?.url || "?";
  const readable = err instanceof Error ? err : new Error(
    typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err)
  );
  logError(`[Route:${method} ${url}]`, readable, extra);
}
function publicErrorMessage(err, fallback = "N\xE3o foi poss\xEDvel concluir esta etapa. Tente novamente em instantes.") {
  const message = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err ?? "");
  if (/ANTHROPIC_API_KEY/i.test(message)) {
    return "A gera\xE7\xE3o de letras est\xE1 temporariamente indispon\xEDvel (Erro de Configura\xE7\xE3o do Claude).";
  }
  if (/OPENAI_API_KEY/i.test(message)) {
    return "A gera\xE7\xE3o de letras est\xE1 temporariamente indispon\xEDvel (Erro de Configura\xE7\xE3o do OpenAI).";
  }
  if (/Nenhuma chave de API de IA configurada/i.test(message)) {
    return "A gera\xE7\xE3o de letras est\xE1 temporariamente indispon\xEDvel (Nenhuma chave de IA configurada).";
  }
  if (/CLAUDE_MODEL/i.test(message)) {
    return "A configura\xE7\xE3o do modelo de gera\xE7\xE3o de letras est\xE1 incorreta. Por favor, contacte o suporte.";
  }
  if (/SUNO_API_KEY/i.test(message)) {
    return "A gera\xE7\xE3o de m\xFAsica est\xE1 temporariamente indispon\xEDvel (Erro de Configura\xE7\xE3o Suno).";
  }
  if (/upload.*falhou|falhou.*upload/i.test(message)) {
    return "Houve um erro ao enviar o ficheiro. Verifique a sua liga\xE7\xE3o e tente novamente.";
  }
  if (/unique.*constraint|duplicate key|already exists/i.test(message)) {
    return "Este pagamento j\xE1 foi registado. Se precisar de alterar algo, contacte o suporte.";
  }
  if (/Supabase|database|DB|song_requests|songs|users|registrar.*banco.*dados|registar.*banco.*dados|banco de dados|row-level|violates|RLS|postgrest|permission denied|relation|row.*security|policy|foreign key/i.test(message)) {
    return "Houve um erro ao guardar os seus dados. Por favor, verifique a sua liga\xE7\xE3o e tente novamente.";
  }
  if (/timeout|excedeu|timed out|ETIMEDOUT|The operation was aborted|AbortError|TimeoutError/i.test(message)) {
    return "O sistema demorou demasiado tempo a responder. Talvez a nossa IA esteja com muito tr\xE1fego. Tente novamente.";
  }
  if (/500|502|503|504|high demand|traffic|tráfego|overloaded|RESOURCE_EXHAUSTED|temporarily|too many requests|muita procura|muito tráfego/i.test(message)) {
    return "Estamos com muita procura neste momento. Tente novamente em instantes.";
  }
  if (/malformada|JSON|unexpected|malformed/i.test(message)) {
    return "A IA gerou uma resposta incompleta. Por favor, tente novamente para obter uma letra perfeita.";
  }
  if (/quota|limit|429|rate limit|credit.*balance|too low|insufficient.*credit/i.test(message)) {
    return "O saldo de cr\xE9ditos da API de gera\xE7\xE3o de letras est\xE1 esgotado. Contacte a equipa SeuBeat para recarregar.";
  }
  if (/401|403|authentication|unauthorized|api.key|invalid.*key/i.test(message)) {
    return "A gera\xE7\xE3o de letras est\xE1 temporariamente indispon\xEDvel (Erro de autentica\xE7\xE3o com servi\xE7o externo).";
  }
  if (/photos?.*bucket|storage.*bucket|not found|no such bucket/i.test(message)) {
    return "Houve um erro ao guardar a foto. Contacte o suporte se o problema persistir.";
  }
  if (/demasiado grande|demasiado pequena|excede.*(5|10)MB/i.test(message)) {
    return "A foto excede o tamanho m\xE1ximo permitido (10MB). Use um compressor de imagens online ou escolha uma foto menor.";
  }
  if (/carregar a foto/i.test(message)) {
    return "N\xE3o foi poss\xEDvel carregar a foto. Tente com uma imagem diferente (JPG, PNG ou WebP).";
  }
  if (/perfil|criar o seu|nao foi possivel preparar/i.test(message)) {
    return "N\xE3o foi poss\xEDvel criar o seu perfil. O email informado j\xE1 est\xE1 registado. Tente com outro email ou contacte o suporte.";
  }
  if (/nao suportado/i.test(message)) {
    return "Formato de imagem n\xE3o suportado. Use JPG, PNG, WebP ou HEIC.";
  }
  if (/obrigatório|email é obrigatório/i.test(message)) {
    return "O email \xE9 obrigat\xF3rio para continuar. Verifique se o preencheu corretamente no passo final.";
  }
  if (/guarda-la|atualizar o estado/i.test(message)) {
    return "A letra foi gerada mas ocorreu um erro ao salvar. Tente novamente \u2014 se o erro persistir, contacte o suporte.";
  }
  if (/fetch fail|ECONNREFUSED|ENETUNREACH|ENOTFOUND|ECONNRESET|network.*socket|Client network|connect.*fail/i.test(message)) {
    return "O sistema n\xE3o conseguiu contactar os servidores de IA. Verifique a sua liga\xE7\xE3o \xE0 internet e tente novamente.";
  }
  if (/GEMINI_API_KEY|GoogleGenAI|google.*genai|genai.*error/i.test(message)) {
    return "A verifica\xE7\xE3o do comprovativo est\xE1 temporariamente indispon\xEDvel. O pagamento ser\xE1 revisto manualmente pela equipa.";
  }
  if (/NoSuchBucket|AccessDenied|Access Denied|EntityTooLarge|SignatureDoesNotMatch|InvalidAccessKey|MissingAuth|aws.*s3|r2\.cloudflarestorage/i.test(message)) {
    return "Houve um erro ao guardar o comprovativo. Verifique a sua liga\xE7\xE3o e tente novamente.";
  }
  if (/Cannot read|TypeError|ReferenceError|is not a function|is not defined|null.*property|undefined.*property/i.test(message)) {
    return "Ocorreu um erro interno ao processar o pagamento. A sua seguran\xE7a n\xE3o foi comprometida \u2014 tente novamente ou contacte o suporte.";
  }
  if (/ENOSPC|disk.*full|no space|quota.*exceed/i.test(message)) {
    return "O sistema est\xE1 temporariamente sem espa\xE7o. Tente novamente em instantes.";
  }
  if (/invalid input|violates|constraint|not-null|unique.*constraint|check.*constraint|numeric.*out.*range/i.test(message)) {
    return "Dados de pagamento inv\xE1lidos. Verifique o comprovativo e tente novamente.";
  }
  return message.length > 0 && message.length < 200 ? `Erro ao processar pagamento: ${message}` : fallback;
}
function getAudioFileInfo(audioUrl) {
  const cleanUrl = audioUrl.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".wav")) return { ext: "wav", mimeType: "audio/wav" };
  if (cleanUrl.endsWith(".mp3")) return { ext: "mp3", mimeType: "audio/mpeg" };
  if (cleanUrl.endsWith(".m4a")) return { ext: "m4a", mimeType: "audio/mp4" };
  if (cleanUrl.endsWith(".ogg")) return { ext: "ogg", mimeType: "audio/ogg" };
  return { ext: "flac", mimeType: "audio/flac" };
}
function getAppUrl(req) {
  if (req) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  return process.env.APP_URL || "https://seubeat.vercel.app";
}
function sanitizePaymentAmount(rawAmount, plan) {
  if (ALLOWED_PAYMENT_AMOUNTS[plan]?.has(rawAmount)) return rawAmount;
  const fallback = PLAN_BASE_PRICES[plan] ?? PLAN_BASE_PRICES.standard;
  logWarn("[payments] amount fora do cat\xE1logo \u2014 a usar o pre\xE7o base do plano", { rawAmount, plan, fallback });
  return fallback;
}
function toCamelCase(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[camelKey] = toCamelCase(value);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((v) => v && typeof v === "object" ? toCamelCase(v) : v);
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}
var PLAN_BASE_PRICES, ADDON_PRICES, ALLOWED_PAYMENT_AMOUNTS;
var init_helpers = __esm({
  "server/utils/helpers.ts"() {
    "use strict";
    init_logger();
    init_env();
    PLAN_BASE_PRICES = { standard: 7900, express: 9900, premium: 14900 };
    ADDON_PRICES = [0, 1500, 2500, 4e3];
    ALLOWED_PAYMENT_AMOUNTS = Object.fromEntries(
      Object.entries(PLAN_BASE_PRICES).map(([plan, base]) => [plan, new Set(ADDON_PRICES.map((addon) => base + addon))])
    );
  }
});

// server/services/email/config.ts
function parseEmail(raw) {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
  if (match) {
    return { name: (match[1] || "").trim(), email: match[2] };
  }
  return { name: "", email: raw.trim() };
}
function getConfig() {
  const rawFrom = process.env.EMAIL_FROM || "josuemiguelsued@gmail.com";
  const parsed = parseEmail(rawFrom);
  return {
    apiKey: process.env.BREVO_API_KEY || "",
    fromName: process.env.EMAIL_FROM_NAME || parsed.name || "SeuBeat",
    fromEmail: parsed.email
  };
}
function warnIfMissing(cfg) {
  if (!cfg.apiKey) {
    logWarn("BREVO_API_KEY n\xE3o configurada. Simulando envio de email.");
    return true;
  }
  return false;
}
function getAdminEmail() {
  return process.env.ADMIN_EMAIL || "suporte@seubeat.ao";
}
var init_config = __esm({
  "server/services/email/config.ts"() {
    "use strict";
    init_logger();
  }
});

// server/services/email/transport.ts
async function sendViaBrevo(to, subject, htmlContent) {
  const cfg = getConfig();
  if (warnIfMissing(cfg)) return { mocked: true, to };
  const body = JSON.stringify({
    sender: { name: cfg.fromName, email: cfg.fromEmail },
    to: [{ email: to }],
    subject,
    htmlContent
  });
  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "api-key": cfg.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body
  });
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Brevo API error (${res.status}): ${errorBody}`);
  }
  return res.json();
}
async function sendWithRetry(to, subject, htmlContent) {
  try {
    return await sendViaBrevo(to, subject, htmlContent);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCode = err instanceof Error && "code" in err ? err.code : void 0;
    const isTimeout = errCode === "ETIMEDOUT" || errCode === "UND_ERR_CONNECT_TIMEOUT" || errMsg.includes("timed out");
    if (isTimeout) {
      logError("[Email] Timeout na 1a tentativa, a tentar novamente...", err instanceof Error ? err : new Error(String(err)), { to });
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      return sendViaBrevo(to, subject, htmlContent);
    }
    logError("[Email] Falha ao enviar email", err instanceof Error ? err : new Error(errMsg), { to, subject });
    throw err;
  }
}
var BREVO_API_URL;
var init_transport = __esm({
  "server/services/email/transport.ts"() {
    "use strict";
    init_logger();
    init_config();
    BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
  }
});

// server/services/email/htmlUtils.ts
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function safeStr(val, fallback = "") {
  return escapeHtml(val || fallback);
}
var init_htmlUtils = __esm({
  "server/services/email/htmlUtils.ts"() {
    "use strict";
  }
});

// server/services/email/delivery.ts
async function sendPersonalizedEmail(emailAddress, recipientName, personalizedUrl, letterText) {
  const safeRecipient = safeStr(recipientName);
  const safeLetter = safeStr(letterText);
  const letterSnippet = safeLetter.length > 280 ? safeLetter.substring(0, 280) + "\u2026" : safeLetter;
  const referralUrl = `${personalizedUrl}&ref=${encodeURIComponent(safeRecipient.split(" ")[0] || "amigo")}`;
  const waShareText = encodeURIComponent(`Fiz uma m\xFAsica personalizada para ${safeStr(recipientName)} no SeuBeat! Experimenta tu tamb\xE9m \u2192 ${getAppUrl()}`);
  return sendWithRetry(emailAddress, `A m\xFAsica para ${safeStr(recipientName.split(" ")[0] || "si")} est\xE1 pronta \u2014 SeuBeat`, `
    <!DOCTYPE html>
    <html lang="pt">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0b0a09;">
    <div style="font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0b0a09;color:#e7e5e4;max-width:600px;margin:0 auto;border-radius:20px;overflow:hidden;border:1px solid #292524;">

      <!-- Hero gradient header -->
      <div style="background:linear-gradient(135deg,#1c1410 0%,#2d1a0a 50%,#1a0f1e 100%);padding:48px 32px 40px;text-align:center;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#db2777,#a855f7);"></div>
        <div style="width:72px;height:72px;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="font-family:Georgia,serif;font-size:30px;line-height:1;color:#f59e0b;">\u266A</span>
        </div>
        <h1 style="font-family:Georgia,serif;color:#f59e0b;font-size:28px;margin:0 0 10px;font-weight:800;letter-spacing:-0.5px;">
          A sua m\xFAsica est\xE1 pronta!
        </h1>
        <p style="font-size:15px;color:#d6d3d1;margin:0;line-height:1.6;max-width:420px;display:inline-block;">
          Criada exclusivamente para <strong style="color:#fbbf24;">${safeRecipient}</strong> com todo o carinho do mundo.
        </p>
      </div>

      <!-- Lyrics teaser card -->
      <div style="padding:32px 32px 0;">
        <div style="background:#1c1917;border:1px solid #44403c;border-radius:14px;padding:22px 24px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,#f59e0b,#db2777);border-radius:2px 0 0 2px;"></div>
          <span style="font-size:10px;font-family:monospace;color:#f59e0b;display:block;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;">\u2726 TRECHO DA DEDICAT\xD3RIA</span>
          <p style="font-size:14px;font-style:italic;color:#d6d3d1;line-height:1.7;margin:0;">
            "${letterSnippet}"
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="padding:32px;text-align:center;">
        <a href="${personalizedUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:14px;box-shadow:0 6px 20px rgba(217,119,6,0.35);letter-spacing:0.3px;">
          Ouvir a M\xFAsica Agora
        </a>
        <p style="font-size:12px;color:#78716c;margin:12px 0 0;">Toque no bot\xE3o para aceder \xE0 sua dedicat\xF3ria exclusiva</p>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#292524,transparent);margin:0 32px;"></div>

      <!-- Referral section -->
      <div style="padding:28px 32px;background:#111010;text-align:center;">
        <p style="font-size:13px;color:#a8a29e;margin:0 0 16px;line-height:1.6;">
          <strong style="color:#e7e5e4;">Adorou o resultado?</strong> Partilhe a experi\xEAncia com amigos \u2014 eles v\xE3o adorar criar a m\xFAsica deles tamb\xE9m!
        </p>
        <a href="https://wa.me/?text=${waShareText}" target="_blank" style="display:inline-block;background:#16a34a;color:#fff;font-weight:700;font-size:13px;text-decoration:none;padding:11px 24px;border-radius:10px;margin-right:8px;">
          Partilhar no WhatsApp
        </a>
        <a href="${getAppUrl()}" target="_blank" style="display:inline-block;background:#292524;color:#e7e5e4;font-weight:700;font-size:13px;text-decoration:none;padding:11px 24px;border-radius:10px;border:1px solid #44403c;">
          Criar Nova M\xFAsica
        </a>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;text-align:center;border-top:1px solid #1c1917;">
        <p style="font-size:11px;color:#57534e;margin:0;line-height:1.8;">
          SeuBeat Est\xFAdio Angola \xB7 Eternizando momentos com melodias inesquec\xEDveis.<br>
          Precisa de ajuda? Responda a este email ou contacte-nos em suporte@seubeat.ao
        </p>
      </div>

    </div>
    </body>
    </html>
  `);
}
var init_delivery = __esm({
  "server/services/email/delivery.ts"() {
    "use strict";
    init_helpers();
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/payment.ts
async function sendPaymentRejectionEmail(userEmail, notes) {
  return sendWithRetry(userEmail, "Verifica\xE7\xE3o de comprovativo \u2014 SeuBeat", `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">Comprovativo n\xE3o validado</h2>
      <p>N\xE3o conseguimos validar o seu comprovativo de pagamento.</p>
      ${notes ? `<p>Motivo: <strong>${safeStr(notes)}</strong></p>` : ""}
      <p>Por favor, submeta novamente ou contacte-nos em suporte@seubeat.ao para assist\xEAncia.</p>
    </div>
  `);
}
var init_payment = __esm({
  "server/services/email/payment.ts"() {
    "use strict";
    init_transport();
    init_htmlUtils();
    init_helpers();
  }
});

// server/services/email/transactional.ts
async function sendConfirmationEmail(emailAddress, recipientName, requestId, context) {
  const isSongReady = context === "standard_approved";
  const heading = isSongReady ? "Pagamento aprovado!" : "Pedido Recebido!";
  const body = isSongReady ? `A sua m\xFAsica personalizada para <strong>${safeStr(recipientName)}</strong> j\xE1 foi gerada com sucesso. Ser\xE1 entregue no seu email dentro de 24h ap\xF3s a confirma\xE7\xE3o do pagamento. Fique atento!` : `Recebemos o seu pedido de m\xFAsica personalizada para <strong>${safeStr(recipientName)}</strong>.`;
  const footer = isSongReady ? "SeuBeat Est\xFAdio Angola \u2014 A sua m\xFAsica ser\xE1 entregue em breve." : "A nossa equipa j\xE1 est\xE1 a trabalhar na sua can\xE7\xE3o. Receber\xE1 outro email assim que a m\xFAsica estiver pronta para ouvir e partilhar.";
  return sendWithRetry(emailAddress, isSongReady ? "Pagamento aprovado \u2014 SeuBeat" : "Pedido recebido \u2014 SeuBeat", `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0b0a09; color: #e7e5e4; padding: 40px 20px; text-align: center; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #292524;">
      <div style="margin-bottom: 24px;">
        <span style="font-family:Georgia,serif;font-size:30px;line-height:1;color:#f59e0b;">\u266A</span>
      </div>
      <h1 style="font-family: serif; color: #f59e0b; font-size: 26px; margin-bottom: 12px; font-weight: 800;">
        ${heading}
      </h1>
      <p style="font-size: 15px; color: #d6d3d1; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        ${body}
      </p>
      <div style="background-color: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px;">
        <span style="font-size: 10px; font-family: monospace; color: #f59e0b; display: block; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">ID do Pedido</span>
        <p style="font-size: 13px; font-family: monospace; color: #a8a29e; line-height: 1.5; margin: 0;">
          ${safeStr(requestId)}
        </p>
      </div>
      <p style="font-size: 13px; color: #a8a29e; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        ${footer}
      </p>
      <p style="font-size: 12px; color: #78716c; margin-top: 32px; border-top: 1px solid #1c1917; padding-top: 20px;">
        SeuBeat Est\xFAdio Angola \u2014 Eternizando momentos com melodias inesquec\xEDveis.
      </p>
    </div>
  `);
}
var init_transactional = __esm({
  "server/services/email/transactional.ts"() {
    "use strict";
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/recovery.ts
var init_recovery = __esm({
  "server/services/email/recovery.ts"() {
    "use strict";
    init_helpers();
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/admin.ts
async function sendAdminNotification(subject, message) {
  const adminEmails = getAdminEmail().split(",").map((e) => e.trim()).filter(Boolean);
  for (const email of adminEmails) {
    await sendWithRetry(email, `[SeuBeat Admin] ${subject}`, `
      <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:600px;margin:0 auto">
        <h2 style="color:#ef4444">Notifica\xE7\xE3o do Sistema</h2>
        <pre style="background:#1c1917;color:#d6d3d1;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</pre>
      </div>
    `).catch((err) => logError("[Email] Falha ao notificar admin", err instanceof Error ? err : new Error(String(err)), { email }));
  }
}
var init_admin = __esm({
  "server/services/email/admin.ts"() {
    "use strict";
    init_logger();
    init_transport();
    init_htmlUtils();
    init_config();
  }
});

// server/services/email/abandonment.ts
var init_abandonment = __esm({
  "server/services/email/abandonment.ts"() {
    "use strict";
    init_helpers();
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/followup.ts
var init_followup = __esm({
  "server/services/email/followup.ts"() {
    "use strict";
    init_helpers();
    init_transport();
  }
});

// server/services/email/error.ts
async function sendWorkflowFailedEmail(userEmail, recipientName) {
  return sendWithRetry(userEmail, "A sua m\xFAsica est\xE1 em pausa \u2014 SeuBeat", `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">A sua m\xFAsica est\xE1 em pausa</h2>
      <p>Ol\xE1 ${safeStr(recipientName || "Cliente")},</p>
      <p>Ocorreu um erro inesperado ao gerar a sua m\xFAsica. A nossa equipa j\xE1 foi notificada e estamos a trabalhar para resolver o mais r\xE1pido poss\xEDvel.</p>
      <p>N\xE3o se preocupe \u2014 o seu pagamento ser\xE1 revertido e n\xE3o ser\xE1 cobrado. Entraremos em contacto por este email em breve.</p>
      <p style="color:#78716c;font-size:12px;margin-top:24px;">SeuBeat Est\xFAdio Angola</p>
    </div>
  `);
}
var init_error = __esm({
  "server/services/email/error.ts"() {
    "use strict";
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/upsell.ts
async function sendVideoUpsellOfferEmail(userEmail, recipientName, songTitle, upsellUrl) {
  const safeName = safeStr(recipientName || "Cliente");
  const safeTitle = safeStr(songTitle || "a tua m\xFAsica");
  return sendWithRetry(userEmail, `Transforma "${safeTitle}" num Videoclipe Emocional \u2014 SeuBeat`, `
    <!DOCTYPE html>
    <html lang="pt">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0b0a09;">
    <div style="font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0b0a09;color:#e7e5e4;max-width:600px;margin:0 auto;border-radius:20px;overflow:hidden;border:1px solid #292524;">

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1c1410 0%,#2d1a0a 50%,#1a0f1e 100%);padding:48px 32px 40px;text-align:center;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#db2777,#a855f7);"></div>
        <div style="width:72px;height:72px;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="font-family:Georgia,serif;font-size:26px;line-height:1;color:#f59e0b;">\u25BA</span>
        </div>
        <h1 style="font-family:Georgia,serif;color:#f59e0b;font-size:26px;margin:0 0 10px;font-weight:800;letter-spacing:-0.5px;">
          Transforma a tua m\xFAsica num Videoclipe
        </h1>
        <p style="font-size:15px;color:#d6d3d1;margin:0;line-height:1.6;max-width:420px;display:inline-block;">
          <strong style="color:#fbbf24;">${safeTitle}</strong> pode ganhar vida com fotos e v\xEDdeos pessoais.
        </p>
      </div>

      <!-- Offer card -->
      <div style="padding:32px 32px 0;">
        <div style="background:#1c1917;border:1px solid #44403c;border-radius:14px;padding:22px 24px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,#db2777,#a855f7);border-radius:2px 0 0 2px;"></div>
          <span style="font-size:10px;font-family:monospace;color:#db2777;display:block;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;">\u2726 OFERTA EXCLUSIVA</span>
          <p style="font-size:14px;color:#d6d3d1;line-height:1.7;margin:0;">
            Ol\xE1 ${safeName}! A tua m\xFAsica <strong>"${safeTitle}"</strong> est\xE1 pronta.
            Queres transform\xE1-la num <strong>Videoclipe Emocional</strong> com as tuas fotos e v\xEDdeos pessoais por apenas <strong style="color:#fbbf24;">2.900 Kz</strong>?
          </p>
          <p style="font-size:13px;color:#a8a29e;margin:12px 0 0;line-height:1.6;">
            <em>M\xFAsica + Fotos/V\xEDdeos = Um presente inesquec\xEDvel</em>
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="padding:32px;text-align:center;">
        <a href="${upsellUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#db2777,#a855f7);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:14px;box-shadow:0 6px 20px rgba(219,39,119,0.35);letter-spacing:0.3px;">
          Quero o Videoclipe \u2014 2.900 Kz
        </a>
        <p style="font-size:12px;color:#78716c;margin:12px 0 0;">Pagamento seguro via Multicaixa Express ou Refer\xEAncia</p>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;text-align:center;border-top:1px solid #1c1917;">
        <p style="font-size:11px;color:#57534e;margin:0;line-height:1.8;">
          SeuBeat Est\xFAdio Angola \xB7 Eternizando momentos com melodias inesquec\xEDveis.<br>
          Precisa de ajuda? Responda a este email ou contacte-nos em suporte@seubeat.ao
        </p>
      </div>

    </div>
    </body>
    </html>
  `);
}
var init_upsell = __esm({
  "server/services/email/upsell.ts"() {
    "use strict";
    init_transport();
    init_htmlUtils();
  }
});

// server/services/email/index.ts
var init_email = __esm({
  "server/services/email/index.ts"() {
    "use strict";
    init_delivery();
    init_payment();
    init_transactional();
    init_recovery();
    init_admin();
    init_abandonment();
    init_followup();
    init_error();
    init_upsell();
  }
});

// server/services/whatsapp/config.ts
function isConfigured() {
  return Boolean(API_TOKEN && PHONE_NUMBER_ID);
}
async function getWhatsAppAppUrl(phone, text = "") {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
async function getLinkStatus() {
  return { linked: isConfigured(), phone: isConfigured() ? WHATSAPP_PHONE : null };
}
var GRAPH_API_VERSION, API_TOKEN, PHONE_NUMBER_ID, WHATSAPP_PHONE, DAILY_CAP, START_HOUR, END_HOUR, MIN_SEND_DELAY_MS, MAX_SEND_DELAY_MS;
var init_config2 = __esm({
  "server/services/whatsapp/config.ts"() {
    "use strict";
    GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v21.0";
    API_TOKEN = process.env.WHATSAPP_API_TOKEN || "";
    PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    WHATSAPP_PHONE = process.env.WHATSAPP_PHONE || "244922058136";
    DAILY_CAP = Number(process.env.WHATSAPP_DAILY_CAP || 30);
    START_HOUR = Number(process.env.WHATSAPP_START_HOUR || 9);
    END_HOUR = Number(process.env.WHATSAPP_END_HOUR || 20);
    MIN_SEND_DELAY_MS = Number(process.env.WHATSAPP_MIN_SEND_DELAY_MS || 3e3);
    MAX_SEND_DELAY_MS = Number(process.env.WHATSAPP_MAX_SEND_DELAY_MS || 8e3);
  }
});

// server/services/whatsapp/sendLog.ts
async function insertSendLog(row) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  const bucket = row.bucket || "manual";
  try {
    const { error } = await supabase.from("whatsapp_send_log").insert({
      request_id: row.requestId,
      phone: row.phone,
      bucket,
      status: row.status,
      error: row.error || null,
      message_id: row.messageId || null,
      template_name: row.templateName || null
    });
    if (error) {
      logError("[WhatsApp] Falha ao registar log", new Error(error.message || "insertSendLog falhou"), {
        requestId: row.requestId,
        bucket,
        status: row.status,
        code: error.code
      });
    }
  } catch (err) {
    logError("[WhatsApp] Erro ao registar log", err instanceof Error ? err : new Error(String(err)));
  }
}
async function markContacted(requestId) {
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase.from("song_requests").update({ manual_contacted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId);
  } catch (err) {
    logError("[WhatsApp] Erro ao marcar contacto", err instanceof Error ? err : new Error(String(err)));
  }
}
async function markBucketSent(requestId, bucket) {
  const flag = WHATSAPP_FLAG_BY_BUCKET[bucket];
  if (!flag) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  try {
    await supabase.from("song_requests").update({ [flag]: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId);
  } catch (err) {
    logError("[WhatsApp] Erro ao marcar flag de envio", err instanceof Error ? err : new Error(String(err)));
  }
}
async function getDailySentCount() {
  const supabase = getAdminSupabase();
  if (!supabase) return 0;
  const startOfDay = /* @__PURE__ */ new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase.from("whatsapp_send_log").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", startOfDay.toISOString());
  if (error) return 0;
  return count || 0;
}
async function countFailedAttempts(requestId, bucket) {
  const supabase = getAdminSupabase();
  if (!supabase) return 0;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString();
  try {
    const { count, error } = await supabase.from("whatsapp_send_log").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("bucket", bucket || "manual").eq("status", "failed").gte("sent_at", since);
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}
async function hasBucketLog(requestId, bucket) {
  const supabase = getAdminSupabase();
  if (!supabase) return false;
  try {
    const { count, error } = await supabase.from("whatsapp_send_log").select("id", { count: "exact", head: true }).eq("request_id", requestId).eq("bucket", bucket || "manual");
    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
}
var WHATSAPP_FLAG_BY_BUCKET;
var init_sendLog = __esm({
  "server/services/whatsapp/sendLog.ts"() {
    "use strict";
    init_supabase();
    init_logger();
    WHATSAPP_FLAG_BY_BUCKET = {
      "30min": "whatsapp_30min_sent_at",
      "24h": "whatsapp_24h_sent_at",
      "48h": "whatsapp_48h_sent_at",
      "72h": "whatsapp_72h_sent_at"
    };
  }
});

// server/services/whatsapp/errors.ts
function mapWhatsAppApiError(status2, body) {
  const obj = body && typeof body === "object" ? body : null;
  const error = obj?.error || null;
  const code = typeof error?.code === "number" ? error.code : void 0;
  const apiMessage = typeof error?.message === "string" ? error.message : "";
  const details = error?.error_data && typeof error.error_data?.details === "string" ? error.error_data.details : "";
  if (status2 === 401 || status2 === 403) {
    return { code, message: "Token da WhatsApp API inv\xE1lido ou sem permiss\xE3o. Verifica WHATSAPP_API_TOKEN." };
  }
  switch (code) {
    case 131030:
      return { code, message: "N\xFAmero sem WhatsApp ativo." };
    case 132e3:
    case 132001:
    case 132012:
      return { code, message: `Template ainda n\xE3o aprovado ou em revis\xE3o (${apiMessage}). Aprova-o na Meta Business.` };
    case 131047:
    case 131026:
      return { code, message: "Par\xE2metros do template inv\xE1lidos (nome/link)." };
    case 131042:
      return { code, message: "Formato do n\xFAmero inv\xE1lido." };
    case 130429:
      return { code, message: "Limite de pedidos da WhatsApp API excedido (rate limit)." };
    case 368:
      return { code, message: `N\xFAmero bloqueado temporariamente (demasiados pedidos de verifica\xE7\xE3o). Aguarda 24h ou contacta suporte Meta. [${apiMessage}]` };
    case 33:
      return { code, message: `N\xFAmero n\xE3o eleg\xEDvel para verifica\xE7\xE3o nesta regi\xE3o. [${apiMessage}]` };
    case 100:
      return { code, message: `Par\xE2metro inv\xE1lido na verifica\xE7\xE3o. O n\xFAmero pode n\xE3o suportar SMS/voz. [${apiMessage}]` };
    default:
      return { code, message: details || apiMessage || `Erro WhatsApp API (${status2}).` };
  }
}
var init_errors = __esm({
  "server/services/whatsapp/errors.ts"() {
    "use strict";
  }
});

// server/services/whatsapp/verification.ts
function setCachedVerificationStatus(status2) {
  cachedVerificationStatus = status2;
  cachedVerificationAt = status2 ? Date.now() : 0;
}
function getCachedVerificationStatus() {
  if (!cachedVerificationStatus) return null;
  if (Date.now() - cachedVerificationAt > VERIFICATION_CACHE_TTL_MS) return null;
  return cachedVerificationStatus;
}
function isVerificationBlocked(status2) {
  return !!status2 && UNVERIFIED_STATUSES.has(String(status2).toUpperCase());
}
async function getPhoneNumberVerificationStatus() {
  if (!isConfigured()) return { status: null };
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}?fields=code_verification_status,display_phone_number,verified_name,quality_rating`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      return { status: null, error: mapped.message };
    }
    const status2 = typeof data?.code_verification_status === "string" ? data.code_verification_status : null;
    setCachedVerificationStatus(status2);
    return {
      status: status2,
      displayPhoneNumber: typeof data?.display_phone_number === "string" ? data.display_phone_number : null,
      verifiedName: typeof data?.verified_name === "string" ? data.verified_name : null,
      qualityRating: typeof data?.quality_rating === "string" ? data.quality_rating : null
    };
  } catch (err) {
    logWarn("[WhatsApp] Falha ao ler estado de verifica\xE7\xE3o do n\xFAmero", { phoneNumberId: PHONE_NUMBER_ID });
    return { status: null, error: err instanceof Error ? err.message : String(err) };
  }
}
async function requestVerificationCode(method = "SMS", language = "en_US") {
  if (!isConfigured()) return { ok: false, error: "WhatsApp API n\xE3o configurada." };
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/request_code?code_method=${method}&language=${encodeURIComponent(language)}`;
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${API_TOKEN}` } });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      logWarn("[WhatsApp] request_code falhou", {
        status: res.status,
        metaCode: mapped.code,
        metaMessage: mapped.message,
        metaRaw: data
      });
      return { ok: false, error: mapped.message, metaCode: mapped.code, metaRaw: data };
    }
    logInfo("[WhatsApp] C\xF3digo de verifica\xE7\xE3o pedido", { method, phoneNumberId: PHONE_NUMBER_ID });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function submitVerificationCode(code) {
  if (!isConfigured()) return { ok: false, error: "WhatsApp API n\xE3o configurada." };
  const clean3 = String(code || "").trim();
  if (!/^\d{4,8}$/.test(clean3)) {
    return { ok: false, error: "C\xF3digo de verifica\xE7\xE3o inv\xE1lido (deve ser num\xE9rico)." };
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/verify_code`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: clean3 })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const mapped = mapWhatsAppApiError(res.status, data);
      return { ok: false, error: mapped.message };
    }
    setCachedVerificationStatus(null);
    logInfo("[WhatsApp] C\xF3digo de verifica\xE7\xE3o submetido com sucesso");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
async function isWhatsAppVerificationOk() {
  if (!isConfigured()) return true;
  const cached2 = getCachedVerificationStatus();
  if (cached2) return !isVerificationBlocked(cached2);
  const info = await getPhoneNumberVerificationStatus();
  if (info.status) return !isVerificationBlocked(info.status);
  return true;
}
var VERIFICATION_CACHE_TTL_MS, cachedVerificationStatus, cachedVerificationAt, UNVERIFIED_STATUSES;
var init_verification = __esm({
  "server/services/whatsapp/verification.ts"() {
    "use strict";
    init_logger();
    init_config2();
    init_errors();
    VERIFICATION_CACHE_TTL_MS = 10 * 60 * 1e3;
    cachedVerificationStatus = null;
    cachedVerificationAt = 0;
    UNVERIFIED_STATUSES = /* @__PURE__ */ new Set(["NOT_VERIFIED", "EXPIRED", "INACTIVE", "UNVERIFIED"]);
  }
});

// server/services/whatsappTemplates.ts
var whatsappTemplates_exports = {};
__export(whatsappTemplates_exports, {
  DELIVERY_TEMPLATE_NAME: () => DELIVERY_TEMPLATE_NAME,
  FEEDBACK_TEMPLATE_NAME: () => FEEDBACK_TEMPLATE_NAME,
  PAYMENT_APPROVED_TEMPLATE_NAME: () => PAYMENT_APPROVED_TEMPLATE_NAME,
  PAYMENT_REJECTED_TEMPLATE_NAME: () => PAYMENT_REJECTED_TEMPLATE_NAME,
  TEMPLATE_LANGUAGE: () => TEMPLATE_LANGUAGE,
  VIDEO_UPSELL_TEMPLATE_NAME: () => VIDEO_UPSELL_TEMPLATE_NAME,
  WHATSAPP_TEMPLATES: () => WHATSAPP_TEMPLATES,
  enabledWhatsAppBuckets: () => enabledWhatsAppBuckets,
  listTemplates: () => listTemplates,
  templateForBucket: () => templateForBucket
});
function templateForBucket(bucket) {
  if (!bucket) return null;
  return WHATSAPP_TEMPLATES[bucket] || null;
}
function listTemplates() {
  const abandoned = Object.keys(WHATSAPP_TEMPLATES).map((k) => ({
    bucket: k,
    name: WHATSAPP_TEMPLATES[k].name,
    language: TEMPLATE_LANGUAGE
  }));
  abandoned.push({ bucket: "delivery", name: DELIVERY_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: "feedback", name: FEEDBACK_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: "payment_approved", name: PAYMENT_APPROVED_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: "payment_rejected", name: PAYMENT_REJECTED_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  abandoned.push({ bucket: "video_upsell", name: VIDEO_UPSELL_TEMPLATE_NAME, language: TEMPLATE_LANGUAGE });
  return abandoned;
}
function enabledWhatsAppBuckets() {
  const raw = process.env.WHATSAPP_ENABLED_BUCKETS;
  const enabled = (raw && raw.trim() !== "" ? raw : "30min,24h,48h,72h").split(",").map((s) => s.trim());
  return Object.keys(WHATSAPP_TEMPLATES).filter((k) => enabled.includes(k));
}
var TEMPLATE_LANGUAGE, DELIVERY_TEMPLATE_NAME, FEEDBACK_TEMPLATE_NAME, PAYMENT_APPROVED_TEMPLATE_NAME, PAYMENT_REJECTED_TEMPLATE_NAME, VIDEO_UPSELL_TEMPLATE_NAME, WHATSAPP_TEMPLATES;
var init_whatsappTemplates = __esm({
  "server/services/whatsappTemplates.ts"() {
    "use strict";
    TEMPLATE_LANGUAGE = "pt_PT";
    DELIVERY_TEMPLATE_NAME = process.env.WHATSAPP_DELIVERY_TEMPLATE || "seubeat_entrega_v1";
    FEEDBACK_TEMPLATE_NAME = process.env.WHATSAPP_FEEDBACK_TEMPLATE || "seubeat_feedback_v1";
    PAYMENT_APPROVED_TEMPLATE_NAME = process.env.WHATSAPP_PAYMENT_APPROVED_TEMPLATE || "seubeat_pagamento_aprovado_v2";
    PAYMENT_REJECTED_TEMPLATE_NAME = process.env.WHATSAPP_PAYMENT_REJECTED_TEMPLATE || "seubeat_pagamento_rejeitado_v1";
    VIDEO_UPSELL_TEMPLATE_NAME = process.env.WHATSAPP_VIDEO_UPSELL_TEMPLATE || "seubeat_video_upsell_v6";
    WHATSAPP_TEMPLATES = {
      "30min": {
        name: "seubeat_abandono_30min_v6",
        body: () => `Ola {{1}}! A tua musica esta quase pronta. So falta escolheres o plano. Continua aqui em 1 minuto: {{2}}. Esta tudo a tua espera!`
      },
      "24h": {
        name: "seubeat_abandono_24h_v6",
        body: () => `Ola {{1}}, sou eu de novo. A tua musica personalizada ainda te espera. Garante ja a tua entrega: {{2}}. Nao demores!`
      },
      "48h": {
        name: "seubeat_abandono_48h_v6",
        body: () => `Ola {{1}}! Nao deixes a tua musica especial por terminar. Esta guardada a tua espera. Continua aqui: {{2}}. Ainda vais a tempo!`
      },
      "72h": {
        name: "seubeat_abandono_72h_v6",
        body: () => `Ultima chamada, {{1}}! A tua musica guardada vai ser fechada em breve. Termina agora: {{2}}. Vamos la!`
      }
    };
  }
});

// server/services/whatsapp/configStatus.ts
async function getConfigStatus() {
  const sentToday = await getDailySentCount();
  const verification = await getPhoneNumberVerificationStatus().catch(() => ({ status: null }));
  return {
    configured: isConfigured(),
    phone: WHATSAPP_PHONE,
    phoneNumberId: isConfigured() ? PHONE_NUMBER_ID : null,
    dailyCap: DAILY_CAP,
    sentToday,
    startHour: START_HOUR,
    endHour: END_HOUR,
    templates: listTemplates(),
    enabledBuckets: enabledWhatsAppBuckets(),
    codeVerificationStatus: verification.status,
    verifiedName: verification.verifiedName || null,
    qualityRating: verification.qualityRating || null
  };
}
var init_configStatus = __esm({
  "server/services/whatsapp/configStatus.ts"() {
    "use strict";
    init_config2();
    init_sendLog();
    init_verification();
    init_whatsappTemplates();
  }
});

// server/services/whatsapp/templateSender.ts
function sanitizeTemplateParam(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
}
async function sendTemplate(phone, templateName, params) {
  if (!isConfigured()) {
    return { ok: false, error: "WhatsApp API n\xE3o configurada (WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID)." };
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: TEMPLATE_LANGUAGE },
      components: params.length ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: sanitizeTemplateParam(p) })) }] : void 0
    }
  };
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    logWarn("[WhatsApp] Falha de rede ao enviar template", { phone, templateName });
    return { ok: false, error: "Falha de rede ao contactar a WhatsApp API." };
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const mapped = mapWhatsAppApiError(res.status, data);
    logWarn("[WhatsApp] Template rejeitado pela API", { phone, templateName, code: mapped.code, message: mapped.message });
    return { ok: false, error: mapped.message, code: mapped.code };
  }
  const messageId = data?.messages?.[0]?.id || null;
  logInfo("[WhatsApp] Template enviado", { phone, templateName, messageId });
  return { ok: true, messageId };
}
var init_templateSender = __esm({
  "server/services/whatsapp/templateSender.ts"() {
    "use strict";
    init_logger();
    init_config2();
    init_errors();
    init_whatsappTemplates();
  }
});

// server/services/abandonedMessages.ts
var abandonedMessages_exports = {};
__export(abandonedMessages_exports, {
  ABANDONED_BUCKET_ORDER: () => ABANDONED_BUCKET_ORDER,
  ABANDONED_TIME_RANGES: () => ABANDONED_TIME_RANGES,
  bucketForElapsed: () => bucketForElapsed,
  bucketLabel: () => bucketLabel,
  buildAbandonedMessage: () => buildAbandonedMessage,
  elapsedInRange: () => elapsedInRange,
  isAbandonedTimeRange: () => isAbandonedTimeRange,
  normalizePhoneToE164: () => normalizePhoneToE164
});
function bucketForElapsed(elapsedMs) {
  for (let i = BUCKET_DEFS.length - 1; i >= 0; i--) {
    if (elapsedMs >= BUCKET_DEFS[i].minElapsedMs) return BUCKET_DEFS[i].key;
  }
  return null;
}
function bucketLabel(key) {
  const def = BUCKET_DEFS.find((b) => b.key === key);
  return def ? def.label : key;
}
function isAbandonedTimeRange(key) {
  return ABANDONED_TIME_RANGES.some((r) => r.key === key);
}
function elapsedInRange(elapsedMs, range) {
  const def = ABANDONED_TIME_RANGES.find((r) => r.key === range);
  if (!def) return false;
  if (elapsedMs < def.minMs) return false;
  if (def.maxMs !== null && elapsedMs >= def.maxMs) return false;
  return true;
}
function buildAbandonedMessage(key, name, link) {
  const tpl = MESSAGE_TEMPLATES[key];
  if (!tpl) throw new Error(`Bucket desconhecido: ${key}`);
  return tpl((name || "").trim().split(" ")[0] || "amigo(a)", link);
}
function normalizePhoneToE164(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("09")) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith("9")) return `244${digits}`;
  if (digits.length === 12 && digits.startsWith("244")) return digits;
  return null;
}
var BUCKET_DEFS, ABANDONED_BUCKET_ORDER, MESSAGE_TEMPLATES, ABANDONED_TIME_RANGES;
var init_abandonedMessages = __esm({
  "server/services/abandonedMessages.ts"() {
    "use strict";
    BUCKET_DEFS = [
      { key: "30min", label: "Pronto h\xE1 30min", minElapsedMs: 30 * 60 * 1e3 },
      { key: "24h", label: "Pronto h\xE1 24h", minElapsedMs: 24 * 60 * 60 * 1e3 },
      { key: "48h", label: "Pronto h\xE1 48h", minElapsedMs: 48 * 60 * 60 * 1e3 },
      { key: "72h", label: "Pronto h\xE1 72h+", minElapsedMs: 72 * 60 * 60 * 1e3 }
    ];
    ABANDONED_BUCKET_ORDER = ["30min", "72h", "24h", "48h"];
    MESSAGE_TEMPLATES = {
      "30min": (name, link) => `Ol\xE1 ${name}! A tua m\xFAsica est\xE1 quase pronta \u{1F3B5} \u2014 s\xF3 falta escolheres o plano. Continua aqui em 1 minuto: ${link}`,
      "24h": (name, link) => `Ol\xE1 ${name}, sou eu de novo \u{1F60A} A tua m\xFAsica personalizada ainda te espera. Garante j\xE1 a tua entrega: ${link}`,
      "48h": (name, link) => `Ol\xE1 ${name}! N\xE3o deixes a tua m\xFAsica especial por terminar \u2014 est\xE1 guardada \xE0 tua espera. Continua aqui: ${link}`,
      "72h": (name, link) => `\xDAltima chamada, ${name}! \u23F0 A tua m\xFAsica est\xE1 pronta e \xE0 tua espera. Termina agora: ${link}`
    };
    ABANDONED_TIME_RANGES = [
      { key: "lt1h", label: "<1h", minMs: 0, maxMs: 60 * 60 * 1e3 },
      { key: "1-6h", label: "1\u20136h", minMs: 60 * 60 * 1e3, maxMs: 6 * 60 * 60 * 1e3 },
      { key: "6-24h", label: "6\u201324h", minMs: 6 * 60 * 60 * 1e3, maxMs: 24 * 60 * 60 * 1e3 },
      { key: "24-48h", label: "24\u201348h", minMs: 24 * 60 * 60 * 1e3, maxMs: 48 * 60 * 60 * 1e3 },
      { key: "48-72h", label: "48\u201372h", minMs: 48 * 60 * 60 * 1e3, maxMs: 72 * 60 * 60 * 1e3 },
      { key: "gt72h", label: ">72h", minMs: 72 * 60 * 60 * 1e3, maxMs: null }
    ];
  }
});

// server/services/whatsapp/bulkCampaign.ts
function getSendProgress() {
  return { ...progress };
}
function resetProgress() {
  progress.running = false;
  progress.total = 0;
  progress.processed = 0;
  progress.sent = 0;
  progress.skippedNoWhatsApp = 0;
  progress.failed = 0;
  progress.error = null;
  progress.startedAt = null;
  progress.finishedAt = null;
}
function randomDelay() {
  return MIN_SEND_DELAY_MS + Math.floor(Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS + 1));
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function runSendBulk(clients, _options) {
  if (!isConfigured()) {
    throw new Error("WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID.");
  }
  if (!clients || clients.length === 0) return { scheduled: false };
  if (sendInFlight) return { scheduled: false };
  sendInFlight = true;
  progress.running = true;
  progress.total = clients.length;
  progress.processed = 0;
  progress.sent = 0;
  progress.skippedNoWhatsApp = 0;
  progress.failed = 0;
  progress.error = null;
  progress.startedAt = (/* @__PURE__ */ new Date()).toISOString();
  progress.finishedAt = null;
  void (async () => {
    try {
      await sendBulk(clients);
    } catch (err) {
      progress.error = err instanceof Error ? err.message : String(err);
      logError("[WhatsApp] Falha na campanha", err instanceof Error ? err : new Error(String(err)));
    } finally {
      progress.running = false;
      progress.finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      sendInFlight = false;
    }
  })();
  return { scheduled: true };
}
async function sendBulk(clients) {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  if (hour < START_HOUR || hour >= END_HOUR) {
    progress.error = `Janela de envio WhatsApp fechada (${START_HOUR}h\u2013${END_HOUR}h).`;
    progress.processed = progress.total;
    return;
  }
  const sentToday = await getDailySentCount();
  const budget = Math.max(0, DAILY_CAP - sentToday);
  if (budget <= 0) {
    progress.error = "Cap di\xE1rio de mensagens WhatsApp atingido.";
    progress.processed = progress.total;
    return;
  }
  let used = 0;
  for (const client of clients) {
    if (used >= budget) {
      progress.error = "Cap di\xE1rio de mensagens WhatsApp atingido.";
      break;
    }
    const phone = normalizePhoneToE164(client.phone || "");
    if (!phone) {
      progress.skippedNoWhatsApp++;
      progress.processed++;
      await insertSendLog({ requestId: client.requestId, phone: client.phone || "", status: "skipped", bucket: client.bucket, error: "sem telefone" });
      continue;
    }
    if (used > 0) await sleep(randomDelay());
    used++;
    await sendOne(client, phone);
  }
}
async function sendOne(client, phone) {
  const def = templateForBucket(client.bucket);
  const templateName = client.templateName || def?.name || "";
  if (!templateName) {
    progress.failed++;
    progress.processed++;
    await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: client.bucket, error: "Sem template definido para este bucket." });
    return "failed";
  }
  const params = client.params && client.params.length ? client.params : client.message ? [client.message] : [];
  const result = await sendTemplate(phone, templateName, params);
  progress.processed++;
  if (result.ok) {
    await markContacted(client.requestId);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: client.bucket,
      messageId: result.messageId || void 0,
      templateName
    });
    progress.sent++;
    return "sent";
  }
  if (result.code === 131030) {
    progress.skippedNoWhatsApp++;
    await insertSendLog({ requestId: client.requestId, phone, status: "skipped", bucket: client.bucket, error: result.error });
    return "skipped";
  }
  progress.failed++;
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: client.bucket, error: result.error });
  return "failed";
}
var progress, sendInFlight;
var init_bulkCampaign = __esm({
  "server/services/whatsapp/bulkCampaign.ts"() {
    "use strict";
    init_logger();
    init_abandonedMessages();
    init_whatsappTemplates();
    init_config2();
    init_sendLog();
    init_templateSender();
    progress = {
      running: false,
      total: 0,
      processed: 0,
      sent: 0,
      skippedNoWhatsApp: 0,
      failed: 0,
      error: null,
      startedAt: null,
      finishedAt: null
    };
    sendInFlight = false;
  }
});

// server/services/whatsapp/abandonedSender.ts
function sleep2(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function randomDelay2() {
  return MIN_SEND_DELAY_MS + Math.floor(Math.random() * (MAX_SEND_DELAY_MS - MIN_SEND_DELAY_MS + 1));
}
async function sendAbandonedWhatsApp(client) {
  if (!isConfigured()) {
    return "unconfigured";
  }
  const hour = (/* @__PURE__ */ new Date()).getHours();
  if (hour < START_HOUR || hour >= END_HOUR) {
    return "window-closed";
  }
  const sentToday = await getDailySentCount();
  const budget = Math.max(0, DAILY_CAP - sentToday);
  if (budget <= 0) {
    return "cap-reached";
  }
  const phone = normalizePhoneToE164(client.phone || "");
  if (!phone) {
    if (!await hasBucketLog(client.requestId, client.bucket)) {
      await insertSendLog({ requestId: client.requestId, phone: client.phone || "", status: "skipped", bucket: client.bucket, error: "sem telefone" });
    }
    return "skipped";
  }
  const failures = await countFailedAttempts(client.requestId, client.bucket);
  if (failures >= MAX_SEND_ATTEMPTS_PER_DAY) {
    return "failed";
  }
  const def = templateForBucket(client.bucket);
  const templateName = client.templateName || def?.name || "";
  if (!templateName) {
    await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: client.bucket, error: "Sem template definido para este bucket." });
    return "failed";
  }
  await sleep2(randomDelay2());
  const params = client.params && client.params.length ? client.params : client.message ? [client.message] : [];
  const result = await sendTemplate(phone, templateName, params);
  if (result.ok) {
    await markContacted(client.requestId);
    await markBucketSent(client.requestId, client.bucket);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: client.bucket,
      messageId: result.messageId || void 0,
      templateName
    });
    return "sent";
  }
  if (result.code === 131030) {
    await insertSendLog({ requestId: client.requestId, phone, status: "skipped", bucket: client.bucket, error: result.error });
    return "skipped";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: client.bucket, error: result.error });
  return "failed";
}
var MAX_SEND_ATTEMPTS_PER_DAY;
var init_abandonedSender = __esm({
  "server/services/whatsapp/abandonedSender.ts"() {
    "use strict";
    init_abandonedMessages();
    init_whatsappTemplates();
    init_config2();
    init_sendLog();
    init_templateSender();
    MAX_SEND_ATTEMPTS_PER_DAY = 3;
  }
});

// server/services/whatsapp/webhook.ts
async function handleDeliveryWebhook(payload) {
  const obj = payload && typeof payload === "object" ? payload : null;
  const entries = obj?.entry;
  if (!Array.isArray(entries)) return;
  const supabase = getAdminSupabase();
  if (!supabase) return;
  for (const entry of entries) {
    const changes = entry?.changes;
    if (!Array.isArray(changes)) continue;
    for (const change of changes) {
      const value = change?.value || {};
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      for (const st of statuses) {
        const status2 = st?.status;
        const waId = st?.recipient_id;
        if (!status2 || !waId) continue;
        const dbStatus = status2 === "failed" ? "failed" : status2 === "delivered" || status2 === "read" ? "delivered" : null;
        if (!dbStatus) continue;
        const err = st?.errors?.[0];
        const update = {
          status: dbStatus,
          error: err?.message ? err.message : null
        };
        if (typeof st?.id === "string") update.message_id = st.id;
        try {
          const { data: rows } = await supabase.from("whatsapp_send_log").select("id").eq("phone", waId).eq("status", "sent").order("created_at", { ascending: false }).limit(1);
          if (rows?.[0]?.id) {
            await supabase.from("whatsapp_send_log").update(update).eq("id", rows[0].id);
            logInfo("[WhatsApp] Estado de entrega atualizado", { waId, status: dbStatus });
          }
        } catch (err2) {
          logError("[WhatsApp] Erro ao processar webhook", err2 instanceof Error ? err2 : new Error(String(err2)));
        }
      }
    }
  }
}
var init_webhook = __esm({
  "server/services/whatsapp/webhook.ts"() {
    "use strict";
    init_supabase();
    init_logger();
  }
});

// server/services/whatsapp/transactional.ts
async function sendDeliveryWhatsApp(client) {
  if (!isConfigured()) return "unconfigured";
  const phone = normalizePhoneToE164(client.phone || "");
  if (!phone) return "skipped";
  const templateName = DELIVERY_TEMPLATE_NAME;
  const params = [client.recipientName || "Destinat\xE1rio", client.songUrl];
  const res = await sendTemplate(phone, templateName, params);
  if (res.ok) {
    await markContacted(client.requestId);
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: "delivery",
      messageId: res.messageId || void 0,
      templateName
    });
    logInfo("[WhatsApp] Notifica\xE7\xE3o de entrega enviada", { phone, requestId: client.requestId });
    return "sent";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: "delivery", error: res.error });
  return "failed";
}
async function sendPaymentApprovedWhatsApp(client) {
  if (!isConfigured()) return "unconfigured";
  const phone = normalizePhoneToE164(client.phone || "");
  if (!phone) return "skipped";
  const templateName = PAYMENT_APPROVED_TEMPLATE_NAME;
  const params = [client.recipientName || "Destinat\xE1rio", "24 horas"];
  const res = await sendTemplate(phone, templateName, params);
  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: "payment_approved",
      messageId: res.messageId || void 0,
      templateName
    });
    logInfo("[WhatsApp] Notifica\xE7\xE3o de pagamento aprovado enviada (Standard)", { phone, requestId: client.requestId });
    return "sent";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: "payment_approved", error: res.error });
  return "failed";
}
async function sendPaymentRejectedWhatsApp(client) {
  if (!isConfigured()) return "unconfigured";
  const phone = normalizePhoneToE164(client.phone || "");
  if (!phone) return "skipped";
  const templateName = PAYMENT_REJECTED_TEMPLATE_NAME;
  const params = [client.recipientName || "Destinat\xE1rio", client.reason || "reprovado"];
  const res = await sendTemplate(phone, templateName, params);
  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: "payment_rejected",
      messageId: res.messageId || void 0,
      templateName
    });
    logInfo("[WhatsApp] Notifica\xE7\xE3o de pagamento rejeitado enviada", { phone, requestId: client.requestId });
    return "sent";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: "payment_rejected", error: res.error });
  return "failed";
}
async function sendVideoUpsellWhatsApp(client) {
  if (!isConfigured()) return "unconfigured";
  const phone = normalizePhoneToE164(client.phone || "");
  if (!phone) return "skipped";
  const templateName = VIDEO_UPSELL_TEMPLATE_NAME;
  const res = await sendTemplate(phone, templateName, []);
  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: "video_upsell",
      messageId: res.messageId || void 0,
      templateName
    });
    logInfo("[WhatsApp] Offer de videoclipe enviada", { phone, requestId: client.requestId });
    return "sent";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: "video_upsell", error: res.error });
  return "failed";
}
async function sendFeedbackRequestWhatsApp(client) {
  if (!isConfigured()) return "unconfigured";
  const rawPhone = normalizePhoneToE164(client.phone || "");
  if (!rawPhone) return "skipped";
  const phone = rawPhone;
  const templateName = FEEDBACK_TEMPLATE_NAME;
  const appUrl = process.env.APP_URL || "https://seubeat.vercel.app";
  const params = [
    client.recipientName || "Destinat\xE1rio",
    `${appUrl}/feedback?requestId=${client.requestId}&email=${encodeURIComponent(client.email || "")}`
  ];
  const res = await sendTemplate(phone, templateName, params);
  if (res.ok) {
    await insertSendLog({
      requestId: client.requestId,
      phone,
      status: "sent",
      bucket: "feedback",
      messageId: res.messageId ?? void 0,
      templateName: "feedback_request"
    });
    logInfo("[WhatsApp] Pedido de feedback em v\xEDdeo enviado", { phone, requestId: client.requestId });
    return "sent";
  }
  await insertSendLog({ requestId: client.requestId, phone, status: "failed", bucket: "feedback", error: res.error });
  return "failed";
}
var init_transactional2 = __esm({
  "server/services/whatsapp/transactional.ts"() {
    "use strict";
    init_logger();
    init_abandonedMessages();
    init_whatsappTemplates();
    init_config2();
    init_sendLog();
    init_templateSender();
  }
});

// server/services/whatsapp/index.ts
var whatsapp_exports = {};
__export(whatsapp_exports, {
  WHATSAPP_FLAG_BY_BUCKET: () => WHATSAPP_FLAG_BY_BUCKET,
  countFailedAttempts: () => countFailedAttempts,
  getCachedVerificationStatus: () => getCachedVerificationStatus,
  getConfigStatus: () => getConfigStatus,
  getDailySentCount: () => getDailySentCount,
  getLinkStatus: () => getLinkStatus,
  getPhoneNumberVerificationStatus: () => getPhoneNumberVerificationStatus,
  getSendProgress: () => getSendProgress,
  getWhatsAppAppUrl: () => getWhatsAppAppUrl,
  handleDeliveryWebhook: () => handleDeliveryWebhook,
  hasBucketLog: () => hasBucketLog,
  insertSendLog: () => insertSendLog,
  isConfigured: () => isConfigured,
  isVerificationBlocked: () => isVerificationBlocked,
  isWhatsAppVerificationOk: () => isWhatsAppVerificationOk,
  mapWhatsAppApiError: () => mapWhatsAppApiError,
  markBucketSent: () => markBucketSent,
  markContacted: () => markContacted,
  requestVerificationCode: () => requestVerificationCode,
  resetProgress: () => resetProgress,
  runSendBulk: () => runSendBulk,
  sanitizeTemplateParam: () => sanitizeTemplateParam,
  sendAbandonedWhatsApp: () => sendAbandonedWhatsApp,
  sendDeliveryWhatsApp: () => sendDeliveryWhatsApp,
  sendFeedbackRequestWhatsApp: () => sendFeedbackRequestWhatsApp,
  sendPaymentApprovedWhatsApp: () => sendPaymentApprovedWhatsApp,
  sendPaymentRejectedWhatsApp: () => sendPaymentRejectedWhatsApp,
  sendTemplate: () => sendTemplate,
  sendVideoUpsellWhatsApp: () => sendVideoUpsellWhatsApp,
  setCachedVerificationStatus: () => setCachedVerificationStatus,
  submitVerificationCode: () => submitVerificationCode
});
var init_whatsapp = __esm({
  "server/services/whatsapp/index.ts"() {
    "use strict";
    init_config2();
    init_configStatus();
    init_verification();
    init_errors();
    init_templateSender();
    init_sendLog();
    init_bulkCampaign();
    init_abandonedSender();
    init_webhook();
    init_transactional2();
  }
});

// server/services/metaPixelCapi.ts
var metaPixelCapi_exports = {};
__export(metaPixelCapi_exports, {
  generateServerEventId: () => generateServerEventId,
  sendAddPaymentInfoEvent: () => sendAddPaymentInfoEvent,
  sendCompleteRegistrationEvent: () => sendCompleteRegistrationEvent,
  sendInitiateCheckoutEvent: () => sendInitiateCheckoutEvent,
  sendLeadEvent: () => sendLeadEvent,
  sendPurchaseEvent: () => sendPurchaseEvent,
  sendRefundEvent: () => sendRefundEvent,
  sendSubmitApplicationEvent: () => sendSubmitApplicationEvent
});
import crypto from "node:crypto";
function generateServerEventId(requestId, eventName) {
  let hash = 0;
  const str = `${eventName}:${requestId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0");
}
function hashEmail(email) {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}
function hashPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  const normalized = /^\d{9}$/.test(digits) ? `244${digits}` : digits;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
function hashGeneric(value) {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex");
}
function unixNow() {
  return Math.floor(Date.now() / 1e3);
}
function delay2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function buildPayload(params) {
  const { eventName, eventId, email, phone, value, currency, contentName, contentType, eventSourceUrl, clientIp, clientUserAgent, externalId, fbp, fbc, orderId, zip, dob, fn, ln, gen, country, ct, st } = params;
  const userData = {};
  if (email) userData.em = [hashEmail(email)];
  if (phone) userData.ph = [hashPhone(phone)];
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (externalId) userData.external_id = hashEmail(externalId);
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;
  if (zip) userData.zp = [hashGeneric(zip)];
  if (dob) userData.db = [hashGeneric(dob)];
  if (fn) userData.fn = [hashGeneric(fn)];
  if (ln) userData.ln = [hashGeneric(ln)];
  if (gen) userData.gen = [hashGeneric(gen)];
  if (country) userData.country = [hashGeneric(country)];
  if (ct) userData.ct = [hashGeneric(ct)];
  if (st) userData.st = [hashGeneric(st)];
  const customData = {};
  if (value !== void 0) customData.value = value;
  if (currency) customData.currency = currency;
  if (contentName) customData.content_name = contentName;
  if (contentType) customData.content_type = contentType;
  if (orderId) customData.order_id = orderId;
  return {
    data: [
      {
        event_name: eventName,
        event_time: unixNow(),
        event_id: eventId,
        user_data: userData,
        ...Object.keys(customData).length > 0 ? { custom_data: customData } : {},
        action_source: "website",
        event_source_url: eventSourceUrl || getEnv("APP_URL", FALLBACK_EVENT_URL)
      }
    ],
    access_token: ACCESS_TOKEN
  };
}
async function attemptSend(payload, attempt) {
  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status >= 500) {
        if (attempt < MAX_RETRIES2) {
          logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES2} falhou (HTTP ${res.status}), reenviando...`, { response: body });
          return "retry";
        }
        logError("[MetaCAPI] Erro ao enviar evento (5xx ap\xF3s retries)", new Error(`HTTP ${res.status}`), { response: body, attempt, eventName: payload.data[0].event_name });
        return "fail";
      }
      logError("[MetaCAPI] Erro ao enviar evento (HTTP 4xx)", new Error(`HTTP ${res.status}`), { response: body, attempt, eventName: payload.data[0].event_name, eventId: payload.data[0].event_id });
      return "fail";
    }
    const json = await res.json();
    logInfo("[MetaCAPI] Evento enviado com sucesso", { eventName: payload.data[0].event_name, eventId: payload.data[0].event_id, eventsReceived: json.events_received });
    return "success";
  } catch (err) {
    if (attempt < MAX_RETRIES2) {
      logWarn(`[MetaCAPI] Tentativa ${attempt}/${MAX_RETRIES2} falhou (rede/timeout), reenviando...`, { error: err instanceof Error ? err.message : String(err) });
      return "retry";
    }
    logError("[MetaCAPI] Erro de rede ao enviar evento ap\xF3s todas as tentativas", err instanceof Error ? err : new Error(String(err)));
    return "fail";
  }
}
async function sendEvent(params) {
  if (!IS_ENABLED) {
    logWarn("[MetaCAPI] CAPI desativado \u2014 META_PIXEL_ID ou META_ACCESS_TOKEN em falta", { eventName: params.eventName, eventId: params.eventId });
    return false;
  }
  const payload = buildPayload(params);
  for (let attempt = 1; attempt <= MAX_RETRIES2; attempt++) {
    const outcome = await attemptSend(payload, attempt);
    if (outcome === "success") return true;
    if (outcome === "fail") return false;
    if (attempt < MAX_RETRIES2) {
      await delay2(BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }
  return false;
}
async function sendInitiateCheckoutEvent(params) {
  return sendEvent({ ...params, eventName: "InitiateCheckout", contentType: "product" });
}
async function sendAddPaymentInfoEvent(params) {
  return sendEvent({ ...params, eventName: "AddPaymentInfo", contentType: "product" });
}
async function sendPurchaseEvent(params) {
  return sendEvent({ ...params, eventName: "Purchase", contentType: "product" });
}
async function sendSubmitApplicationEvent(params) {
  return sendEvent({ ...params, eventName: "SubmitApplication", contentType: "product" });
}
async function sendRefundEvent(params) {
  return sendEvent({ ...params, eventName: "Refund", contentType: "product" });
}
async function sendLeadEvent(params) {
  return sendEvent({ ...params, eventName: "Lead", contentType: "product" });
}
async function sendCompleteRegistrationEvent(params) {
  return sendEvent({ ...params, eventName: "CompleteRegistration", contentType: "product" });
}
var PIXEL_ID, ACCESS_TOKEN, IS_ENABLED, API_VERSION, BASE_URL, MAX_RETRIES2, BASE_DELAY_MS, REQUEST_TIMEOUT_MS, FALLBACK_EVENT_URL;
var init_metaPixelCapi = __esm({
  "server/services/metaPixelCapi.ts"() {
    "use strict";
    init_env();
    init_logger();
    PIXEL_ID = getEnv("META_PIXEL_ID", "");
    ACCESS_TOKEN = getEnv("META_ACCESS_TOKEN", "");
    IS_ENABLED = Boolean(PIXEL_ID && ACCESS_TOKEN);
    API_VERSION = "v25.0";
    BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;
    MAX_RETRIES2 = 3;
    BASE_DELAY_MS = 1e3;
    REQUEST_TIMEOUT_MS = 5e3;
    FALLBACK_EVENT_URL = "https://seubeat.vercel.app";
  }
});

// server/services/deepseekConfig.ts
function getDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_SECRET_KEY || "";
}
function hasDeepSeekApiKey() {
  return !!getDeepSeekApiKey();
}
var init_deepseekConfig = __esm({
  "server/services/deepseekConfig.ts"() {
    "use strict";
  }
});

// server/services/prompts.ts
import fs7 from "fs";
import path4 from "path";
function repairMojibake(text) {
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}
function getPromptFromFile(filename, fallback) {
  try {
    const filePath = path4.join(process.cwd(), "prompts", filename);
    if (fs7.existsSync(filePath)) {
      return repairMojibake(fs7.readFileSync(filePath, "utf-8").trim());
    }
  } catch (err) {
    logWarn("[Prompt Loader] Falha ao ler prompt; usando fallback.", {
      filename,
      error: err instanceof Error ? err.message : String(err)
    });
  }
  return fallback;
}
function clean(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}
function normalizeLower(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function languageDisplayName(lang) {
  const names = {
    "portugu\xEAs": "Portugu\xEAs de Angola",
    "kimbundu": "Portugu\xEAs mesclado com Kimbundu (l\xEDngua nacional angolana)",
    "umbundu": "Portugu\xEAs mesclado com UmBundu (l\xEDngua nacional angolana)",
    "kikongo": "Portugu\xEAs mesclado com Kikongo (l\xEDngua nacional angolana)",
    "lingala": "Portugu\xEAs mesclado com Lingala",
    "ingl\xEAs": "Ingl\xEAs"
  };
  return names[lang] || "Portugu\xEAs de Angola";
}
function languageInstruction(lang) {
  const instructions = {
    "portugu\xEAs": 'Escreva em portugu\xEAs de Angola natural. Use "tu" e "n\xF3s". Evite express\xF5es do Brasil ("a gente", "p\xF4", "voc\xEA") e de Portugal ("giro", "bica"). N\xE3o force g\xEDrias ou termos locais \u2014 s\xF3 usa se vierem dos dados do utilizador.',
    "kimbundu": 'Pode mesclear portugu\xEAs com Kimbundu quando a hist\xF3ria pedir (ex.: termos como "muene", "kota", "kibai"). N\xE3o forces a lista \u2014 usa s\xF3 o que encaixar naturalmente.',
    "umbundu": 'Pode mesclear portugu\xEAs com UmBundu quando a hist\xF3ria pedir (ex.: termos como "ochi", "suku", "etu"). N\xE3o forces a lista \u2014 usa s\xF3 o que encaixar naturalmente.',
    "kikongo": 'Pode mesclear portugu\xEAs com Kikongo quando a hist\xF3ria pedir (ex.: termos como "ngolo", "kiese", "zola"). N\xE3o forces a lista \u2014 usa s\xF3 o que encaixar naturalmente.',
    "lingala": 'Pode mesclear portugu\xEAs com Lingala quando a hist\xF3ria pedir (ex.: termos como "bolingo", "moto", "kolela"). N\xE3o forces a lista \u2014 usa s\xF3 o que encaixar naturalmente.',
    "ingl\xEAs": "Escreva completamente em ingl\xEAs. Natural, po\xE9tico e aut\xEAntico."
  };
  return instructions[lang ?? "portugu\xEAs"] || instructions["portugu\xEAs"];
}
function buildFormContext(formData) {
  const sections = [
    { title: "DADOS BIOGR\xC1FICOS", items: [
      ["Nome do Destinat\xE1rio", clean(formData.recipientName)],
      ["G\xE9nero do Destinat\xE1rio", clean(formData.recipientGender)],
      ["Rela\xE7\xE3o com quem oferece", clean(formData.recipientRelation)]
    ] },
    { title: "CONTEXTO DA M\xDASICA", items: [
      ["Ocasi\xE3o Especial", clean(formData.occasion)],
      ["Estilo Musical", clean(formData.musicStyle)],
      ["Tipo de Voz", clean(formData.voiceType)]
    ] },
    { title: "HIST\xD3RIA DA RELA\xC7\xC3O", items: [
      ["O que torna a pessoa especial", clean(formData.whatMakesSpecial)],
      ["Local da mem\xF3ria", clean(formData.whereItHappened)]
    ] },
    { title: "MENSAGEM CENTRAL", items: [
      ["O que nunca deve esquecer", clean(formData.messageFromTheHeart)],
      ["Idioma", languageDisplayName(clean(formData.language))]
    ] }
  ];
  return sections.map((s) => {
    const validItems = s.items.filter(([, value]) => value.length > 0);
    if (validItems.length === 0) return "";
    return `-- ${s.title} --
${validItems.map(([label, value]) => `- ${label}: ${value}`).join("\n")}`;
  }).filter(Boolean).join("\n\n");
}
function selectPrompt(formData) {
  const relacao = normalizeLower(formData.recipientRelation);
  const ocasiao = normalizeLower(formData.occasion);
  const promptMestre = getPromptFromFile("mestre.txt", `Voce e um compositor profissional especializado em musicas emocionais e personalizadas, em Portugues de Angola.
Seu objetivo e criar uma musica que pare\xE7a ter sido escrita exclusivamente para uma unica pessoa.

REGRAS:
1. Nunca escreva letras genericas \u2014 use os detalhes fornecidos pelo utilizador.
2. Cada verso deve conter uma imagem sensorial (visao, som, cheiro, tato, paladar) tirada dos dados fornecidos. Nao inventes imagens prontas nem repitas formulas.
3. Escreva como um compositor humano experiente, nao como uma IA.
4. Portugues de Angola natural e fluido \u2014 sem forcar girias ou expressoes locais (ex.: candongueiro, bue, xe). So usa termos locais se vierem dos dados do utilizador.
5. Nenhuma linha repetida mais de 3 vezes.
6. Concordancia de genero: se feminino use "obrigada", "querida", "\xE9s a mais linda"; se masculino use "obrigado", "querido", "\xE9s o mais lindo".

ESTRUTURA (nesta ordem):
[Verso 1] \u2014 Estabelece o cenario e a memoria inicial.
[Pre-Refr\xE3o] \u2014 Tensao emocional crescente.
[Refr\xE3o] \u2014 A alma da mensagem. Memoravel e ritmico.
[Verso 2] \u2014 Aprofunda a historia com detalhes intimos.
[Ponte Emocional] \u2014 Viragem ou promessa para o futuro.
[Refr\xE3o Final] \u2014 Explosao emocional, encerramento marcante.

Cada marcador deve ter 2 a 4 linhas de verso.
Total: 30 a 45 linhas (incluindo marcadores).

GANCHO: Se fornecido, o refr\xE3o DEVE incorporar ou girar em torno dessa frase.

DEDICATORIA: Carta curta (2-3 frases) em prosa, sem repetir a letra.`);
  const prompts = {
    romance: getPromptFromFile("romance.txt", "Crie uma can\xE7\xE3o rom\xE2ntica sincera, focada na hist\xF3ria do casal, mem\xF3rias reais, pequenos gestos e futuro desejado."),
    mae: getPromptFromFile("mae.txt", "Crie uma homenagem para m\xE3e com gratid\xE3o, cuidado, sacrif\xEDcio, prote\xE7\xE3o e amor incondicional. Sem melodrama exagerado."),
    pai: getPromptFromFile("pai.txt", "Crie uma homenagem para pai com respeito, orgulho, ensinamentos, exemplo de vida e gratid\xE3o."),
    filho: getPromptFromFile("filho.txt", "Crie uma m\xFAsica para filho ou filha com amor, prote\xE7\xE3o, orgulho, crescimento e esperan\xE7a."),
    familia: getPromptFromFile("familia.txt", "Crie uma m\xFAsica familiar calorosa sobre inf\xE2ncia, cumplicidade, apoio m\xFAtuo e mem\xF3rias partilhadas."),
    amizade: getPromptFromFile("amizade.txt", "Crie uma m\xFAsica de amizade verdadeira sobre lealdade, apoio, hist\xF3rias vividas e presen\xE7a."),
    aniversario: getPromptFromFile("aniversario.txt", 'Crie uma can\xE7\xE3o de anivers\xE1rio celebrando a vida, alegria e gratid\xE3o. O Refr\xE3o Final deve incluir "Feliz Anivers\xE1rio [Destinat\xE1rio]" como mensagem de encerramento.'),
    aniversarioNamoro: getPromptFromFile("aniversario_namoro.txt", 'Crie uma can\xE7\xE3o de anivers\xE1rio de namoro celebrando o tempo juntos e o amor que dura. O Refr\xE3o Final deve incluir "Feliz Anivers\xE1rio de namoro" como mensagem de encerramento.'),
    avo: getPromptFromFile("avo.txt", "Crie uma homenagem para av\xF3s com carinho, sabedoria, mem\xF3rias de inf\xE2ncia e amor geracional."),
    professor: getPromptFromFile("professor.txt", "Crie uma homenagem para professor(a) destacando inspira\xE7\xE3o, conhecimento, impacto positivo e gratid\xE3o."),
    pastor: getPromptFromFile("pastor.txt", "Crie uma m\xFAsica de gratid\xE3o e f\xE9 para l\xEDder espiritual, com respeito e orienta\xE7\xE3o."),
    colega: getPromptFromFile("colega.txt", "Crie uma homenagem profissional com trabalho em equipa, supera\xE7\xE3o e reconhecimento."),
    saudade: getPromptFromFile("saudade.txt", "Crie uma can\xE7\xE3o de saudade madura, com mem\xF3rias bonitas e gratid\xE3o pelo passado."),
    paramim: getPromptFromFile("paramim.txt", "Crie uma m\xFAsica de autoestima e supera\xE7\xE3o pessoal, com conquistas e resili\xEAncia."),
    casamento: getPromptFromFile("casamento.txt", "Crie uma can\xE7\xE3o de casamento sobre uni\xE3o, promessa, altar e o in\xEDcio da vida a dois."),
    desculpas: getPromptFromFile("pedido_desculpas.txt", "Crie uma can\xE7\xE3o de pedido de desculpas com vulnerabilidade, arrependimento humilde e desejo de reconstruir."),
    memorial: getPromptFromFile("memorial.txt", "Crie uma can\xE7\xE3o in memoriam com tom suave, respeitoso, saudade e amor que permanece."),
    homenagem: getPromptFromFile("homenagem.txt", "Crie uma can\xE7\xE3o de reconhecimento com admira\xE7\xE3o, trajet\xF3ria e impacto humano."),
    outro: getPromptFromFile("outro.txt", "Analise a rela\xE7\xE3o e ocasi\xE3o e adapte completamente o tom ao contexto descrito.")
  };
  let basePrompt = prompts.outro;
  if (ocasiao.includes("aniversario")) {
    basePrompt = ocasiao.includes("namoro") ? prompts.aniversarioNamoro : prompts.aniversario;
  } else if (ocasiao.includes("casamento")) basePrompt = prompts.casamento;
  else if (ocasiao.includes("desculpa")) basePrompt = prompts.desculpas;
  else if (ocasiao.includes("memorial") || ocasiao.includes("saudade")) basePrompt = prompts.memorial;
  else if (ocasiao.includes("homenagem")) basePrompt = prompts.homenagem;
  else if (relacao.includes("mae")) basePrompt = prompts.mae;
  else if (relacao.includes("pai")) basePrompt = prompts.pai;
  else if (relacao.includes("avo")) basePrompt = prompts.avo;
  else if (relacao.includes("filh")) basePrompt = prompts.filho;
  else if (relacao.includes("irma")) basePrompt = prompts.familia;
  else if (relacao.includes("amig")) basePrompt = prompts.amizade;
  else if (relacao.includes("professor")) basePrompt = prompts.professor;
  else if (relacao.includes("pastor")) basePrompt = prompts.pastor;
  else if (relacao.includes("colega")) basePrompt = prompts.colega;
  else if (relacao.includes("ex-")) basePrompt = prompts.saudade;
  else if (relacao.includes("mim")) basePrompt = prompts.paramim;
  else if (relacao.includes("namorad") || relacao.includes("espos") || relacao.includes("marido") || relacao.includes("parceir")) basePrompt = prompts.romance;
  const formContext = buildFormContext(formData);
  const recipientName = clean(formData.recipientName);
  const whereItHappened = clean(formData.whereItHappened);
  const hookPhrase = clean(formData.hookPhrase);
  return `${promptMestre}

ORIENTA\xC7\xC3O ESPEC\xCDFICA PARA ESTA RELA\xC7\xC3O/OCASI\xC3O:
${basePrompt}

DADOS DO FORMUL\xC1RIO (use estas informa\xE7\xF5es reais para escrever a letra):
${formContext}

INSTRU\xC7\xD5ES FINAIS:
- A letra DEVE usar o nome do destinat\xE1rio${recipientName ? ` ("${recipientName}")` : ""} de forma natural e emocionante.
${whereItHappened ? `- Refira o local ("${whereItHappened}") na letra quando fizer sentido.
` : ""}${hookPhrase ? `- GANCHO: O refr\xE3o DEVE incorporar ou girar em torno desta frase: "${hookPhrase}".
` : ""}- Evite letras gen\xE9ricas e g\xEDrias for\xE7adas. O tom deve refletir o estilo musical escolhido.
- O campo "letterText" \xE9 uma dedicat\xF3ria CURTA (2-3 frases) em prosa, sem repetir a letra.

INSTRU\xC7\xC3O DE IDIOMA:
${languageInstruction(formData.language || "portugu\xEAs")}`;
}
var init_prompts = __esm({
  "server/services/prompts.ts"() {
    "use strict";
    init_logger();
  }
});

// server/services/aiShared.ts
function classifyAIError(message) {
  if (/no credits|credit balance|credits remaining|quota|balance|insufficient|too low/i.test(message)) return "credits";
  if (/500|502|503|504|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily|too many requests|timeout|timed out|excedeu|ETIMEDOUT|AbortError/i.test(message)) return "transient";
  if (/401|403|unauthorized|authentication|invalid.*key/i.test(message)) return "auth";
  if (/não configurada|nao configurada|missing.*key|no.*key|_MODEL|configuration|configura/i.test(message)) return "config";
  return "other";
}
function retryBackoffMs(attempt, baseDelayMs = RETRY_BASE_DELAY_MS, maxBackoffMs = RETRY_MAX_BACKOFF_MS) {
  const exponential = Math.min(baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)), maxBackoffMs);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exponential * jitter);
}
function clean2(value, fallback = "N\xE3o informado") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}
function repairTruncatedJSON(text) {
  let s = text.trim();
  s = s.replace(/,\s*$/, "");
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;
  for (const ch of s) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") openBraces++;
    else if (ch === "}") openBraces--;
    else if (ch === "[") openBrackets++;
    else if (ch === "]") openBrackets--;
  }
  for (let i = 0; i < openBrackets; i++) s += "]";
  for (let i = 0; i < openBraces; i++) s += "}";
  return s;
}
function extractJSON(text) {
  const cleanText = text.trim();
  try {
    return JSON.parse(cleanText);
  } catch {
  }
  const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
    }
  }
  const firstBrace = cleanText.indexOf("{");
  const lastBrace = cleanText.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
    } catch {
    }
  }
  if (firstBrace !== -1) {
    try {
      return JSON.parse(repairTruncatedJSON(cleanText.slice(firstBrace)));
    } catch {
    }
  }
  throw new Error("N\xE3o foi poss\xEDvel extrair um objeto JSON v\xE1lido da resposta.");
}
function validateComposition(value, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`Resposta ${label} malformada: objeto JSON em falta.`);
  }
  const data = value;
  const songTitle = clean2(data.songTitle, "");
  const lyricsSnippet = clean2(data.lyricsSnippet, "");
  const letterText = clean2(data.letterText, "");
  let lyrics = [];
  if (Array.isArray(data.lyrics)) {
    lyrics = data.lyrics.map((line) => clean2(line, "")).filter(Boolean);
  } else if (typeof data.lyrics === "string") {
    lyrics = data.lyrics.split("\n").map((line) => clean2(line, "")).filter(Boolean);
  }
  const missing = [
    songTitle ? null : "songTitle",
    lyrics.length ? null : "lyrics",
    letterText ? null : "letterText"
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Resposta ${label} malformada: campos em falta (${missing.join(", ")}).`);
  }
  if (lyrics.length < 12 || lyrics.join("\n").length < 100) {
    throw new Error(`Resposta ${label} malformada: letra demasiado curta.`);
  }
  return { songTitle, lyrics, lyricsSnippet, letterText };
}
function normalizeToken(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}
function markerIndex(lines, canonical) {
  const aliases = MARKER_ALIASES[canonical] ?? [];
  for (let i = 0; i < lines.length; i++) {
    if (aliases.includes(normalizeToken(lines[i]))) return i;
  }
  return -1;
}
function validateLyricsStructure(composition, formData = {}) {
  const issues = [];
  const warnings = [];
  const lines = composition.lyrics;
  const found = [];
  for (const marker of LYRIC_MARKERS) {
    const index = markerIndex(lines, marker);
    if (index === -1) {
      issues.push(`faltou o marcador "${marker}"`);
    } else {
      found.push({ canonical: marker, index });
    }
  }
  const inOrder = found.every((entry, i) => i === 0 || entry.index > found[i - 1].index);
  if (!inOrder) {
    issues.push("os marcadores est\xE3o fora da ordem esperada ([Verso 1] \u2192 [Pr\xE9-Refr\xE3o] \u2192 [Refr\xE3o] \u2192 [Verso 2] \u2192 [Ponte Emocional] \u2192 [Refr\xE3o Final])");
  }
  const fullText = lines.join("\n");
  const hook = clean2(formData.hookPhrase, "");
  if (hook) {
    const normHook = normalizeToken(hook);
    if (!normalizeToken(fullText).includes(normHook)) {
      issues.push(`o gancho "${hook}" n\xE3o aparece na letra`);
    }
  }
  const counts = /* @__PURE__ */ new Map();
  for (const line of lines) {
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  const repeated = [...counts.entries()].filter(([, count]) => count > MAX_LINE_REPEATS);
  if (repeated.length > 0) {
    issues.push(`${repeated.length} linha(s) repetida(s) mais de ${MAX_LINE_REPEATS} vezes`);
  }
  const recipientName = clean2(formData.recipientName, "");
  if (recipientName && normalizeToken(recipientName).length >= 2) {
    const searchable = normalizeToken(`${composition.songTitle}
${fullText}`);
    if (!searchable.includes(normalizeToken(recipientName))) {
      warnings.push(`nome do destinat\xE1rio "${recipientName}" n\xE3o aparece na letra nem no t\xEDtulo`);
    }
  }
  const normLyric = normalizeToken(`${composition.songTitle}
${fullText}`);
  const forcedFound = FORCED_LYRIC_TERMS.filter((term) => normLyric.includes(term));
  if (forcedFound.length > 0) {
    warnings.push(`termo(s) possivelmente for\xE7ado(s) na letra: ${forcedFound.map((t) => `"${t}"`).join(", ")}`);
  }
  return { issues, warnings };
}
function validateCompositionStrict(value, label, formData = {}) {
  const composition = validateComposition(value, label);
  const { issues, warnings } = validateLyricsStructure(composition, formData);
  if (issues.length > 0) {
    const criticalIssues = issues.filter(
      (i) => i.includes("faltou o marcador") || i.includes("fora da ordem")
    );
    if (criticalIssues.length > 0) {
      throw new Error(`[${label}] Estrutura da letra inv\xE1lida: ${criticalIssues.join("; ")}`);
    }
    logWarn(`[${label}] Estrutura da letra com problemas (entregue como est\xE1)`, { issues });
  }
  if (warnings.length > 0) {
    logWarn(`[${label}] Personaliza\xE7\xE3o com avisos`, { warnings });
  }
  return composition;
}
async function withAIServiceRetry(label, fn, extraFatalPatterns, options) {
  let lastError;
  const maxAttempts = MAX_ATTEMPTS;
  const transientMaxAttempts = options?.transientMaxAttempts ?? TRANSIENT_MAX_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  const maxBackoffMs = options?.maxBackoffMs ?? RETRY_MAX_BACKOFF_MS;
  const fatal = options?.fatalPatterns ? options.fatalPatterns : extraFatalPatterns ? new RegExp(FATAL_DEFAULT.source + "|" + extraFatalPatterns.source, FATAL_DEFAULT.flags) : FATAL_DEFAULT;
  let attempt = 1;
  for (; ; ) {
    try {
      logInfo(`[${label}] Tentativa ${attempt} de gera\xE7\xE3o de letra...`);
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      logError(`[${label}] Erro na tentativa ${attempt}`, err instanceof Error ? err : new Error(String(err)));
      const message = err instanceof Error ? err.message : String(err ?? "");
      const isTransient = TRANSIENT.test(message);
      const attemptBudget = isTransient ? transientMaxAttempts : maxAttempts;
      if (fatal.test(message) || !RETRYABLE_DEFAULT.test(message) || attempt >= attemptBudget) break;
      const delay3 = retryBackoffMs(attempt, baseDelayMs, maxBackoffMs);
      await new Promise((resolve) => setTimeout(resolve, delay3));
      attempt++;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Falha desconhecida ao gerar letra com ${label}.`);
}
var MAX_ATTEMPTS, TRANSIENT_MAX_ATTEMPTS, RETRY_BASE_DELAY_MS, RETRY_MAX_BACKOFF_MS, FATAL_DEFAULT, RETRYABLE_DEFAULT, TRANSIENT, LYRIC_MARKERS, MARKER_ALIASES, MAX_LINE_REPEATS, FORCED_LYRIC_TERMS;
var init_aiShared = __esm({
  "server/services/aiShared.ts"() {
    "use strict";
    init_logger();
    MAX_ATTEMPTS = Number(process.env.AI_MAX_ATTEMPTS || 2);
    TRANSIENT_MAX_ATTEMPTS = Number(process.env.AI_TRANSIENT_MAX_ATTEMPTS || 4);
    RETRY_BASE_DELAY_MS = Number(process.env.AI_RETRY_BASE_DELAY_MS || 1e3);
    RETRY_MAX_BACKOFF_MS = Number(process.env.AI_RETRY_MAX_BACKOFF_MS || 8e3);
    FATAL_DEFAULT = /429|quota|balance|credit|401|403|unauthorized/i;
    RETRYABLE_DEFAULT = /timeout|excedeu|JSON|malformada|500|502|503|504|ETIMEDOUT|AbortError|429|too many requests|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily/i;
    TRANSIENT = /500|502|503|504|429|high demand|traffic|overloaded|RESOURCE_EXHAUSTED|temporarily|too many requests/i;
    LYRIC_MARKERS = [
      "[Verso 1]",
      "[Pr\xE9-Refr\xE3o]",
      "[Refr\xE3o]",
      "[Verso 2]",
      "[Ponte Emocional]",
      "[Refr\xE3o Final]"
    ];
    MARKER_ALIASES = {
      "[Verso 1]": ["verso 1", "verso i"],
      "[Pr\xE9-Refr\xE3o]": ["pre refrao", "pre-refrao"],
      "[Refr\xE3o]": ["refrao", "refrao 1", "coro", "estribilho"],
      "[Verso 2]": ["verso 2", "verso ii"],
      "[Ponte Emocional]": ["ponte emocional", "ponte"],
      "[Refr\xE3o Final]": ["refrao final", "refrao 2", "ultimo refrao", "refrao final x2", "refrao final (x2)"]
    };
    MAX_LINE_REPEATS = 3;
    FORCED_LYRIC_TERMS = ["ecoa", "candongueiro", "bue", "gargalhada"];
  }
});

// server/services/openai.ts
import OpenAI from "openai";
async function generateLyricsWithGPT(formData) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY n\xE3o configurada no servidor.");
  }
  const prompt = selectPrompt(formData);
  const openai = new OpenAI({ apiKey });
  return withAIServiceRetry("GPT", async () => {
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      max_tokens: 4e3,
      temperature: 0.75,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:

${prompt}` }
      ]
    }, {
      timeout: GPT_TIMEOUT_MS,
      signal: AbortSignal.timeout(GPT_TIMEOUT_MS)
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("GPT retornou conte\xFAdo vazio ou formato inesperado.");
    }
    const json = extractJSON(content);
    return validateCompositionStrict(json, "GPT", formData);
  });
}
var GPT_MODEL, GPT_TIMEOUT_MS, SYSTEM_PROMPT;
var init_openai = __esm({
  "server/services/openai.ts"() {
    "use strict";
    init_prompts();
    init_aiShared();
    GPT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
    GPT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 3e4);
    SYSTEM_PROMPT = `Voc\xEA \xE9 um compositor de est\xFAdio profissional.
Voc\xEA deve produzir a letra da m\xFAsica e a dedicat\xF3ria exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, pre\xE2mbulo ou conclus\xE3o fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "T\xEDtulo Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pr\xE9-Refr\xE3o]",
    "linha 1 do pr\xE9-refr\xE3o...",
    "[Refr\xE3o]",
    "linha 1 do refr\xE3o...",
    "linha 2 do refr\xE3o..."
  ],
  "letterText": "Dedicat\xF3ria curta (2-3 frases) em prosa, sem repetir a letra.",
  "lyricsSnippet": "Pequeno trecho da letra (m\xE1x 200 caracteres) para pr\xE9-visualiza\xE7\xE3o."
}

A letra deve usar EXATAMENTE estes marcadores, cada um numa linha pr\xF3pria do array "lyrics", nesta ordem:
[Verso 1], [Pr\xE9-Refr\xE3o], [Refr\xE3o], [Verso 2], [Ponte Emocional], [Refr\xE3o Final]`;
  }
});

// server/services/claude.ts
import Anthropic from "@anthropic-ai/sdk";
async function withTimeout3(promise, timeoutMs, label, controller) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error(`${label} excedeu o limite de ${timeoutMs}ms.`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function generateLyricsWithClaude(formData) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY n\xE3o configurada no servidor.");
  }
  const prompt = selectPrompt(formData);
  const anthropic = new Anthropic({ apiKey });
  return withAIServiceRetry("Claude", async () => {
    const abortController = new AbortController();
    const responsePromise = anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4e3,
      system: SYSTEM_PROMPT2,
      messages: [
        {
          role: "user",
          content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:

${prompt}`
        }
      ]
    });
    const response = await withTimeout3(
      responsePromise,
      CLAUDE_TIMEOUT_MS,
      "Gera\xE7\xE3o Claude",
      abortController
    );
    const block = response.content[0];
    if (!block || block.type !== "text") {
      throw new Error("Claude retornou conte\xFAdo sem texto ou formato inesperado.");
    }
    const json = extractJSON(block.text);
    return validateCompositionStrict(json, "Claude", formData);
  }, SAFETY_FATAL);
}
var CLAUDE_MODEL, CLAUDE_TIMEOUT_MS, SAFETY_FATAL, SYSTEM_PROMPT2;
var init_claude = __esm({
  "server/services/claude.ts"() {
    "use strict";
    init_prompts();
    init_aiShared();
    CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022";
    CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 6e4);
    SAFETY_FATAL = /SAFETY|FINISH_REASON_SAFETY|blocked/i;
    SYSTEM_PROMPT2 = `Voc\xEA \xE9 um compositor de est\xFAdio profissional.
Voc\xEA deve produzir a letra da m\xFAsica e a dedicat\xF3ria exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, pre\xE2mbulo ou conclus\xE3o fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "T\xEDtulo Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pr\xE9-Refr\xE3o]",
    "linha 1 do pr\xE9-refr\xE3o...",
    "[Refr\xE3o]",
    "linha 1 do refr\xE3o...",
    "linha 2 do refr\xE3o..."
  ],
  "letterText": "Dedicat\xF3ria curta (2-3 frases) em prosa, sem repetir a letra.",
  "lyricsSnippet": "Pequeno trecho da letra (m\xE1x 200 caracteres) para pr\xE9-visualiza\xE7\xE3o."
}

A letra deve usar EXATAMENTE estes marcadores, cada um numa linha pr\xF3pria do array "lyrics", nesta ordem:
[Verso 1], [Pr\xE9-Refr\xE3o], [Refr\xE3o], [Verso 2], [Ponte Emocional], [Refr\xE3o Final]`;
  }
});

// server/services/gemini.ts
import { GoogleGenAI } from "@google/genai";
async function generateLyricsWithGemini(formData) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY n\xE3o configurada no servidor.");
  }
  const prompt = selectPrompt(formData);
  const genAI = new GoogleGenAI({ apiKey });
  const GEMINI_FATAL = /SAFETY|FINISH_REASON_SAFETY|blocked|401|403|unauthorized|invalid.*key/i;
  return withAIServiceRetry("Gemini", async () => {
    const response = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        { role: "user", parts: [{ text: `Gere a musica baseada nestes dados. Retorne apenas o JSON:

${prompt}` }] }
      ],
      config: {
        systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT3 }] },
        maxOutputTokens: 8192,
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });
    const text = response.text;
    if (!text) {
      throw new Error("Gemini retornou conte\xFAdo vazio ou formato inesperado.");
    }
    const json = extractJSON(text);
    return validateCompositionStrict(json, "Gemini", formData);
  }, void 0, { fatalPatterns: GEMINI_FATAL });
}
var GEMINI_MODEL, GEMINI_TIMEOUT_MS, SYSTEM_PROMPT3;
var init_gemini = __esm({
  "server/services/gemini.ts"() {
    "use strict";
    init_prompts();
    init_aiShared();
    GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 9e4);
    SYSTEM_PROMPT3 = `Voc\xEA \xE9 um compositor de est\xFAdio profissional.
Voc\xEA deve produzir a letra da m\xFAsica e a dedicat\xF3ria exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, pre\xE2mbulo ou conclus\xE3o fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "T\xEDtulo Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pr\xE9-Refr\xE3o]",
    "linha 1 do pr\xE9-refr\xE3o...",
    "[Refr\xE3o]",
    "linha 1 do refr\xE3o...",
    "linha 2 do refr\xE3o..."
  ],
  "letterText": "Dedicat\xF3ria curta (2-3 frases) em prosa, sem repetir a letra.",
  "lyricsSnippet": "Pequeno trecho da letra (m\xE1x 200 caracteres) para pr\xE9-visualiza\xE7\xE3o."
}

A letra deve usar EXATAMENTE estes marcadores, cada um numa linha pr\xF3pria do array "lyrics", nesta ordem:
[Verso 1], [Pr\xE9-Refr\xE3o], [Refr\xE3o], [Verso 2], [Ponte Emocional], [Refr\xE3o Final]`;
  }
});

// server/services/deepseek.ts
async function generateLyricsWithDeepSeek(formData) {
  const apiKey = getDeepSeekApiKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY n\xE3o configurada no servidor (ou alias DEEPSEEK_SECRET_KEY).");
  }
  const prompt = selectPrompt(formData);
  const OpenAI2 = (await import("openai")).default;
  const deepseek = new OpenAI2({ apiKey, baseURL: "https://api.deepseek.com" });
  return withAIServiceRetry("DeepSeek", async () => {
    const response = await deepseek.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 4e3,
      temperature: 0.75,
      response_format: { type: "json_object" },
      // DeepSeek: desliga o modo de raciocínio (thinking) para permitir temperatura
      // e reduzir custo/latência. `thinking` é um campo específico da API DeepSeek.
      ...{ thinking: { type: "disabled" } },
      messages: [
        { role: "system", content: SYSTEM_PROMPT4 },
        { role: "user", content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:

${prompt}` }
      ]
    }, {
      timeout: DEEPSEEK_TIMEOUT_MS,
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS)
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek retornou conte\xFAdo vazio ou formato inesperado.");
    }
    const json = extractJSON(content);
    return validateCompositionStrict(json, "DeepSeek", formData);
  });
}
var DEEPSEEK_MODEL, DEEPSEEK_TIMEOUT_MS, SYSTEM_PROMPT4;
var init_deepseek = __esm({
  "server/services/deepseek.ts"() {
    "use strict";
    init_prompts();
    init_aiShared();
    init_deepseekConfig();
    DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
    DEEPSEEK_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 3e4);
    SYSTEM_PROMPT4 = `Voc\xEA \xE9 um compositor de est\xFAdio profissional.
Voc\xEA deve produzir a letra da m\xFAsica e a dedicat\xF3ria exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, pre\xE2mbulo ou conclus\xE3o fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "T\xEDtulo Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pr\xE9-Refr\xE3o]",
    "linha 1 do pr\xE9-refr\xE3o...",
    "[Refr\xE3o]",
    "linha 1 do refr\xE3o...",
    "linha 2 do refr\xE3o..."
  ],
  "letterText": "Dedicat\xF3ria curta (2-3 frases) em prosa, sem repetir a letra.",
  "lyricsSnippet": "Pequeno trecho da letra (m\xE1x 200 caracteres) para pr\xE9-visualiza\xE7\xE3o."
}

A letra deve usar EXATAMENTE estes marcadores, cada um numa linha pr\xF3pria do array "lyrics", nesta ordem:
[Verso 1], [Pr\xE9-Refr\xE3o], [Refr\xE3o], [Verso 2], [Ponte Emocional], [Refr\xE3o Final]`;
  }
});

// server/services/ai.ts
var ai_exports = {};
__export(ai_exports, {
  generateLyrics: () => generateLyrics
});
function providerOrder() {
  const raw = process.env.AI_PROVIDER_ORDER;
  if (!raw) return DEFAULT_PROVIDER_ORDER;
  const order = raw.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s === "deepseek" || s === "openai" || s === "gemini" || s === "claude");
  return order.length ? order : DEFAULT_PROVIDER_ORDER;
}
async function withTimeout4(promise, ms, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Provedor ${name} excedeu o tempo limite (${ms / 1e3}s)`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
async function generateLyrics(formData, context = {}) {
  const providers = [
    { name: "deepseek", key: "DEEPSEEK_API_KEY", fn: generateLyricsWithDeepSeek },
    { name: "openai", key: "OPENAI_API_KEY", fn: generateLyricsWithGPT },
    { name: "gemini", key: "GEMINI_API_KEY", fn: generateLyricsWithGemini },
    { name: "claude", key: "ANTHROPIC_API_KEY", fn: generateLyricsWithClaude }
  ];
  const available = providers.filter((p) => p.name === "deepseek" ? hasDeepSeekApiKey() : !!process.env[p.key]);
  if (available.length === 0) {
    throw new Error("Nenhuma chave de API de IA configurada (DEEPSEEK_API_KEY/DEEPSEEK_SECRET_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY).");
  }
  const order = providerOrder();
  available.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  let lastError;
  const providerFailures = [];
  for (const { name, fn } of available) {
    try {
      logInfo(`[AI] A tentar provedor: ${name}`);
      const result = await withTimeout4(fn(formData), AI_PROVIDER_TIMEOUT_MS, name);
      logInfo(`[AI] Letra gerada com sucesso via ${name}`);
      return { result, provider: name };
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      providerFailures.push({ provider: name, kind: classifyAIError(message), message });
      logWarn(`[AI] Provedor ${name} falhou: ${message}`);
    }
  }
  logError("[AI] Todos os provedores falharam", lastError);
  await notifyAdminOnFailure(providerFailures, context);
  const finalError = lastError instanceof Error ? lastError : new Error("Nenhuma API de IA funcionou.");
  finalError.providerFailures = providerFailures;
  throw finalError;
}
async function notifyAdminOnFailure(failures, context) {
  const now = Date.now();
  if (now - lastAdminAlertAt < ADMIN_ALERT_COOLDOWN_MS) {
    logInfo("[AI] Alerta admin suprimido (cooldown)");
    return;
  }
  lastAdminAlertAt = now;
  const detail = failures.map((f) => `- ${f.provider}: ${f.kind} \u2014 ${f.message.slice(0, 300)}`).join("\n");
  const who = context.email ? `Utilizador: ${context.email}` : "";
  const which = context.requestId ? `Request ID: ${context.requestId}` : "";
  try {
    await sendAdminNotification(
      `[ALERTA] Falha na gera\xE7\xE3o de letras (${failures.length} providers)`,
      `Todos os provedores de IA falharam:

${detail}

${[who, which].filter(Boolean).join("\n")}

Contacte o utilizador ou verifique as chaves/quotas.`
    );
    logInfo("[AI] Alerta admin enviado com sucesso");
  } catch (err) {
    logWarn("[AI] Falha ao enviar alerta admin", err instanceof Error ? err : new Error(String(err)));
  }
}
var AI_PROVIDER_TIMEOUT_MS, ADMIN_ALERT_COOLDOWN_MS, lastAdminAlertAt, DEFAULT_PROVIDER_ORDER;
var init_ai = __esm({
  "server/services/ai.ts"() {
    "use strict";
    init_openai();
    init_claude();
    init_gemini();
    init_deepseek();
    init_deepseekConfig();
    init_aiShared();
    init_email();
    init_logger();
    AI_PROVIDER_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 12e4);
    ADMIN_ALERT_COOLDOWN_MS = Number(process.env.ADMIN_ALERT_COOLDOWN_MS || 15 * 60 * 1e3);
    lastAdminAlertAt = 0;
    DEFAULT_PROVIDER_ORDER = ["deepseek", "gemini", "openai", "claude"];
  }
});

// api/vercel-entry.ts
import "dotenv/config";

// server/config/app.ts
init_env();
import express4 from "express";

// server/middleware/errorHandler.ts
init_logger();
var KNOWN_ERRORS = {
  413: "O ficheiro enviado \xE9 demasiado grande. M\xE1ximo 10MB."
};
function errorHandler(error, req, res, next) {
  const status2 = error.status ?? error.statusCode ?? 500;
  const message = error.message || "Erro interno do servidor";
  logWarn("Request error", {
    path: req.path,
    method: req.method,
    status: status2,
    message,
    stack: error.stack
  });
  res.status(status2).json({
    success: false,
    error: KNOWN_ERRORS[status2] || (status2 === 500 ? "Erro interno do servidor" : message)
  });
}

// server/middleware/security.ts
init_env();
init_logger();
import helmet from "helmet";
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowedOrigin = getEnv("ALLOWED_ORIGIN", ENV.NODE_ENV === "production" ? "" : "*");
  if (allowedOrigin === "*") {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && (allowedOrigin === origin || allowedOrigin.split(",").map((s) => s.trim()).includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
function helmetMiddleware() {
  return helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://connect.facebook.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "https://www.facebook.com", "https://fbcdn.net"],
        mediaSrc: ["'self'", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.supabase.co",
          "https://www.facebook.com",
          "https://*.sentry.io",
          "https://*.ingest.sentry.io",
          "https://*.ingest.de.sentry.io",
          "https://*.ecs.us-west-2.on.aws",
          "https://*.vercel.app",
          "https://*.capi.graph.facebook.com"
        ],
        workerSrc: ["'self'", "blob:"],
        frameSrc: ["'self'", "https://www.facebook.com", "https://web.facebook.com"],
        formAction: ["'self'", "https://www.facebook.com"],
        frameAncestors: ["'none'"]
      }
    } : false,
    strictTransportSecurity: process.env.NODE_ENV === "production" ? {
      maxAge: 31536e3,
      includeSubDomains: true
    } : false,
    crossOriginEmbedderPolicy: false
  });
}
function permissionsPolicyMiddleware(_req, res, next) {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  next();
}
var SKIP_LOG_PATHS = ["/health", "/favicon.ico", "/robots.txt"];
var SKIP_LOG_METHODS = ["OPTIONS"];
function httpLogger(req, res, next) {
  if (SKIP_LOG_METHODS.includes(req.method) || SKIP_LOG_PATHS.includes(req.path)) {
    return next();
  }
  const startTime = Date.now();
  res.on("finish", () => {
    logHttp(`${req.method} ${req.path}`, {
      status: res.statusCode,
      duration: `${Date.now() - startTime}ms`,
      ip: req.ip
    });
  });
  next();
}

// server/middleware/requestId.ts
import { randomUUID } from "node:crypto";
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

// server/middleware/adminIpRestriction.ts
init_env();
init_logger();
function adminIpRestriction(req, res, next) {
  const allowedIps = getEnv("ADMIN_ALLOWED_IPS", "");
  if (!allowedIps) return next();
  const ips = allowedIps.split(",").map((ip) => ip.trim());
  const clientIp = req.ip || req.socket.remoteAddress || "";
  const allowed = ips.some((allowed2) => allowed2 === clientIp);
  if (!allowed) {
    logWarn("Admin IP restriction denied", { ip: clientIp });
    res.status(403).json({ error: "Acesso n\xE3o autorizado." });
    return;
  }
  next();
}

// server/middleware/csrf.ts
init_env();
var ALLOWED_ORIGIN = getEnv("ALLOWED_ORIGIN", "");
function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const origin = req.headers["origin"];
  const allowedOrigins = ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(",").map((s) => s.trim()) : [];
  if (allowedOrigins.length > 0 && origin) {
    const isAllowed = allowedOrigins.some((a) => origin === a || origin === a.replace(/\/$/, ""));
    if (!isAllowed) {
      res.status(403).json({ error: "Requisi\xE7\xE3o rejeitada por seguran\xE7a (origem inv\xE1lida)." });
      return;
    }
  }
  next();
}

// server/config/app.ts
init_logger();
init_supabase();

// server/routes/admin.ts
init_supabase();
init_storage();
import express from "express";

// server/middleware/auth.ts
import { timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
function getAdminPassword() {
  return process.env.ADMIN_PASSWORD;
}
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET n\xE3o configurado ou demasiado curto (m\xEDn. 16 caracteres).");
  }
  return secret;
}
var ATTEMPT_LIMIT = 10;
var WINDOW_MS = 15 * 60 * 1e3;
var CLEANUP_MS = 60 * 60 * 1e3;
var attempts = /* @__PURE__ */ new Map();
function timingSafeCompare(a, b) {
  const maxLen = 256;
  const bufA = Buffer.alloc(maxLen, a);
  const bufB = Buffer.alloc(maxLen, b);
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
function isRateLimited(ip) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  if (entry.count > ATTEMPT_LIMIT) return true;
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt + CLEANUP_MS) {
      attempts.delete(ip);
    }
  }
}, CLEANUP_MS).unref();
function adminLogin(req, res) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, error: "Demasiadas tentativas. Tente novamente mais tarde." });
  }
  const { password } = req.body;
  const adminPassword = getAdminPassword();
  if (!adminPassword) {
    return res.status(500).json({ success: false, error: "ADMIN_PASSWORD n\xE3o configurado no servidor." });
  }
  if (!password || !timingSafeCompare(String(password), adminPassword)) {
    return res.status(401).json({ success: false, error: "Password inv\xE1lida." });
  }
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return res.status(500).json({ success: false, error: "JWT_SECRET n\xE3o configurado." });
  }
  const token = jwt.sign({ role: "admin", iat: Date.now() }, secret, { expiresIn: "2h" });
  res.json({ success: true, token, expiresIn: 7200 });
}
function adminAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  let secret;
  try {
    secret = getJwtSecret();
  } catch {
    return res.status(500).json({ success: false, error: "JWT_SECRET n\xE3o configurado." });
  }
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      jwt.verify(token, secret);
      return next();
    } catch {
      return res.status(401).json({ success: false, error: "Sess\xE3o expirada. Fa\xE7a login novamente." });
    }
  }
  return res.status(401).json({ success: false, error: "Acesso n\xE3o autorizado." });
}

// server/services/workflow/progress.ts
var PROGRESS_TTL_MS = 30 * 60 * 1e3;
var requestProgressMap = {};
function setProgress(requestId, progress2) {
  requestProgressMap[requestId] = { ...progress2, updatedAt: Date.now() };
}
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of Object.entries(requestProgressMap)) {
    if (now - p.updatedAt > PROGRESS_TTL_MS) delete requestProgressMap[id];
  }
}, 6e4).unref();
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[Timeout] ${label} exceeded ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// server/services/workflow/statusPersistence.ts
init_supabase();
function adminErrorDetails(stage, err) {
  return {
    stage,
    message: err instanceof Error ? err.message : String(err ?? ""),
    name: err instanceof Error ? err.name : typeof err,
    at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function updateRequestStatus(requestId, status2, err) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error("Supabase client nao inicializado.");
  const payload = { status: status2 };
  if (err) payload.error_details = adminErrorDetails(status2, err);
  const { error } = await supabase.from("song_requests").update(payload).eq("id", requestId);
  if (!error) return;
  if (err && /error_details/i.test(error.message || "")) {
    const { error: fallbackError } = await supabase.from("song_requests").update({ status: status2 }).eq("id", requestId);
    if (!fallbackError) return;
    throw fallbackError;
  }
  throw error;
}

// server/services/workflow/audioPersistence.ts
init_storage();
import path2 from "path";
import fs5 from "fs";
import os from "os";

// server/services/audio.ts
init_logger();
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import ffprobeInstaller from "ffprobe-static";
import fs4 from "fs";
import { execFileSync, spawn } from "child_process";
import { Readable as Readable2 } from "stream";
import { pipeline } from "stream/promises";
var FFMPEG_AVAILABLE = null;
var FFPROBE_AVAILABLE = null;
var FFPROBE_PATH = null;
function ensureFfmpeg() {
  if (FFMPEG_AVAILABLE !== null) return FFMPEG_AVAILABLE;
  if (ffmpegInstaller) {
    try {
      ffmpeg.setFfmpegPath(ffmpegInstaller);
      execFileSync(ffmpegInstaller, ["-version"], { stdio: "pipe", timeout: 1e4 });
      logInfo("[Audio] FFmpeg dispon\xEDvel e funcional");
      FFMPEG_AVAILABLE = true;
    } catch (err) {
      logWarn(`[Audio] FFmpeg n\xE3o dispon\xEDvel: ${err instanceof Error ? err.message : String(err)}`);
      FFMPEG_AVAILABLE = false;
    }
  } else {
    logWarn("[Audio] ffmpeg-static n\xE3o instalado");
    FFMPEG_AVAILABLE = false;
  }
  return FFMPEG_AVAILABLE;
}
function ensureFfprobe() {
  if (FFPROBE_AVAILABLE !== null) return FFPROBE_AVAILABLE;
  if (ffprobeInstaller?.path) {
    try {
      execFileSync(ffprobeInstaller.path, ["-version"], { stdio: "pipe", timeout: 5e3 });
      FFPROBE_PATH = ffprobeInstaller.path;
      logInfo("[Audio] FFprobe dispon\xEDvel e funcional");
      FFPROBE_AVAILABLE = true;
    } catch {
      logWarn("[Audio] FFprobe n\xE3o dispon\xEDvel, dura\xE7\xE3o de \xE1udio ser\xE1 detectada via stderr do ffmpeg");
      FFPROBE_AVAILABLE = false;
    }
  } else {
    logWarn("[Audio] ffprobe-static n\xE3o instalado, dura\xE7\xE3o de \xE1udio ser\xE1 detectada via stderr do ffmpeg");
    FFPROBE_AVAILABLE = false;
  }
  return FFPROBE_AVAILABLE;
}
var DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS || 3e5);
function getAudioDurationFfmpeg(inputPath) {
  return new Promise((resolve) => {
    if (!ensureFfmpeg() || !ffmpegInstaller) {
      resolve(0);
      return;
    }
    const ffmpegProc = spawn(ffmpegInstaller, ["-i", inputPath], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    ffmpegProc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    ffmpegProc.on("close", () => {
      const match = stderr.match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseFloat(match[3]);
        resolve(hours * 3600 + minutes * 60 + seconds);
      } else {
        resolve(0);
      }
    });
    ffmpegProc.on("error", () => resolve(0));
    setTimeout(() => {
      try {
        ffmpegProc.kill();
      } catch {
      }
      resolve(0);
    }, 15e3);
  });
}
async function getAudioDuration(inputPath) {
  if (!ensureFfprobe() || !FFPROBE_PATH) {
    return getAudioDurationFfmpeg(inputPath);
  }
  const probePath = FFPROBE_PATH;
  return new Promise((resolve) => {
    const ffprobe = spawn(probePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath
    ]);
    let output = "";
    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });
    ffprobe.on("close", (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      } else {
        resolve(0);
      }
    });
    ffprobe.on("error", () => resolve(0));
    setTimeout(() => {
      ffprobe.kill();
      resolve(0);
    }, 1e4);
  });
}
function applyFadeInOnly(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ensureFfmpeg()) {
      reject(new Error("FFmpeg indispon\xEDvel para aplicar fade-in."));
      return;
    }
    ffmpeg(inputPath).audioFilters("afade=t=in:ss=0:d=3").output(outputPath).on("end", () => {
      logInfo("[Audio] Fade-in aplicado (\xE1udio curto - s\xF3 fade-in)");
      resolve();
    }).on("error", (err) => {
      logError("[Audio] Erro no FFmpeg ao aplicar fade-in", err);
      reject(err);
    }).run();
  });
}
async function downloadFile(url, destPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SeuBeat/1.0 (+https://seubeat.vercel.app)",
        "Accept": "audio/*, */*"
      }
    });
    if (!res.ok) throw new Error(`Falha ao descarregar arquivo: ${res.statusText}`);
    if (!res.body) throw new Error("Resposta de download sem corpo.");
    await pipeline(Readable2.fromWeb(res.body), fs4.createWriteStream(destPath));
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Download timeout after ${DOWNLOAD_TIMEOUT_MS}ms: ${url}`);
    }
    throw err instanceof Error ? err : new Error(`Download failed: ${String(err)} \u2014 ${url}`);
  } finally {
    clearTimeout(timeout);
  }
}
async function applyFades(inputPath, outputPath) {
  if (!ensureFfmpeg()) {
    throw new Error("FFmpeg indispon\xEDvel para aplicar fades.");
  }
  const duration = await getAudioDuration(inputPath);
  if (duration > 0 && duration < 8) {
    return applyFadeInOnly(inputPath, outputPath);
  }
  if (duration <= 0) {
    return applyFadeInOnly(inputPath, outputPath);
  }
  const fadeOutStart = Math.max(0, duration - 4);
  const fadeOutFilter = `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=4`;
  const filter = `afade=t=in:ss=0:d=3,${fadeOutFilter}`;
  return new Promise((resolve, reject) => {
    const FADE_TIMEOUT_MS = 12e4;
    let settled = false;
    const cmd = ffmpeg(inputPath).audioFilters(filter).output(outputPath).on("end", () => {
      if (settled) return;
      settled = true;
      clearTimeout(fadeTimer);
      logInfo(`[Audio] Fades aplicados com sucesso! (dura\xE7\xE3o: ${duration.toFixed(1)}s, fade-out em ${fadeOutStart.toFixed(1)}s)`);
      resolve();
    }).on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(fadeTimer);
      logError("[Audio] Erro no FFmpeg ao aplicar fades", err);
      reject(err);
    });
    cmd.run();
    const fadeTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        cmd.kill("SIGKILL");
      } catch {
      }
      reject(new Error(`applyFades timeout after ${FADE_TIMEOUT_MS}ms on ${inputPath}`));
    }, FADE_TIMEOUT_MS);
  });
}
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    if (!ensureFfmpeg()) {
      reject(new Error("FFmpeg indispon\xEDvel para converter \xE1udio."));
      return;
    }
    ffmpeg(inputPath).audioCodec("pcm_s16le").audioChannels(1).audioFrequency(44100).output(outputPath).on("end", () => {
      logInfo("[Audio] \xC1udio convertido para WAV com sucesso!");
      resolve();
    }).on("error", (err) => {
      logError("[Audio] Erro no FFmpeg ao converter para WAV", err);
      reject(err);
    }).run();
  });
}

// server/services/workflow/audioPersistence.ts
init_helpers();
init_logger();
var MIN_SONG_DURATION_SEC = 30;
var UPLOAD_TIMEOUT_MS = 2 * 60 * 1e3;
var PERSIST_AUDIO_TIMEOUT_MS = 5 * 6e4;
var PERSIST_LIGHT_TIMEOUT_MS = 3 * 6e4;
async function persistGeneratedSunoAudio(songId, taskId, audioUrl, opts) {
  const fileInfo = getAudioFileInfo(audioUrl);
  const tempSunoPath = path2.join(os.tmpdir(), `${songId}_suno.${fileInfo.ext}`);
  const tempFadedPath = path2.join(os.tmpdir(), `${songId}_faded.${fileInfo.ext}`);
  const tempPreviewPath = path2.join(os.tmpdir(), `${songId}_preview.mp3`);
  const mem = () => {
    const m = process.memoryUsage();
    return { rss: `${(m.rss / 1048576).toFixed(0)}MB`, heap: `${(m.heapUsed / 1048576).toFixed(0)}MB` };
  };
  try {
    logInfo("[Workflow] persistGeneratedSunoAudio start", { songId, taskId, skipProcessing: !!opts?.skipProcessing, mem: mem() });
    await downloadFile(audioUrl, tempSunoPath);
    logInfo("[Workflow] Download complete", { songId, mem: mem() });
    if (opts?.skipProcessing) {
      const uploadSizeMB2 = (fs5.statSync(tempSunoPath).size / (1024 * 1024)).toFixed(1);
      const originalFilename2 = `songs/${songId}_original.${fileInfo.ext}`;
      logInfo("[Workflow] Lightweight persist: uploading raw audio", { songId, taskId, sizeMB: uploadSizeMB2, mem: mem() });
      const fullAudioUrl2 = await withTimeout(
        uploadFileToStorage("full-audio", originalFilename2, tempSunoPath, fileInfo.mimeType),
        UPLOAD_TIMEOUT_MS,
        `uploadFileToStorage(full-audio/${originalFilename2})`
      );
      logInfo("[Workflow] Lightweight persist: upload done", { songId, taskId, url: fullAudioUrl2, mem: mem() });
      const durationInt2 = opts.hintDuration != null ? Math.round(opts.hintDuration) : null;
      return { taskId, fullAudioUrl: fullAudioUrl2, publicPreviewUrl: null, duration: durationInt2 };
    }
    const durationSec = await getAudioDuration(tempSunoPath);
    logInfo("[Workflow] Audio duration check", { songId, taskId, durationSec, mem: mem() });
    if (durationSec > 0 && durationSec < MIN_SONG_DURATION_SEC) {
      throw new Error(
        `\xC1udio gerado demasiado curto (${durationSec.toFixed(1)}s < ${MIN_SONG_DURATION_SEC}s). O Suno devolveu apenas um clip parcial.`
      );
    }
    const durationInt = durationSec > 0 ? Math.round(durationSec) : null;
    try {
      await applyFades(tempSunoPath, tempFadedPath);
      logInfo("[Workflow] Fades complete, cleaning up original", { songId, mem: mem() });
      try {
        fs5.unlinkSync(tempSunoPath);
      } catch {
      }
    } catch (fadeErr) {
      logWarn("[Workflow] Fades falharam, a usar \xE1udio original", fadeErr instanceof Error ? fadeErr : void 0);
      fs5.copyFileSync(tempSunoPath, tempFadedPath);
    }
    const fadedFileExists = fs5.existsSync(tempFadedPath) && fs5.statSync(tempFadedPath).size > 0;
    const uploadSource = fadedFileExists ? tempFadedPath : tempSunoPath;
    const uploadSizeMB = (fs5.statSync(uploadSource).size / (1024 * 1024)).toFixed(1);
    const originalFilename = `songs/${songId}_original.${fileInfo.ext}`;
    logInfo("[Workflow] Uploading full audio to storage", { songId, taskId, sizeMB: uploadSizeMB, provider: process.env.STORAGE_PROVIDER || "r2", mem: mem() });
    const fullAudioUrl = await withTimeout(
      uploadFileToStorage("full-audio", originalFilename, uploadSource, fileInfo.mimeType),
      UPLOAD_TIMEOUT_MS,
      `uploadFileToStorage(full-audio/${originalFilename})`
    );
    logInfo("[Workflow] Full audio uploaded successfully", { songId, taskId, url: fullAudioUrl, mem: mem() });
    if (uploadSource === tempFadedPath) {
      try {
        fs5.unlinkSync(tempFadedPath);
      } catch {
      }
    }
    return { taskId, fullAudioUrl, publicPreviewUrl: null, duration: durationInt };
  } finally {
    try {
      fs5.unlinkSync(tempSunoPath);
    } catch {
    }
    try {
      fs5.unlinkSync(tempFadedPath);
    } catch {
    }
    try {
      fs5.unlinkSync(tempPreviewPath);
    } catch {
    }
  }
}

// server/services/workflow/sunoOrchestration.ts
init_supabase();

// server/services/suno.ts
init_logger();

// server/utils/circuitBreaker.ts
init_logger();
var breakers = /* @__PURE__ */ new Map();
function createCircuitBreaker(name, options) {
  const opts = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 6e4,
    name,
    ...options
  };
  const state = {
    state: "closed",
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  };
  breakers.set(name, state);
  return {
    getState: () => state.state,
    reset: () => {
      state.state = "closed";
      state.failures = 0;
      state.successes = 0;
      state.nextAttemptTime = 0;
    },
    async exec(fn) {
      if (state.state === "open") {
        if (Date.now() >= state.nextAttemptTime) {
          state.state = "half-open";
          logWarn(`[CircuitBreaker:${opts.name}] Half-open, tentando novamente`);
        } else {
          throw new Error(`Circuito aberto para ${opts.name}. Tentar novamente em ${Math.ceil((state.nextAttemptTime - Date.now()) / 1e3)}s.`);
        }
      }
      try {
        const result = await fn();
        state.successes++;
        state.failures = 0;
        if (state.state === "half-open" && state.successes >= opts.successThreshold) {
          state.state = "closed";
          state.successes = 0;
          logInfo(`[CircuitBreaker:${opts.name}] Circuito fechado ap\xF3s ${opts.successThreshold} sucessos`);
        }
        return result;
      } catch (err) {
        state.failures++;
        state.lastFailureTime = Date.now();
        if (state.failures >= opts.failureThreshold) {
          state.state = "open";
          state.nextAttemptTime = Date.now() + opts.timeout;
          logError(`[CircuitBreaker:${opts.name}] Circuito aberto ap\xF3s ${state.failures} falhas`, err instanceof Error ? err : void 0);
        }
        throw err;
      }
    }
  };
}

// server/services/suno.ts
var sunoBreaker = createCircuitBreaker("suno-api", {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 6e4
});
var SUNO_TIMEOUT_MS = Number(process.env.SUNO_TIMEOUT_MS || 45e3);
var MAX_RETRIES = Number(process.env.SUNO_MAX_RETRIES || 3);
var SUCCESS_STATUSES = /* @__PURE__ */ new Set(["success", "completed", "done", "finished", "succeeded"]);
var FAILED_STATUSES = /* @__PURE__ */ new Set([
  "failed",
  "failure",
  "error",
  "cancelled",
  "canceled",
  "create_task_failed",
  "generate_audio_failed",
  "sensitive_word_error",
  "callback_exception"
]);
var DEFAULT_PUBLIC_APP_URL = "https://seubeat.vercel.app";
function isQuotaError(status2, body) {
  return status2 === 429 || /quota|rate\s?limit|exceeded/i.test(body);
}
function getRetryDelay(attempt, retryAfter) {
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds) && seconds > 0) return seconds * 1e3;
  }
  return Math.min(1e3 * Math.pow(2, attempt - 1) + Math.random() * 500, 3e4);
}
var SunoQuotaError = class extends Error {
  constructor(msg) {
    super(msg);
    this.name = "SunoQuotaError";
  }
};
async function fetchWithTimeout(url, init = {}, timeoutMs = SUNO_TIMEOUT_MS, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const partialBody = await res.clone().text().then((t) => t.slice(0, 500)).catch(() => "");
      if (isQuotaError(res.status, partialBody) && attempt < retries) {
        const backoff = getRetryDelay(attempt, res.headers.get("retry-after"));
        logWarn(`[Suno] Quota/rate limit, retrying`, { status: res.status, attempt, retries, backoff });
        clearTimeout(timeout);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      if (isQuotaError(res.status, partialBody) && attempt >= retries) {
        throw new SunoQuotaError(`Suno quota excedida: ${res.status}. Verifica o teu plano em sunoapi.org.`);
      }
      return res;
    } catch (err) {
      if (err instanceof SunoQuotaError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Suno request timeout after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        const delay3 = getRetryDelay(attempt);
        logWarn(`[Suno] Attempt failed, retrying`, { attempt, retries, error: err instanceof Error ? err.message : String(err), delay: delay3 });
        await new Promise((r) => setTimeout(r, delay3));
        continue;
      }
      logError("[Suno] Fetch failed after all retries", err instanceof Error ? err : new Error(String(err)), { url, retries });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Suno request failed after ${retries} retries`);
}
async function safeResponseText(res) {
  const text = await res.text();
  return text.slice(0, 800);
}
function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
function isImageUrl(key, url) {
  return key.includes("image") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url) || /\/image[_-]/i.test(url);
}
function isLikelyAudioUrl(key, url) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isImageUrl(key, url)) return false;
  return key.includes("audio") || key.includes("song") || /\.(mp3|wav|flac|m4a|aac|ogg)(\?|$)/i.test(url) || /cdn\d*\.suno\.ai\/(?!image[_-])/i.test(url);
}
function collectAudioUrls(value, urls = []) {
  if (!value || typeof value !== "object") return urls;
  if (Array.isArray(value)) {
    for (const item of value) collectAudioUrls(item, urls);
    return urls;
  }
  const record = value;
  for (const [key, nestedValue] of Object.entries(record)) {
    const lowerKey = key.toLowerCase();
    if (typeof nestedValue === "string" && isLikelyAudioUrl(lowerKey, nestedValue)) {
      urls.push(nestedValue);
    }
    if (nestedValue && typeof nestedValue === "object") {
      collectAudioUrls(nestedValue, urls);
    }
  }
  return urls;
}
var STYLE_MAP = {
  kizomba: "kizomba, Fender Stratocaster clean tone, deep smooth bass guitar, Roland TR-808 drum machine, warm synthesizer pads, sensual slow groove, 75bpm, professional studio mix, analog warmth",
  semba: "semba, acoustic nylon-string guitar, traditional angolan bateria percussion, cavaquinho, bright bass guitar, live band feel, 115bpm, warm analog recording, Luanda nightlife energy",
  zouk: "zouk, Caribbean romantic, synthesizer pads, electronic drums, smooth bass, electric guitar arpeggios, 95bpm, polished studio production, island vibes",
  samba: "samba, surdo bass drum, caixa snare, pandeiro tambourine, tamborim, agogo bells, cavaquinho, carnival celebration, 125bpm, live percussion ensemble, festive Brazilian rhythm",
  afrobeat: "afrobeat, Fela Kuti style, tenor saxophone, trumpet section, electric guitar interlocking riffs, congas, shekere, talking drum, 110bpm, polyrhythmic layers, horn-driven groove",
  funk: "funk angolano, electronic beat, heavy 808 bass, synthesizer leads, scratchy rhythm guitar, syncopated drum machine, 125bpm, club-ready production, dance floor anthem",
  trap: "trap, 808 sub-bass, rolling hi-hats, dark synthesizer, snare rolls, ambient pads, 140bpm, modern hip hop production, atmospheric dark vibe",
  rap: "rap, boom bap drums, sampled piano loops, deep bass, vinyl crackle, 90bpm, underground hip hop feel, gritty street production",
  reggae: "reggae, offbeat guitar skank, deep bass guitar, Hammond organ, one-drop drums, 80bpm, Jamaican studio vibe, warm analog sound",
  pop: "pop, catchy synthesizer hook, four-on-the-floor drums, polished bass, radio-ready production, 120bpm, modern studio sheen, sing-along chorus",
  balada: "ballad, Yamaha grand piano, orchestral strings, emotional crescendo, soft drums building to powerful, 70bpm, cinematic orchestration, tear-jerking emotion",
  gospel: "gospel, Hammond B3 organ, gospel piano, choir harmonies, tambourine, 80bpm, church choir energy, spiritual uplifting, full rich sound",
  acoustic: "acoustic, fingerpicked nylon-string guitar, minimal percussion, warm natural sound, 80bpm, stripped-down unplugged session, raw honest emotion",
  "romantic pop": "romantic pop, emotional piano, lush string arrangement, synthesizer pads, gentle drums, 90bpm, modern radio ballad, polished emotional production",
  "r&b": "contemporary R&B, Fender Rhodes electric piano, smooth synthesizer, deep bass, neo-soul drums, 85bpm, slow jam groove, sensual intimate production",
  hino: "anthem, full orchestra, brass section, choir, timpani drums, epic cinematic, 80bpm, grandiose production, inspirational triumphant"
};
function extractTaskId(payload) {
  const p = payload;
  return firstString(
    p["taskId"],
    p["task_id"],
    p["data"]?.["taskId"],
    p["data"]?.["task_id"],
    p["id"],
    p["data"]?.["id"]
  );
}
function extractStatus(payload) {
  const p = payload;
  const rawStatus = firstString(
    p["status"],
    p["state"],
    p["data"]?.["status"],
    p["data"]?.["state"],
    p["task_status"],
    p["data"]?.["task_status"]
  );
  return (rawStatus || "processing").toLowerCase();
}
function extractBothAudioUrls(payload) {
  const p = payload;
  const data = p["data"];
  const response = p["response"];
  const sunoData = data?.["response"]?.["sunoData"] || response?.["sunoData"];
  const validUrls = [];
  if (Array.isArray(sunoData) && sunoData.length > 0) {
    for (const item of sunoData) {
      const url = firstString(
        item?.["audioUrl"],
        item?.["audio_url"],
        item?.["sourceAudioUrl"],
        item?.["source_audio_url"],
        item?.["streamAudioUrl"],
        item?.["sourceStreamAudioUrl"]
      );
      if (url && isLikelyAudioUrl("audio", url)) validUrls.push(url);
    }
  }
  if (validUrls.length < 2) {
    const allUrls = collectAudioUrls(payload);
    for (const url of allUrls) {
      if (validUrls.length >= 2) break;
      if (!validUrls.includes(url)) validUrls.push(url);
    }
  }
  return { v1: validUrls[0] || null, v2: validUrls[1] || null };
}
var VOICE_STYLE_MAP = {
  masculina: "male vocal, professional studio recording, warm baritone tone, natural vibrato, emotional depth, crisp clear articulation",
  feminina: "female vocal, professional studio recording, expressive soprano tone, natural vibrato, emotional range, crystal clear diction",
  dueto: "male and female duet, call and response, harmonized vocal layers, romantic interplay, professional studio recording, blended voices, emotional chemistry",
  // Token explícito para 'sem preferência' — antes era '' (string vazia), o que
  // resultava em NENHUM token de voz no stylePrompt (H1). Um lead vocal neutro
  // mas forte dá um sinal de timbre claro sem pinar género.
  "sem prefer\xEAncia": "expressive lead vocal, professional studio recording, dynamic delivery, clear articulation"
};
var EMOTION_STYLE_MAP = {
  amor: "romantic, intimate, vulnerable, love ballad",
  emo\u00E7\u00E3o: "emotional, heartfelt, touching, deep feeling",
  gratid\u00E3o: "grateful, warm, appreciative",
  carinho: "tender, affectionate, gentle",
  saudade: "melancholic, nostalgic, wistful",
  inspira\u00E7\u00E3o: "uplifting, inspiring, hopeful"
};
var ACCENT_STYLE_MAP = {
  // Africanos/Angolanos — sotaque + ritmo africano natural
  kizomba: "Angolan Portuguese vocal, Luanda accent, smooth sensual delivery",
  semba: "Angolan Portuguese vocal, Luanda accent, energetic rhythmic delivery",
  zouk: "Angolan Portuguese vocal, Luanda accent, romantic smooth delivery",
  afrobeat: "Angolan Portuguese vocal, energetic West African-influenced delivery",
  funk: "Angolan Portuguese vocal, urban energetic delivery",
  // Internacionais — sotaque Angolano SEM "African rhythm cadence"
  "r&b": "Angolan Portuguese vocal, smooth soulful neo-soul delivery",
  pop: "Angolan Portuguese vocal, clean polished radio-friendly delivery",
  trap: "Angolan Portuguese vocal, modern urban hip hop delivery",
  rap: "Angolan Portuguese vocal, rhythmic hip hop delivery",
  reggae: "Angolan Portuguese vocal, relaxed Caribbean-influenced delivery",
  balada: "Angolan Portuguese vocal, emotional ballad delivery",
  gospel: "Angolan Portuguese vocal, powerful inspirational delivery",
  acoustic: "Angolan Portuguese vocal, intimate soft stripped-down delivery",
  "romantic pop": "Angolan Portuguese vocal, emotional romantic delivery",
  samba: "Angolan Portuguese vocal, festive rhythmic delivery",
  hino: "Angolan Portuguese vocal, majestic epic delivery"
};
var SUNO_ACCENT_ENABLED = process.env.SUNO_ACCENT_ENABLED !== "false";
var PORTUGUESE_TEXT_RE = /[àáâãéêíóôõúç]/i;
function buildSunoStylePrompt(lyricsText, musicStyle, extraParams) {
  const parts = [];
  if (extraParams?.voiceType) {
    const voiceStyle = VOICE_STYLE_MAP[extraParams.voiceType.trim().toLowerCase()];
    if (voiceStyle) parts.push(voiceStyle);
  }
  const baseStyle = STYLE_MAP[musicStyle.trim().toLowerCase()] || "romantic, emotional pop";
  parts.push(baseStyle);
  if (extraParams?.desiredEmotion) {
    const emotionStyle = EMOTION_STYLE_MAP[extraParams.desiredEmotion.trim().toLowerCase()];
    if (emotionStyle) parts.push(emotionStyle);
  }
  if (extraParams?.referenceArtist) {
    const artistStyle = ARTIST_STYLE_MAP[extraParams.referenceArtist.trim()];
    if (artistStyle) parts.push(artistStyle);
  }
  const isPortugueseLyrics = PORTUGUESE_TEXT_RE.test(lyricsText);
  const accentApplied = SUNO_ACCENT_ENABLED && isPortugueseLyrics;
  if (accentApplied) {
    const accentStyle = ACCENT_STYLE_MAP[musicStyle.trim().toLowerCase()];
    if (accentStyle) parts.push(accentStyle);
  }
  return { stylePrompt: parts.join(", "), accentApplied };
}
var ARTIST_STYLE_MAP = {
  "Anselmo Ralph": "anselmo ralph style, romantic kizomba, warm tenor vocal, soft brass, zouk",
  "Matias Dam\xE1sio": "matias damasio style, poetic ballad, emotional vocal, orchestral strings, angolan romantic",
  "Gerilson Insrael": "gerilson insrael style, afro pop, energetic rhythm, modern angolan, dance vibe",
  "Chelsea Dinorath": "chelsea dinorath style, neo kizomba, r&b influence, smooth female vocal, sensual",
  "Ary": "ary style, kizomba romantic, smooth vocal, modern angolan production, soulful melody",
  "Cef": "cef style, ghetto zouk, romantic dance, catchy rhythm, angolan urban",
  "Nelson Freitas": "nelson freitas style, zouk international, r&b fusion, smooth romantic, cabo love"
};
function getSunoCallbackUrl() {
  if (process.env.SUNO_CALLBACK_URL) return process.env.SUNO_CALLBACK_URL;
  const appUrl = process.env.APP_URL || DEFAULT_PUBLIC_APP_URL;
  const publicAppUrl = /^https:\/\//i.test(appUrl) ? appUrl : DEFAULT_PUBLIC_APP_URL;
  return `${publicAppUrl.replace(/\/+$/, "")}/api/suno-callback`;
}
function assertSuccessfulSunoPayload(payload, label) {
  if (typeof payload?.code === "number" && payload.code !== 200) {
    throw new Error(`${label} API error: ${payload.code} - ${payload.msg || "Erro desconhecido"}`);
  }
}
async function querySunoTask(taskId) {
  return sunoBreaker.exec(async () => {
    const apiKey = process.env.SUNO_API_KEY;
    if (!apiKey) throw new Error("SUNO_API_KEY nao configurada.");
    if (!taskId) throw new Error("Task Suno em falta.");
    const statusRes = await fetchWithTimeout(`https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!statusRes.ok) {
      const errText = await safeResponseText(statusRes);
      if (isQuotaError(statusRes.status, errText)) {
        throw new SunoQuotaError(`Suno query falhou (quota): ${statusRes.status} - Verifica o teu plano em sunoapi.org`);
      }
      throw new Error(`Suno query failed: ${statusRes.status} - ${errText}`);
    }
    const statusData = await statusRes.json();
    const status2 = extractStatus(statusData);
    let audioUrl = null;
    let audioUrlV2 = null;
    if (SUCCESS_STATUSES.has(status2)) {
      const both = extractBothAudioUrls(statusData);
      audioUrl = both.v1;
      audioUrlV2 = both.v2;
    }
    if (FAILED_STATUSES.has(status2)) {
      const safe = JSON.stringify(statusData).slice(0, 200);
      throw new Error(`Suno task failed: ${safe}`);
    }
    return { taskId, audioUrl, audioUrlV2, status: status2 };
  });
}
function normalizeLyricsArray(lyrics) {
  if (!lyrics) return [];
  if (Array.isArray(lyrics)) {
    return lyrics.map((item) => typeof item === "string" ? item : String(item || "")).filter(Boolean);
  }
  if (typeof lyrics === "string") {
    const trimmed = lyrics.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => typeof item === "string" ? item : String(item || "")).filter(Boolean);
        }
      } catch {
      }
    }
    return trimmed.split("\n").filter(Boolean);
  }
  return [];
}
async function startSunoMusic(lyrics, musicStyle, songTitle, personaId, extraParams) {
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) throw new Error("SUNO_API_KEY nao configurada.");
  const lyricsArray = normalizeLyricsArray(lyrics);
  const lyricsText = lyricsArray.join("\n").trim();
  if (!lyricsText) throw new Error("Letra em falta para gerar musica no Suno.");
  try {
    const creditRes = await fetch("https://api.sunoapi.org/api/v1/generate/credit", {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (creditRes.ok) {
      const creditData = await creditRes.json();
      const remaining = creditData?.data?.remaining ?? creditData?.remaining ?? -1;
      if (remaining === 0) {
        logWarn("[Suno] Cr\xE9ditos esgotados (0 restantes)");
      } else if (remaining > 0) {
        logInfo("[Suno] Cr\xE9ditos restantes", { remaining });
      }
    }
  } catch {
  }
  const stylePromptResult = buildSunoStylePrompt(lyricsText, musicStyle, extraParams);
  const stylePrompt = stylePromptResult.stylePrompt;
  const accentApplied = stylePromptResult.accentApplied;
  logInfo("[Suno] Submitting music generation task", {
    style: musicStyle,
    enhancedStyle: stylePrompt,
    titleLength: songTitle?.length || 0,
    lyricsLines: lyrics.length,
    hasPersonaId: !!personaId,
    personaIdDebug: personaId ? `${personaId.slice(0, 8)}...` : void 0,
    voiceType: extraParams?.voiceType,
    desiredEmotion: extraParams?.desiredEmotion,
    referenceArtist: extraParams?.referenceArtist,
    accentApplied
  });
  const payload = {
    prompt: lyricsText,
    style: stylePrompt,
    title: songTitle,
    customMode: true,
    instrumental: false,
    model: "V5_5",
    callBackUrl: getSunoCallbackUrl()
  };
  if (personaId) {
    payload.personaId = personaId;
    payload.personaModel = "voice_persona";
  }
  if (personaId) {
    logInfo("[Suno] Payload inclui personaId", { personaIdPreview: JSON.stringify(payload.personaId).slice(0, 60) });
  }
  const generateRes = await fetchWithTimeout("https://api.sunoapi.org/api/v1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!generateRes.ok) {
    const errText = await safeResponseText(generateRes);
    if (isQuotaError(generateRes.status, errText)) {
      throw new SunoQuotaError(`Suno gera\xE7\xE3o falhou (quota excedida): ${generateRes.status}. Renova os cr\xE9ditos em sunoapi.org.`);
    }
    throw new Error(`Suno generation failed: ${generateRes.status} - ${errText}`);
  }
  const generateData = await generateRes.json();
  assertSuccessfulSunoPayload(generateData, "Suno generation");
  const taskId = extractTaskId(generateData);
  if (!taskId) {
    throw new Error(`Suno did not return a task ID: ${JSON.stringify(generateData).slice(0, 200)}`);
  }
  if (personaId) {
    logInfo("[Suno] Response for personaId task", { taskId });
  }
  logInfo(`[Suno] Task created`, { taskId });
  return { taskId, audioUrl: null, audioUrlV2: null, status: extractStatus(generateData) };
}
async function pollSunoTask(taskId, _immediateAudioUrl, label = "Suno", maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1e4));
    try {
      const result = await querySunoTask(taskId);
      const status2 = result.status || "processing";
      logInfo(`[${label} Polling] Attempt`, { attempt: attempt + 1, status: status2, taskId });
      if (result.audioUrl) {
        return result;
      }
      if (SUCCESS_STATUSES.has(status2)) {
        throw new Error(`${label} task completed but no audio URL was found.`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("task failed")) {
        throw err;
      }
      logWarn(`[${label} Polling] Attempt failed`, { attempt: attempt + 1, error: err instanceof Error ? err.message : String(err), taskId });
      if (attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error(`${label} generation timed out after ${maxAttempts * 10 / 60} minutes.`);
}

// server/services/workflow/sunoOrchestration.ts
init_email();
init_whatsapp();
init_helpers();
init_logger();

// server/services/workflow/rollback.ts
init_helpers();
init_logger();
init_email();
async function rollbackStorageForSong(supabase, songId, requestId, voiceSampleUrl) {
  const { deleteStorageFiles: deleteStorageFiles2, listStorageFiles: listStorageFiles2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  try {
    const files = await listStorageFiles2("full-audio", "songs/");
    const matches = files.filter((f) => f.name.startsWith(`${songId}`)).map((f) => `songs/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles2("full-audio", matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) em full-audio`, { songId });
    }
  } catch {
  }
  try {
    await deleteStorageFiles2("preview", [`previews/${songId}_preview.mp3`]);
  } catch {
  }
  try {
    const voiceFiles = await listStorageFiles2("preview", "sunovoice/");
    const matches = voiceFiles.filter((f) => f.name.startsWith(requestId)).map((f) => `sunovoice/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles2("preview", matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) de voz em preview`, { requestId });
    }
  } catch {
  }
  if (voiceSampleUrl && !voiceSampleUrl.startsWith("http")) {
    try {
      await deleteStorageFiles2("voice-samples", [voiceSampleUrl]);
    } catch {
    }
  }
}
async function rollbackSunoWorkflow(supabase, requestId, songId, err) {
  let userEmail;
  let recipientName;
  try {
    const { data: failedRequest } = await supabase.from("song_requests").select("email, recipient_name, users(email)").eq("id", requestId).single();
    userEmail = failedRequest?.email || failedRequest?.users?.[0]?.email || null;
    recipientName = failedRequest?.recipient_name || void 0;
  } catch (infoErr) {
    logError("[Rollback] N\xE3o foi poss\xEDvel obter dados do cliente", infoErr, { requestId });
  }
  let revertedCount = 0;
  try {
    const { data: approvedPayments } = await supabase.from("payments").select("id").eq("request_id", requestId).eq("status", "approved");
    if (approvedPayments && approvedPayments.length > 0) {
      revertedCount = approvedPayments.length;
      await supabase.from("payments").update({
        status: "failed",
        approved_at: null,
        notes: "Revertido automaticamente \u2014 falha na gera\xE7\xE3o Suno"
      }).eq("request_id", requestId).eq("status", "approved");
      logWarn(`[Rollback] ${revertedCount} pagamento(s) revertido(s) para 'failed'`, { requestId });
    }
  } catch (rollbackErr) {
    logError("[Rollback] Payment rollback failed", rollbackErr, { requestId });
  }
  try {
    const { data: sr } = await supabase.from("song_requests").select("voice_sample_url").eq("id", requestId).maybeSingle();
    await rollbackStorageForSong(supabase, songId, requestId, sr?.voice_sample_url);
  } catch {
  }
  try {
    const adminUrl = `${getAppUrl()}/admin`;
    await sendAdminNotification(
      "Falha na gera\xE7\xE3o Suno \u2014 Pedido " + requestId.slice(0, 8),
      "Ocorreu um erro ao gerar a m\xFAsica no Suno.\n\nPedido: " + requestId + "\nM\xFAsica (songId): " + songId + "\nCliente: " + (recipientName || "\u2014") + (userEmail ? ` <${userEmail}>` : "") + "\nPagamentos revertidos: " + revertedCount + "\nErro: " + (err instanceof Error ? err.message : String(err ?? "")) + "\n\nAdmin: " + adminUrl
    );
  } catch (emailErr) {
    logError("[Rollback] Admin notification failed", emailErr, { requestId });
  }
  try {
    if (userEmail) {
      await sendWorkflowFailedEmail(userEmail, recipientName || "Cliente");
    }
  } catch (emailErr) {
    logError("[Rollback] Client notification failed", emailErr, { requestId });
  }
}

// server/services/workflow/voiceCloning.ts
init_supabase();
init_storage();
import path3 from "path";
import fs6 from "fs";
import os2 from "os";
init_storage();

// server/services/suno-voice.ts
init_logger();
var SUNO_TIMEOUT_MS2 = Number(process.env.SUNO_TIMEOUT_MS || 6e4);
async function fetchWithTimeout2(url, init = {}, timeoutMs = SUNO_TIMEOUT_MS2, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.status === 429 && attempt < retries) {
        const backoff = 1e3 * Math.pow(2, attempt - 1);
        logWarn(`[Suno Voice] 429 Too Frequent, retry ${attempt}/${retries} in ${backoff}ms`);
        clearTimeout(timeout);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      return res;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Suno Voice request timeout after ${timeoutMs}ms`);
      }
      if (attempt < retries) {
        logWarn(`[Suno Voice] Attempt ${attempt}/${retries} failed: ${err instanceof Error ? err.message : String(err)}, retrying...`);
        await new Promise((r) => setTimeout(r, 1e3 * attempt));
        continue;
      }
      logError("[Suno Voice] Fetch failed after all retries", err instanceof Error ? err : new Error(String(err)), { url, retries });
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Suno Voice request failed after ${retries} retries`);
}
function getApiKey() {
  const key = process.env.SUNO_API_KEY;
  if (!key) throw new Error("SUNO_API_KEY nao configurada.");
  return key;
}
function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getApiKey()}`
  };
}
function firstString2(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
async function generateValidationPhrase(voiceUrl, vocalStartS = 0, vocalEndS = 30, language = "pt") {
  const res = await fetchWithTimeout2("https://api.sunoapi.org/api/v1/voice/validate", {
    method: "POST",
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
    throw new Error(`Suno Voice validate error: ${data.msg || "Erro desconhecido"}`);
  }
  return {
    taskId: data.data?.taskId || "",
    status: "processing"
  };
}
async function getValidationPhraseResult(taskId) {
  const res = await fetchWithTimeout2(`https://api.sunoapi.org/api/v1/voice/validate-info?taskId=${taskId}`, {
    headers: apiHeaders()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice validate-info failed: ${res.status} - ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice validate-info error: ${data.msg || "Erro desconhecido"}`);
  }
  const validateInfo = firstString2(
    data.data?.validateInfo,
    data.data?.validate_info,
    data.data?.phrase
  );
  return {
    taskId,
    validateInfo: validateInfo || void 0,
    status: data.data?.status || "processing"
  };
}
async function waitForValidationPhrase(taskId, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2e3));
    const result = await getValidationPhraseResult(taskId);
    if (result.validateInfo) {
      return result;
    }
    if (result.status === "fail") {
      throw new Error(`Suno Voice validation failed after ${attempt + 1} attempts`);
    }
  }
  throw new Error(`Suno Voice validation phrase not ready after ${maxAttempts} attempts`);
}
async function getValidationPhrase(voiceUrl, language = "pt") {
  const validationResult = await generateValidationPhrase(voiceUrl, 0, 30, language);
  const phraseResult = await waitForValidationPhrase(validationResult.taskId);
  if (!phraseResult.validateInfo) {
    throw new Error("Suno Voice: frase de valida\xE7\xE3o n\xE3o recebida.");
  }
  return { taskId: validationResult.taskId, phrase: phraseResult.validateInfo };
}
async function createCustomVoice(validationTaskId, verifyUrl, voiceName = "SeuBeat Voice", description = "Custom voice for SeuBeat", style = "", singerSkillLevel = "beginner") {
  const res = await fetchWithTimeout2("https://api.sunoapi.org/api/v1/voice/generate", {
    method: "POST",
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
    throw new Error(`Suno Voice generate error: ${data.msg || "Erro desconhecido"}`);
  }
  return {
    taskId: data.data?.taskId || "",
    voiceId: null,
    status: "processing"
  };
}
async function getVoiceRecord(taskId) {
  const res = await fetchWithTimeout2(`https://api.sunoapi.org/api/v1/voice/record-info?taskId=${taskId}`, {
    headers: apiHeaders()
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Suno Voice record-info failed: ${res.status} - ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  if (data.code !== 200) {
    throw new Error(`Suno Voice record-info error: ${data.msg || "Erro desconhecido"}`);
  }
  const record = data.data;
  return {
    taskId,
    voiceId: record?.voiceId || null,
    status: record?.status || "unknown",
    errorCode: record?.errorCode,
    errorMessage: record?.errorMessage
  };
}
async function waitForVoiceId(taskId, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 5e3));
    const result = await getVoiceRecord(taskId);
    if (result.status === "success" && result.voiceId) {
      return result;
    }
    if (result.status === "fail") {
      throw new Error(`Suno Voice creation failed: ${result.errorMessage || "Erro desconhecido"}`);
    }
  }
  throw new Error(`Suno Voice creation timed out after ${maxAttempts} attempts`);
}
async function checkVoiceAvailability(taskId) {
  const res = await fetchWithTimeout2("https://api.sunoapi.org/api/v1/voice/check-voice", {
    method: "POST",
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

// server/services/workflow/voiceCloning.ts
init_email();
init_logger();
var VOICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
function parseSavedVoice(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && parsed.id && parsed.taskId && parsed.ts) {
      return parsed;
    }
  } catch {
  }
  return null;
}
function isVoiceExpired(ts) {
  return Date.now() - ts > VOICE_MAX_AGE_MS;
}
function isTransientCloneError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /Internal Error|Please try again later|not ready after \d+ attempts/i.test(msg);
}
function isExpiredPhraseError(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /Verification phrase expired|not found|request a new phrase/i.test(msg);
}
var CLONE_RETRY_DELAY_MS = 5e3;
async function delay(ms) {
  await new Promise((r) => setTimeout(r, ms));
}
async function resolveVoiceSampleUrl(_supabase, urlOrPath) {
  if (urlOrPath.startsWith("http")) return urlOrPath;
  const signedUrl = await createSignedStorageUrl("voice-samples", urlOrPath, 604800);
  if (!signedUrl) throw new Error("N\xE3o foi poss\xEDvel gerar URL para a amostra de voz.");
  return signedUrl;
}
async function createVoiceFromValidationTask(validationTaskId, publicVoiceUrl, requestId, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const voiceResult = await createCustomVoice(
        validationTaskId,
        publicVoiceUrl,
        `SeuBeat_${requestId}`,
        "Custom voice from SeuBeat",
        "",
        "professional"
      );
      logInfo(`[Suno Voice] Voice creation task`, { taskId: voiceResult.taskId, requestId, attempt });
      const recordResult = await waitForVoiceId(voiceResult.taskId);
      logInfo(`[Suno Voice] Voice created successfully`, { voiceId: recordResult.voiceId, requestId, attempt });
      return { voiceId: recordResult.voiceId, taskId: voiceResult.taskId };
    } catch (err) {
      lastErr = err;
      if (isExpiredPhraseError(err)) {
        throw err;
      }
      if (attempt < maxAttempts && isTransientCloneError(err)) {
        logWarn(`[Suno Voice] Transient clone error, retrying`, { attempt, maxAttempts, error: err instanceof Error ? err.message : String(err), requestId });
        await delay(CLONE_RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? "clone failed"));
}
async function processSunoVoice(requestId, songId, voiceSampleUrl) {
  const supabase = getAdminSupabase();
  if (!supabase) return null;
  try {
    const { data: voiceRequestData, error: voiceReqError } = await supabase.from("song_requests").select("language, elevenlabs_voice_id, created_at, voice_free_sample_url").eq("id", requestId).single();
    if (voiceReqError || !voiceRequestData) {
      throw new Error(`Failed to fetch song request: ${voiceReqError?.message}`);
    }
    logInfo(`[Suno Voice] Starting voice cloning`, { requestId });
    setProgress(requestId, { status: "voice_processing", progress: 10, message: "A iniciar clonagem de voz Suno Voice..." });
    const resolvedUrl = await resolveVoiceSampleUrl(supabase, voiceSampleUrl);
    const tempSamplePath = path3.join(os2.tmpdir(), `${requestId}_sample_raw`);
    await downloadFile(resolvedUrl, tempSamplePath);
    const tempWavPath = path3.join(os2.tmpdir(), `${requestId}_converted.wav`);
    await convertToWav(tempSamplePath, tempWavPath);
    try {
      fs6.unlinkSync(tempSamplePath);
    } catch {
    }
    const publicFilename = `sunovoice/${requestId}_${Date.now()}.wav`;
    const publicVoiceUrl = await uploadFileToStorage("preview", publicFilename, tempWavPath, "audio/wav");
    try {
      fs6.unlinkSync(tempWavPath);
    } catch {
    }
    if (!publicVoiceUrl) {
      throw new Error("Failed to upload voice sample to public URL");
    }
    logInfo(`[Suno Voice] Voice sample uploaded`, { requestId, publicVoiceUrl });
    setProgress(requestId, { status: "voice_processing", progress: 25, message: "A preparar valida\xE7\xE3o da voz..." });
    let validationTaskId = null;
    let storedVoiceValidationTaskId = null;
    try {
      const storedVoice = typeof voiceRequestData.elevenlabs_voice_id === "string" ? JSON.parse(voiceRequestData.elevenlabs_voice_id) : null;
      if (storedVoice && typeof storedVoice.validation_task_id === "string" && storedVoice.validation_task_id) {
        storedVoiceValidationTaskId = storedVoice.validation_task_id;
        validationTaskId = storedVoiceValidationTaskId;
      }
    } catch {
    }
    const langMap = {
      "ingl\xEAs": "en",
      "portugu\xEAs": "pt",
      "kikongo": "kg",
      "lingala": "ln",
      "kimbundu": "pt",
      "umbundu": "pt"
    };
    const voiceLang = langMap[voiceRequestData.language?.toLowerCase?.() || ""] || "pt";
    if (validationTaskId) {
      logInfo(`[Suno Voice] Reutilizando frase de valida\xE7\xE3o do wizard`, { taskId: validationTaskId, requestId });
      setProgress(requestId, { status: "voice_processing", progress: 40, message: "Frase de valida\xE7\xE3o registada. A criar voz personalizada..." });
    } else {
      setProgress(requestId, { status: "voice_processing", progress: 25, message: "A gerar frase de valida\xE7\xE3o..." });
      const validationResult = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
      logInfo(`[Suno Voice] Validation task created (fallback)`, { taskId: validationResult.taskId, requestId });
      setProgress(requestId, { status: "voice_processing", progress: 40, message: "A aguardar frase de valida\xE7\xE3o..." });
      const phraseResult = await waitForValidationPhrase(validationResult.taskId);
      logInfo(`[Suno Voice] Validation phrase received (fallback)`, { requestId });
      validationTaskId = validationResult.taskId;
    }
    setProgress(requestId, { status: "voice_processing", progress: 55, message: "A criar voz personalizada..." });
    let cloneResult;
    const usedWizardTask = !!storedVoiceValidationTaskId;
    try {
      cloneResult = await createVoiceFromValidationTask(validationTaskId, publicVoiceUrl, requestId);
    } catch (cloneErr) {
      if (usedWizardTask && isExpiredPhraseError(cloneErr)) {
        logWarn(`[Suno Voice] Wizard validation task expired, regenerating fresh phrase`, { error: cloneErr instanceof Error ? cloneErr.message : String(cloneErr), requestId });
        setProgress(requestId, { status: "voice_processing", progress: 30, message: "Frase expirada. A gerar nova frase de valida\xE7\xE3o..." });
        const freshValidation = await generateValidationPhrase(publicVoiceUrl, 0, 30, voiceLang);
        await waitForValidationPhrase(freshValidation.taskId);
        validationTaskId = freshValidation.taskId;
        setProgress(requestId, { status: "voice_processing", progress: 55, message: "Nova frase pronta. A criar voz personalizada..." });
        cloneResult = await createVoiceFromValidationTask(validationTaskId, publicVoiceUrl, requestId);
      } else {
        throw cloneErr;
      }
    }
    setProgress(requestId, { status: "voice_processing", progress: 70, message: "A verificar disponibilidade da voz..." });
    const checkResult = await checkVoiceAvailability(cloneResult.taskId);
    if (!checkResult.isAvailable) {
      logWarn(`[Suno Voice] Voice not yet available, continuing`, { voiceId: cloneResult.voiceId, requestId });
    }
    const voiceMeta = { id: cloneResult.voiceId || "unknown", taskId: cloneResult.taskId, ts: Date.now() };
    const { error: voiceUpdateErr } = await supabase.from("song_requests").update({ elevenlabs_voice_id: JSON.stringify(voiceMeta) }).eq("id", requestId);
    if (voiceUpdateErr) logWarn("[Suno Voice] Failed to save voice metadata", { error: voiceUpdateErr, requestId });
    setProgress(requestId, { status: "music_processing", progress: 80, message: "Voz clonada com sucesso! A gerar m\xFAsica..." });
    return cloneResult.voiceId;
  } catch (err) {
    logError("[Suno Voice] Error", err instanceof Error ? err : new Error(String(err)), { requestId });
    setProgress(requestId, { status: "music_processing", progress: 30, message: "Voz n\xE3o dispon\xEDvel, a gerar m\xFAsica sem voz personalizada." });
    const supabase2 = getAdminSupabase();
    if (supabase2) {
      await supabase2.from("song_requests").update({
        elevenlabs_voice_id: '{"failed":true}',
        error_details: {
          stage: "voice_cloning",
          message: err instanceof Error ? err.message : String(err ?? ""),
          at: (/* @__PURE__ */ new Date()).toISOString()
        }
      }).eq("id", requestId).maybeSingle();
    }
    const failMsg = err instanceof Error ? err.message : String(err ?? "unknown");
    sendAdminNotification(
      "Clonagem de voz Premium falhou",
      `Request: ${requestId}
Erro: ${failMsg}
A m\xFAsica ser\xE1 gerada sem voz personalizada.`
    ).catch(() => {
    });
    return null;
  }
}

// server/services/workflow/sunoOrchestration.ts
async function completeSunoWorkflowFromAudio(requestId, songId, taskId, audioUrl, audioUrlV2, opts) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error("Supabase client nao inicializado.");
  setProgress(requestId, { status: "generating", progress: 60, message: "Gera\xE7\xE3o conclu\xEDda no Suno. A descarregar ficheiro..." });
  setProgress(requestId, { status: "generating", progress: 75, message: "A guardar \xE1udio original no Supabase Storage..." });
  const persistTimeout = opts?.skipProcessing ? PERSIST_LIGHT_TIMEOUT_MS : PERSIST_AUDIO_TIMEOUT_MS;
  const { fullAudioUrl, publicPreviewUrl, duration } = await withTimeout(
    persistGeneratedSunoAudio(songId, taskId, audioUrl, opts),
    persistTimeout,
    `persistGeneratedSunoAudio(${songId})`
  );
  logInfo(`[Background Suno] Saved original to full-audio`, { songId, taskId, skipProcessing: !!opts?.skipProcessing });
  let fullAudioUrlV2 = null;
  if (audioUrlV2) {
    try {
      logInfo(`[Background Suno] Processing v2 audio`, { songId, taskId });
      const v2Result = await withTimeout(
        persistGeneratedSunoAudio(`${songId}_v2`, taskId, audioUrlV2, opts),
        persistTimeout,
        `persistGeneratedSunoAudio(${songId}_v2)`
      );
      fullAudioUrlV2 = v2Result.fullAudioUrl;
      logInfo(`[Background Suno] v2 audio saved`, { songId, fullAudioUrlV2 });
    } catch (v2Err) {
      logWarn(`[Background Suno] v2 audio processing failed, continuing with v1 only`, { songId, error: v2Err instanceof Error ? v2Err.message : String(v2Err) });
    }
  }
  const songUpdate = {
    audio_url: fullAudioUrl,
    full_song_url: fullAudioUrl,
    preview_url: null,
    duration,
    mureka_task_id: taskId,
    mureka_status: "completed"
  };
  if (fullAudioUrlV2) {
    songUpdate.audio_url_v2 = fullAudioUrlV2;
    songUpdate.full_song_url_v2 = fullAudioUrlV2;
  }
  const { error: songUpdateError } = await supabase.from("songs").update(songUpdate).eq("id", songId);
  if (songUpdateError) throw songUpdateError;
  const { data: approvedPayment } = await supabase.from("payments").select("id, plan, created_at").eq("request_id", requestId).eq("status", "approved").maybeSingle();
  const isStandard = approvedPayment && approvedPayment.plan === "standard";
  const paymentCreatedAt = approvedPayment?.created_at || (/* @__PURE__ */ new Date()).toISOString();
  const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1e3).toISOString() : null;
  const nextStatus = approvedPayment ? isStandard ? "approved" : "delivered" : "music_ready";
  await supabase.from("song_requests").update({
    status: nextStatus,
    deliver_at: deliverAt,
    final_mixed_audio_url: fullAudioUrl,
    ...nextStatus === "delivered" ? { delivered_at: (/* @__PURE__ */ new Date()).toISOString() } : {}
  }).eq("id", requestId);
  setProgress(requestId, { status: "completed", progress: 100, message: "Fluxo Suno conclu\xEDdo com sucesso!" });
}
async function resumeSunoTaskWorkflow(requestId, songId, taskId) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error("Supabase client nao inicializado.");
  try {
    logInfo(`[Background Suno] Resuming task for Request`, { requestId, songId, taskId });
    setProgress(requestId, { status: "processing", progress: 25, message: "A consultar task Suno existente..." });
    const { data: songData } = await supabase.from("songs").select("regeneration_count, duration").eq("id", songId).maybeSingle();
    const regenCount = songData?.regeneration_count ?? 0;
    const dbDuration = songData?.duration ?? null;
    const skipProcessing = regenCount > 0;
    if (skipProcessing) {
      logInfo(`[Background Suno] Recovery path: skipping fades/preview to avoid OOM`, { songId, regenCount, mem: `${(process.memoryUsage().rss / 1048576).toFixed(0)}MB` });
    }
    await updateRequestStatus(requestId, "music_processing");
    const { error: resumeSongError } = await supabase.from("songs").update({ mureka_status: "processing" }).eq("id", songId);
    if (resumeSongError) throw resumeSongError;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1e4));
      const { audioUrl, audioUrlV2 } = await querySunoTask(taskId);
      logInfo(`[Background Suno] Resume poll`, { attempt: attempt + 1, status, hasAudio: !!audioUrl, hasV2: !!audioUrlV2, requestId });
      if (audioUrl) {
        await completeSunoWorkflowFromAudio(requestId, songId, taskId, audioUrl, audioUrlV2, {
          skipProcessing,
          hintDuration: dbDuration
        });
        logInfo(`[Background Suno] Existing task completed`, { requestId, skipProcessing });
        try {
          const { data: sr } = await supabase.from("song_requests").select("status, email, phone, recipient_name, users!inner(email, name), songs!inner(id, letter_text, title)").eq("id", requestId).single();
          if (sr) {
            const song = sr.songs?.[0];
            const userEmail = sr.email || sr.users?.[0]?.email;
            const songReqStatus = sr.status;
            if (userEmail && (songReqStatus === "approved" || songReqStatus === "delivered")) {
              const slug = (sr.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
              const url = `${getAppUrl()}/song/${slug}?id=${song?.id || songId}`;
              if (songReqStatus === "approved") {
                sendConfirmationEmail(userEmail, sr.recipient_name, requestId, "standard_approved").catch((err) => logError("[Resume] Confirmation email failed", err, { requestId }));
                if (sr.phone) {
                  sendPaymentApprovedWhatsApp({
                    requestId,
                    phone: sr.phone,
                    recipientName: sr.recipient_name
                  }).catch((err) => logError("[Resume] Payment approved WhatsApp failed", err, { requestId }));
                }
              } else {
                sendPersonalizedEmail(userEmail, sr.recipient_name, url, song?.letter_text || "Dedicat\xF3ria.").catch((err) => logError("[Resume] Delivery email failed", err, { requestId }));
                if (sr.phone) {
                  sendDeliveryWhatsApp({
                    requestId,
                    phone: sr.phone,
                    recipientName: sr.recipient_name,
                    songUrl: url
                  }).catch((err) => logError("[Resume] Delivery WhatsApp failed", err, { requestId }));
                }
              }
            }
          }
        } catch (emailErr) {
          logError("[Resume] Failed to send notification email", emailErr, { requestId });
        }
        return;
      }
      setProgress(requestId, {
        status: "processing",
        progress: Math.min(85, 30 + attempt),
        message: `Suno ainda est\xE1 a processar (${status || "processing"}).`
      });
    }
    logWarn("[Background Suno] Resume: 60 polls sem audio \u2014 a limpar task_id para scheduler criar nova task", { requestId, songId, taskId });
    setProgress(requestId, {
      status: "processing",
      progress: 85,
      message: "A verificacao Suno esgotou. Uma nova musica sera gerada automaticamente."
    });
    const { data: pollSong } = await supabase.from("songs").select("mureka_task_id").eq("id", songId).maybeSingle();
    if (pollSong?.mureka_task_id === taskId) {
      await supabase.from("songs").update({ mureka_task_id: null }).eq("id", songId);
    }
    return;
  } catch (err) {
    logError("[Background Suno] Error while resuming task", err instanceof Error ? err : new Error(String(err)), { requestId, songId, taskId });
    setProgress(requestId, { status: "failed", progress: 100, message: "Erro na consulta Suno", error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, "failed", err instanceof Error ? err : new Error(String(err)));
    const resumeClearUpdate = { mureka_status: "failed" };
    const { data: resumeSong } = await supabase.from("songs").select("mureka_task_id").eq("id", songId).maybeSingle();
    if (resumeSong && resumeSong.mureka_task_id === taskId) {
      resumeClearUpdate.mureka_task_id = null;
    } else if (resumeSong?.mureka_task_id) {
      logInfo("[Resume] Preserving task_id from concurrent workflow", { songId, currentTaskId: resumeSong.mureka_task_id, ourTaskId: taskId });
    }
    await supabase.from("songs").update(resumeClearUpdate).eq("id", songId);
    await rollbackSunoWorkflow(supabase, requestId, songId, err);
  }
}
async function runBackgroundSunoWorkflow(requestId, songId, musicStyle, songTitle, lyrics, extraParams) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error("Supabase client nao inicializado.");
  let ourTaskId = null;
  try {
    logInfo(`[Background Suno] Starting workflow`, { requestId, songId });
    setProgress(requestId, { status: "generating", progress: 10, message: "A iniciar fluxo de gera\xE7\xE3o Suno..." });
    await updateRequestStatus(requestId, "music_processing");
    const { error: initialSongUpdateError } = await supabase.from("songs").update({ mureka_status: "generating" }).eq("id", songId);
    if (initialSongUpdateError) throw initialSongUpdateError;
    const { data: requestData, error: reqError } = await supabase.from("song_requests").select("*, songs(*), users(*)").eq("id", requestId).single();
    if (reqError || !requestData) {
      throw new Error(`Failed to fetch song request: ${reqError?.message}`);
    }
    const hasVoiceSample = !!requestData.voice_sample_url;
    let personaId;
    if (hasVoiceSample) {
      const savedVoice = parseSavedVoice(requestData.elevenlabs_voice_id);
      if (savedVoice && !isVoiceExpired(savedVoice.ts)) {
        logInfo(`[Background Suno] Reusing saved voiceId`, { voiceId: savedVoice.id, created: new Date(savedVoice.ts).toISOString() });
        personaId = savedVoice.id;
      }
    }
    if (hasVoiceSample && !personaId) {
      logInfo(`[Background Suno] Voice sample found, starting Suno Voice`, { requestId });
      setProgress(requestId, { status: "generating", progress: 20, message: "A processar clonagem de voz Suno Voice..." });
      await supabase.from("song_requests").update({ status: "voice_processing" }).eq("id", requestId);
      try {
        const voiceId = await processSunoVoice(requestId, songId, requestData.voice_sample_url);
        if (voiceId) {
          personaId = voiceId;
          logInfo(`[Background Suno] Suno Voice ID obtained`, { voiceId });
        }
      } catch (voiceErr) {
        logError(`[Background Suno] Suno Voice failed, generating without voice`, voiceErr instanceof Error ? voiceErr : new Error(String(voiceErr)), { requestId });
        await supabase.from("song_requests").update({
          error_details: {
            stage: "voice_cloning",
            message: voiceErr instanceof Error ? voiceErr.message : String(voiceErr ?? ""),
            at: (/* @__PURE__ */ new Date()).toISOString()
          }
        }).eq("id", requestId);
      }
      setProgress(requestId, { status: "music_processing", progress: 30, message: "Voz processada. A gerar m\xFAsica..." });
    }
    setProgress(requestId, { status: "generating", progress: 30, message: "A submeter letra ao Suno AI..." });
    const { taskId } = await startSunoMusic(lyrics, musicStyle, songTitle, personaId, extraParams);
    const { error: taskUpdateError } = await supabase.from("songs").update({
      mureka_task_id: taskId,
      mureka_status: "processing"
    }).eq("id", songId);
    if (taskUpdateError) throw taskUpdateError;
    ourTaskId = taskId;
    logInfo(`[Background Suno] Task ID saved to DB before polling`, { taskId, songId, requestId });
    const pollResult = await pollSunoTask(taskId, null, "Suno");
    const finalAudioUrl = pollResult.audioUrl;
    const finalAudioUrlV2 = pollResult.audioUrlV2;
    if (!finalAudioUrl) {
      logWarn(`[Background Suno] Task sem \xE1udio ap\xF3s polling \u2014 a marcar como failed`, { taskId, requestId });
      await supabase.from("songs").update({ mureka_status: "failed" }).eq("id", songId);
      setProgress(requestId, {
        status: "failed",
        progress: 100,
        message: "Suno n\xE3o devolveu \xE1udio. A recriar automaticamente..."
      });
      return;
    }
    logInfo(`[Background Suno] Generated successfully`, { taskId, requestId });
    setProgress(requestId, { status: "generating", progress: 60, message: "Gera\xE7\xE3o conclu\xEDda no Suno. A descarregar ficheiro..." });
    setProgress(requestId, { status: "generating", progress: 75, message: "A guardar \xE1udio original no Supabase Storage..." });
    const { fullAudioUrl, publicPreviewUrl, duration } = await persistGeneratedSunoAudio(songId, taskId, finalAudioUrl);
    logInfo(`[Background Suno] Audio saved to storage`, { songId, taskId });
    let fullAudioUrlV2 = null;
    if (finalAudioUrlV2) {
      try {
        logInfo(`[Background Suno] Processing v2 audio`, { songId, taskId });
        const v2Result = await persistGeneratedSunoAudio(`${songId}_v2`, taskId, finalAudioUrlV2);
        fullAudioUrlV2 = v2Result.fullAudioUrl;
        logInfo(`[Background Suno] v2 audio saved`, { songId, fullAudioUrlV2 });
      } catch (v2Err) {
        logWarn(`[Background Suno] v2 audio processing failed, continuing with v1 only`, { songId, error: v2Err instanceof Error ? v2Err.message : String(v2Err) });
      }
    }
    const songUpdate = {
      audio_url: fullAudioUrl,
      full_song_url: fullAudioUrl,
      preview_url: null,
      duration,
      mureka_task_id: taskId,
      mureka_status: "completed"
    };
    if (fullAudioUrlV2) {
      songUpdate.audio_url_v2 = fullAudioUrlV2;
      songUpdate.full_song_url_v2 = fullAudioUrlV2;
    }
    const { error: completedSongUpdateError } = await supabase.from("songs").update(songUpdate).eq("id", songId);
    if (completedSongUpdateError) throw completedSongUpdateError;
    const { data: approvedPayment } = await supabase.from("payments").select("id, plan, created_at").eq("request_id", requestId).eq("status", "approved").maybeSingle();
    const isStandard = approvedPayment && approvedPayment.plan === "standard";
    const nextStatus = approvedPayment ? isStandard ? "approved" : "delivered" : "music_ready";
    logInfo(`[Background Suno] Updating request after generation`, { requestId, nextStatus, paid: !!approvedPayment, isStandard });
    const userEmail = requestData.email || requestData.users?.email;
    const letterText = requestData.songs?.[0]?.letter_text || "Dedicat\xF3ria.";
    const paymentCreatedAt = approvedPayment?.created_at || (/* @__PURE__ */ new Date()).toISOString();
    const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1e3).toISOString() : null;
    await supabase.from("song_requests").update({
      final_mixed_audio_url: fullAudioUrl,
      status: nextStatus,
      deliver_at: deliverAt,
      ...nextStatus === "delivered" ? { delivered_at: (/* @__PURE__ */ new Date()).toISOString() } : {}
    }).eq("id", requestId);
    setProgress(requestId, { status: "completed", progress: 100, message: approvedPayment ? isStandard ? "M\xFAsica gerada. Ser\xE1 entregue em 24h." : "M\xFAsica gerada e entregue com sucesso!" : "M\xFAsica pronta. Aguardando confirma\xE7\xE3o do pagamento." });
    if (approvedPayment && userEmail) {
      const slug = (requestData.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      const personalizedUrl = `${getAppUrl()}/song/${slug}?id=${songId}`;
      if (isStandard) {
        logInfo(`[Background Suno] Sending confirmation email (Standard - 24h delay)`, { userEmail });
        sendConfirmationEmail(
          userEmail,
          requestData.recipient_name,
          requestId,
          "standard_approved"
        ).catch((emailErr) => {
          logError("[Background Suno] Confirmation email failed", emailErr, { requestId, userEmail });
        });
        if (requestData.phone) {
          sendPaymentApprovedWhatsApp({
            requestId,
            phone: requestData.phone,
            recipientName: requestData.recipient_name
          }).catch((waErr) => {
            logError("[Background Suno] Payment approved WhatsApp failed (Standard)", waErr, { requestId });
          });
        }
      } else {
        logInfo(`[Background Suno] Sending delivery email`, { userEmail });
        sendPersonalizedEmail(
          userEmail,
          requestData.recipient_name,
          personalizedUrl,
          letterText
        ).catch((emailErr) => {
          logError("[Background Suno] Delivery email failed (song already delivered)", emailErr, { requestId, userEmail });
        });
        if (requestData.phone) {
          sendDeliveryWhatsApp({
            requestId,
            phone: requestData.phone,
            recipientName: requestData.recipient_name,
            songUrl: personalizedUrl
          }).catch((waErr) => {
            logError("[Background Suno] Delivery WhatsApp failed", waErr, { requestId });
          });
        }
      }
    }
    logInfo(`[Background Suno] Workflow completed`, { requestId, nextStatus });
  } catch (err) {
    logError("[Background Suno] Error in background workflow", err instanceof Error ? err : new Error(String(err)), { requestId, songId });
    setProgress(requestId, { status: "failed", progress: 100, message: "Erro na gera\xE7\xE3o Suno", error: err instanceof Error ? err.message : String(err) });
    await updateRequestStatus(requestId, "failed", err instanceof Error ? err : new Error(String(err)));
    const clearUpdate = { mureka_status: "failed" };
    if (ourTaskId) {
      const { data: currentSong } = await supabase.from("songs").select("mureka_task_id").eq("id", songId).maybeSingle();
      if (currentSong && currentSong.mureka_task_id === ourTaskId) {
        clearUpdate.mureka_task_id = null;
      } else if (currentSong?.mureka_task_id) {
        logInfo("[Background Suno] Preserving task_id from concurrent workflow", { songId, currentTaskId: currentSong.mureka_task_id, ourTaskId });
      }
    } else {
      clearUpdate.mureka_task_id = null;
    }
    await supabase.from("songs").update(clearUpdate).eq("id", songId);
    await rollbackSunoWorkflow(supabase, requestId, songId, err);
  }
}

// server/routes/admin.ts
init_email();

// server/services/proofVerification.ts
init_logger();
var _GoogleGenAI = null;
async function loadGoogleGenAI() {
  if (!_GoogleGenAI) _GoogleGenAI = (await import("@google/genai")).GoogleGenAI;
  return _GoogleGenAI;
}
var PLAN_PRICES = {
  standard: 7900,
  express: 9900,
  premium: 14900
};
var EXPECTED_PHONE = process.env.MULTICAIXA_EXPRESS_PHONE || process.env.MULTICAIXA_REFERENCIA || "929423278";
var EXPECTED_ENTITY = process.env.MULTICAIXA_ENTIDADE || "10116";
var EXPECTED_REFERENCE = process.env.MULTICAIXA_REFERENCIA || "929423278";
var AUTO_APPROVE_THRESHOLD = Number(process.env.PROOF_AUTO_APPROVE_THRESHOLD || "0.85");
var AUTO_REJECT_THRESHOLD = Number(process.env.PROOF_AUTO_REJECT_THRESHOLD || "0.50");
var AI_TIMEOUT_MS = 1e4;
function withTimeout2(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
var VISION_PROMPT = `Analisa este comprovativo de pagamento Multicaixa (Angola). L\xEA TODOS os dados vis\xEDveis e verifica consist\xEAncia entre eles.

Extrai EXATAMENTE estes dados em JSON (sem texto fora do JSON):
{
  "amount": n\xFAmero ou null se n\xE3o vis\xEDvel,
  "recipientPhone": "929423278" ou null,
  "entity": "10116" ou null (entidade de pagamento),
  "reference": "929423278" ou null (refer\xEAncia de pagamento),
  "date": "YYYY-MM-DD HH:mm" ou null,
  "transactionId": "n\xBA da transa\xE7\xE3o" ou null \u2014 OBRIGAT\xD3RIO em comprovativos Multicaixa leg\xEDtimos.
  Em screenshots a app mostra frequentemente o ID PARCIALMENTE MASCARADO (ex: "639182******5895").
  Extrai-o EXATAMENTE como vis\xEDvel, incluindo os asteriscos. N\xE3o uses null se houver d\xEDgitos vis\xEDveis.,
  "isMulticaixa": true/false (se \xE9 comprovativo Multicaixa),
  "senderPhone": "phone do remetente" ou null (se vis\xEDvel),
  "txStatus": "Conclu\xEDdo"/"Pendente"/"Falhado" ou null (estado da transa\xE7\xE3o),
  "consistencyFlags": ["inconsist\xEAncias detetadas"] ou [],
  "rawText": "todo o texto vis\xEDvel no comprovativo, sem formata\xE7\xE3o"
}

Regras IMPORTANTES:
- O valor pode aparecer como "9.900 Kz", "9900", "9 900 Kz", etc \u2014 converte sempre para n\xFAmero inteiro
- Se houver m\xFAltiplos valores, escolhe o VALOR PRINCIPAL da transa\xE7\xE3o
- O phone pode aparecer como "+244 929 423 278" ou "929423278" \u2014 normaliza para s\xF3 d\xEDgitos
- A data pode estar em formato "DD/MM/YYYY HH:mm" ou "DD-MM-YYYY"
- transactionId: TODO comprovativo Multicaixa tem um n\xBA de transa\xE7\xE3o (ex: "TXN123456", "639182******5895", "Ref: 123456").
  Screenshots da app Multicaixa Express mostram o ID mascarado com asteriscos no meio \u2014 extrai-o tal e qual (ex: "639182******5895").
  S\xF3 usa null se N\xC3O houver nenhum n\xFAmero de transa\xE7\xE3o vis\xEDvel no comprovativo \u2014 e indica no consistencyFlags.
- Verifica consist\xEAncia: se o valor \xE9 muito diferente do esperado, ou se h\xE1 m\xFAltiplos valores contradit\xF3rios, ou se o phone/entidade n\xE3o parece v\xE1lido \u2014 adiciona a consistencyFlags
- Procura sinais de manipula\xE7\xE3o: fontes diferentes, layout quebrado, cores inconsistentes, texto sobreposto \u2014 adiciona a consistencyFlags
- Se n\xE3o consegues ler algo, coloca null \u2014 n\xE3o inventes
- isMulticaixa deve ser true se vires layout, cores ou logo da Multicaixa`;
async function analyzeWithGemini(buffer, mimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY n\xE3o configurada");
  const GoogleGenAI2 = await loadGoogleGenAI();
  const genAI = new GoogleGenAI2({ apiKey });
  const base64 = buffer.toString("base64");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await genAI.models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [
        { text: VISION_PROMPT },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64 } }
      ]
    }],
    config: {
      maxOutputTokens: 2048,
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  });
  const text = response.text;
  if (!text) throw new Error("Gemini retornou resposta vazia");
  const parsed = JSON.parse(text);
  return normalizeExtracted(parsed, "Gemini");
}
async function analyzeWithOpenAI(buffer, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY n\xE3o configurada");
  const OpenAI2 = (await import("openai")).default;
  const openai = new OpenAI2({ apiKey });
  const base64 = buffer.toString("base64");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Responde apenas em JSON v\xE1lido." },
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${base64}` } }
        ]
      }
    ]
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI retornou resposta vazia");
  const parsed = JSON.parse(content);
  return normalizeExtracted(parsed, "OpenAI");
}
function isTxIdAcceptable(txId) {
  if (!txId || txId.length < 3) return false;
  const digits = (txId.match(/\d/g) || []).length;
  if (/\*/.test(txId)) return digits >= 6;
  return digits >= 3 || /[A-Za-z]/.test(txId);
}
function normalizeExtracted(raw, provider) {
  return {
    amount: typeof raw.amount === "number" ? raw.amount : parseAmount(String(raw.amount || "")),
    recipientPhone: normalizePhone(String(raw.recipientPhone || "")),
    entity: normalizeDigits(String(raw.entity || "")),
    reference: normalizeDigits(String(raw.reference || "")),
    date: typeof raw.date === "string" ? raw.date : null,
    transactionId: typeof raw.transactionId === "string" ? raw.transactionId : null,
    isMulticaixa: Boolean(raw.isMulticaixa),
    rawText: String(raw.rawText || "").slice(0, 2e3),
    senderPhone: normalizePhone(String(raw.senderPhone || "")),
    txStatus: typeof raw.txStatus === "string" ? raw.txStatus : null,
    consistencyFlags: Array.isArray(raw.consistencyFlags) ? raw.consistencyFlags.filter((f) => typeof f === "string") : [],
    _provider: provider
  };
}
function parseAmount(s) {
  const cleaned = s.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}
function normalizePhone(s) {
  const digits = s.replace(/[^0-9]/g, "");
  if (digits.length === 9 && digits.startsWith("9")) return digits;
  if (digits.length === 12 && digits.startsWith("244")) return digits.slice(3);
  if (digits.length === 10 && digits.startsWith("2449")) return digits.slice(3);
  return digits.length >= 7 ? digits : null;
}
function normalizeDigits(s) {
  const digits = s.replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : null;
}
function parseProofDate(raw) {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const day = Number(dd);
    const month = Number(mm);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(
      Number(yyyy),
      month - 1,
      day,
      Number(hh || 0),
      Number(mi || 0),
      Number(ss || 0)
    );
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}
function runChecks(extracted, plan, paymentMethod) {
  const expectedAmount = PLAN_PRICES[plan] || 0;
  const checks = [];
  checks.push({
    name: "\xC9 comprovativo Multicaixa",
    passed: extracted.isMulticaixa,
    expected: "Sim",
    actual: extracted.isMulticaixa ? "Sim" : "N\xE3o",
    weight: 0.2
  });
  const amountOk = extracted.amount !== null && extracted.amount >= expectedAmount;
  checks.push({
    name: `Valor \u2265 ${expectedAmount.toLocaleString("pt")} Kz`,
    passed: amountOk,
    expected: `\u2265 ${expectedAmount.toLocaleString("pt")} Kz`,
    actual: extracted.amount !== null ? `${extracted.amount.toLocaleString("pt")} Kz` : "N\xE3o lido",
    weight: 0.2
  });
  if (paymentMethod === "express") {
    const phoneOk = extracted.recipientPhone !== null && (extracted.recipientPhone.includes(EXPECTED_PHONE) || EXPECTED_PHONE.includes(extracted.recipientPhone));
    checks.push({
      name: `Destinat\xE1rio (phone ${EXPECTED_PHONE})`,
      passed: phoneOk,
      expected: EXPECTED_PHONE,
      actual: extracted.recipientPhone || "N\xE3o lido",
      weight: 0.2
    });
  } else {
    const entityOk = extracted.entity !== null && extracted.entity.includes(EXPECTED_ENTITY);
    const refOk = extracted.reference !== null && extracted.reference.includes(EXPECTED_REFERENCE);
    checks.push({
      name: `Entidade (${EXPECTED_ENTITY}) + Refer\xEAncia (${EXPECTED_REFERENCE})`,
      passed: entityOk && refOk,
      expected: `${EXPECTED_ENTITY} / ${EXPECTED_REFERENCE}`,
      actual: `${extracted.entity || "?"} / ${extracted.reference || "?"}`,
      weight: 0.2
    });
  }
  checks.push({
    name: "Texto vis\xEDvel no comprovativo",
    passed: extracted.rawText.length > 20,
    expected: "Texto leg\xEDvel",
    actual: `${extracted.rawText.length} caracteres`,
    weight: 0.05
  });
  const amountReasonable = extracted.amount === null || extracted.amount <= expectedAmount * 3;
  checks.push({
    name: "Valor razo\xE1vel (< 3x o esperado)",
    passed: amountReasonable,
    expected: `< ${(expectedAmount * 3).toLocaleString("pt")} Kz`,
    actual: extracted.amount !== null ? `${extracted.amount.toLocaleString("pt")} Kz` : "N\xE3o lido",
    weight: 0.05
  });
  const txId = extracted.transactionId;
  const txIdOk = isTxIdAcceptable(txId);
  checks.push({
    name: "Transaction ID leg\xEDvel",
    passed: txIdOk,
    expected: "N\xBA de transa\xE7\xE3o presente",
    actual: txId || "N\xE3o lido",
    weight: 0.15
  });
  let dateOk = false;
  let dateActual = "N\xE3o lido";
  if (extracted.date) {
    const proofDate = parseProofDate(extracted.date);
    if (proofDate) {
      const now = Date.now();
      const diffMs = now - proofDate.getTime();
      const diffH = diffMs / (1e3 * 60 * 60);
      if (diffMs < 0) {
        dateActual = `${extracted.date} (futuro)`;
        dateOk = false;
      } else if (diffH > 48) {
        dateActual = `${extracted.date} (>48h antigo)`;
        dateOk = false;
      } else {
        dateActual = `${extracted.date} (${Math.round(diffH)}h atr\xE1s)`;
        dateOk = true;
      }
    } else {
      dateActual = `${extracted.date} (data inv\xE1lida)`;
      dateOk = false;
    }
  }
  checks.push({
    name: "Data recente (< 48h)",
    passed: dateOk,
    expected: "Data das \xFAltimas 48h",
    actual: dateActual,
    weight: 0.1
  });
  let amountConsistent = true;
  if (extracted.amount !== null && expectedAmount > 0) {
    const ratio = extracted.amount / expectedAmount;
    amountConsistent = ratio >= 0.95 && ratio <= 5;
  }
  checks.push({
    name: "Valor consistente com o plano",
    passed: amountConsistent,
    expected: "0.95x\u20135x o pre\xE7o do plano",
    actual: extracted.amount !== null ? `${(extracted.amount / expectedAmount).toFixed(1)}x (${extracted.amount.toLocaleString("pt")} Kz)` : "N\xE3o lido",
    weight: 0.05
  });
  return checks;
}
function computeConfidence(checks) {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  return totalWeight > 0 ? Math.round(passedWeight / totalWeight * 100) / 100 : 0;
}
async function verifyPaymentProof(buffer, mimeType, plan, paymentMethod) {
  const startTime = Date.now();
  let extracted = null;
  let provider = "none";
  try {
    extracted = await withTimeout2(analyzeWithGemini(buffer, mimeType), AI_TIMEOUT_MS, "Gemini");
    provider = "Gemini";
  } catch (geminiErr) {
    logWarn("[ProofVerification] Gemini vision falhou, a tentar OpenAI", { error: geminiErr instanceof Error ? geminiErr.message : String(geminiErr) });
    try {
      extracted = await withTimeout2(analyzeWithOpenAI(buffer, mimeType), AI_TIMEOUT_MS, "OpenAI");
      provider = "OpenAI";
    } catch (openaiErr) {
      logError("[ProofVerification] Ambos os providers de vision falharam", openaiErr);
      return {
        verified: false,
        confidence: 0,
        decision: "manual_review",
        extracted: { amount: null, recipientPhone: null, entity: null, reference: null, date: null, transactionId: null, isMulticaixa: false, rawText: "", senderPhone: null, txStatus: null, consistencyFlags: [] },
        checks: [],
        provider: "none",
        error: `AI vision indispon\xEDvel: ${geminiErr instanceof Error ? geminiErr.message : "unknown"}`
      };
    }
  }
  const checks = runChecks(extracted, plan, paymentMethod);
  const confidence = computeConfidence(checks);
  let decision;
  if (confidence >= AUTO_APPROVE_THRESHOLD) {
    decision = "auto_approve";
  } else if (confidence >= AUTO_REJECT_THRESHOLD) {
    decision = "manual_review";
  } else {
    decision = "auto_reject";
  }
  if (decision === "auto_approve" && !isTxIdAcceptable(extracted.transactionId)) {
    decision = "manual_review";
    logWarn("[ProofVerification] auto_approve bloqueado \u2014 transaction_id n\xE3o lido");
  }
  const elapsed = Date.now() - startTime;
  logInfo("[ProofVerification] Verifica\xE7\xE3o conclu\xEDda", {
    provider,
    confidence,
    decision,
    elapsed: `${elapsed}ms`,
    checksPassed: checks.filter((c) => c.passed).length,
    checksTotal: checks.length,
    amount: extracted.amount,
    isMulticaixa: extracted.isMulticaixa
  });
  return {
    verified: decision === "auto_approve",
    confidence,
    decision,
    extracted,
    checks,
    provider
  };
}

// server/routes/admin.ts
init_logger();
init_helpers();

// server/utils/audit.ts
init_supabase();
async function logAdminAction(params) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return;
    await supabase.from("admin_audit_log").insert([{
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      previous_data: params.previousData || null,
      new_data: params.newData || null,
      notes: params.notes || null
    }]);
  } catch (err) {
  }
}

// server/routes/admin.ts
init_metaPixelCapi();

// server/middleware/rateLimiter.ts
init_logger();
import rateLimit from "express-rate-limit";
function isDevelopment() {
  return process.env.NODE_ENV === "development";
}
var globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutos
  max: 1e3,
  message: {
    success: false,
    error: "Demasiados pedidos. Tente novamente mais tarde."
  },
  standardHeaders: true,
  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,
  // Disable `X-RateLimit-*` headers
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: "Demasiados pedidos. Tente novamente em alguns minutos."
    });
  }
});
var generateLyricsLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hora
  max: 10,
  validate: false,
  keyGenerator: (req) => {
    const email = (req.body?.email || "").toLowerCase();
    return email && email.includes("@") ? email : req.ip;
  },
  message: {
    success: false,
    error: "Limite de gera\xE7\xE3o atingido. M\xE1ximo 10 gera\xE7\xF5es por hora."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Generate lyrics rate limit exceeded", {
      ip: req.ip,
      email: req.body?.email || "unknown"
    });
    let waitMsg = "Tenta novamente dentro de 1 hora.";
    const resetHeader = res.getHeader("RateLimit-Reset");
    const resetSeconds = typeof resetHeader === "string" ? Number(resetHeader) : NaN;
    if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
      const ms = resetSeconds * 1e3 - Date.now();
      if (ms > 0) {
        const minutes = Math.ceil(ms / 6e4);
        waitMsg = minutes <= 1 ? "Tenta novamente em menos de 1 minuto." : `Tenta novamente em ${minutes} min.`;
      }
    }
    res.status(429).json({
      success: false,
      error: `Limite de gera\xE7\xE3o de m\xFAsicas atingido (m\xE1ximo 10 por hora). ${waitMsg}`
    });
  }
});
var emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hora
  max: 20,
  message: {
    success: false,
    error: "Demasiadas tentativas de envio de email."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Email rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Limite de envios de email atingido. Tente novamente mais tarde."
    });
  }
});
var adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hora
  max: 200,
  message: {
    success: false,
    error: "Limite de requisi\xE7\xF5es admin atingido."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Admin rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: "Limite de requisi\xE7\xF5es atingido. Tente novamente mais tarde."
    });
  }
});
var getSongLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutos
  max: 500,
  message: {
    success: false,
    error: "Demasiadas requisi\xE7\xF5es."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Get song rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Demasiadas requisi\xE7\xF5es. Tente novamente mais tarde."
    });
  }
});
var paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 20,
  message: {
    success: false,
    error: "Demasiadas requisi\xE7\xF5es de pagamento."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Payment rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: "Demasiadas tentativas de pagamento. Tente novamente mais tarde."
    });
  }
});
var resumeDataLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 30,
  message: {
    success: false,
    error: "Demasiadas requisi\xE7\xF5es."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Resume data rate limit exceeded", { ip: req.ip, path: req.path });
    res.status(429).json({
      success: false,
      error: "Demasiadas requisi\xE7\xF5es. Tente novamente mais tarde."
    });
  }
});
var paymentStatusLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 120,
  message: {
    success: false,
    error: "Demasiadas requisi\xE7\xF5es."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Payment status rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Demasiadas requisi\xE7\xF5es. Tente novamente mais tarde."
    });
  }
});
var recoverByEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 20,
  message: {
    success: false,
    error: "Demasiadas tentativas de recupera\xE7\xE3o."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Recover by email rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Demasiadas tentativas. Tente novamente mais tarde."
    });
  }
});
var whatsappBulkLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 10,
  message: {
    success: false,
    error: "Limite de campanhas WhatsApp atingido."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("WhatsApp bulk rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Limite de campanhas WhatsApp atingido. Tente novamente mais tarde."
    });
  }
});
var voiceValidationLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  max: 10,
  message: {
    success: false,
    error: "Demasiadas tentativas de valida\xE7\xE3o de voz."
  },
  skip: () => isDevelopment(),
  handler: (req, res) => {
    logWarn("Voice validation rate limit exceeded", { ip: req.ip });
    res.status(429).json({
      success: false,
      error: "Demasiadas tentativas de valida\xE7\xE3o de voz. Tente novamente mais tarde."
    });
  }
});

// server/routes/admin.ts
init_abandonedMessages();
init_whatsapp();
init_whatsappTemplates();

// server/services/metaAds.ts
init_env();
var GRAPH_API_VERSION2 = getEnv("META_GRAPH_API_VERSION", "v25.0");
var ACCESS_TOKEN2 = getEnv("META_ACCESS_TOKEN", "");
var CONFIGURED_AD_ACCOUNT_ID = getEnv("META_AD_ACCOUNT_ID", "");
var USD_RATE = Number(getEnv("META_AD_SPEND_USD_RATE", "1")) || 1;
function normalizeAdAccountId(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}
async function fetchJson(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN2}` } });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}
async function discoverAdAccount() {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/me/adaccounts`);
  url.searchParams.set("fields", "id,name,currency");
  url.searchParams.set("limit", "1");
  const result = await fetchJson(url.toString());
  if (!result.ok) {
    throw new Error(result.data?.error?.message || `Meta adaccounts HTTP ${result.status}`);
  }
  return result.data?.data?.[0] || null;
}
async function fetchAdAccount(accountId) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/${accountId}`);
  url.searchParams.set("fields", "id,name,currency");
  const result = await fetchJson(url.toString());
  if (!result.ok) {
    throw new Error(result.data?.error?.message || `Meta ad account HTTP ${result.status}`);
  }
  return {
    id: result.data?.id || accountId,
    name: result.data?.name,
    currency: result.data?.currency
  };
}
async function getMetaAdsSpend(params) {
  const lastCheck = (/* @__PURE__ */ new Date()).toISOString();
  if (!ACCESS_TOKEN2) {
    return {
      ok: false,
      configured: false,
      spend: 0,
      spendUSD: 0,
      currency: "USD",
      since: params.since,
      until: params.until,
      lastCheck,
      error: "META_ACCESS_TOKEN em falta"
    };
  }
  try {
    const configuredAccountId = normalizeAdAccountId(CONFIGURED_AD_ACCOUNT_ID);
    const account = configuredAccountId ? await fetchAdAccount(configuredAccountId) : await discoverAdAccount();
    if (!account?.id) {
      return {
        ok: false,
        configured: false,
        spend: 0,
        spendUSD: 0,
        currency: "USD",
        since: params.since,
        until: params.until,
        lastCheck,
        error: "Nenhuma conta de an\xFAncios Meta encontrada para este token"
      };
    }
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION2}/${account.id}/insights`);
    url.searchParams.set("fields", "spend");
    url.searchParams.set("level", "account");
    url.searchParams.set("time_range", JSON.stringify({ since: params.since, until: params.until }));
    const result = await fetchJson(url.toString());
    if (!result.ok) {
      throw new Error(result.data?.error?.message || `Meta insights HTTP ${result.status}`);
    }
    const spend = Number(result.data?.data?.[0]?.spend || 0);
    const currency = account.currency || getEnv("META_AD_SPEND_CURRENCY", "USD") || "USD";
    const rate = currency.toUpperCase() === "USD" ? 1 : USD_RATE;
    return {
      ok: true,
      configured: true,
      spend,
      spendUSD: +(spend * rate).toFixed(2),
      currency,
      accountId: account.id,
      accountName: account.name,
      since: params.since,
      until: params.until,
      lastCheck
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      spend: 0,
      spendUSD: 0,
      currency: "USD",
      since: params.since,
      until: params.until,
      lastCheck,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

// server/routes/admin.ts
init_deepseekConfig();

// server/services/analytics.ts
init_supabase();
init_logger();
async function logAnalyticsEvent(eventName, options = {}) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return;
    await supabase.from("analytics_events").insert({
      event_name: eventName,
      request_id: options.requestId || null,
      session_id: options.sessionId || null,
      metadata: options.metadata || null
    });
  } catch (err) {
    logWarn("[Analytics] Falha ao registar evento", {
      event: eventName,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

// server/routes/admin.ts
var AnthropicSDK = null;
var OpenAISDK = null;
var GoogleGenAISDK = null;
async function loadAnthropic() {
  if (!AnthropicSDK) AnthropicSDK = (await import("@anthropic-ai/sdk")).default;
  return AnthropicSDK;
}
async function loadOpenAI() {
  if (!OpenAISDK) OpenAISDK = (await import("openai")).default;
  return OpenAISDK;
}
async function loadGoogleGenAI2() {
  if (!GoogleGenAISDK) GoogleGenAISDK = (await import("@google/genai")).GoogleGenAI;
  return GoogleGenAISDK;
}
var router = express.Router();
router.post("/login", adminLimiter, (req, res) => adminLogin(req, res));
function safeMessage(err) {
  return publicErrorMessage(err);
}
function firstRelated(value) {
  return Array.isArray(value) ? value[0] : value || void 0;
}
function mapRelated(value, mapper) {
  if (Array.isArray(value)) return value.map(mapper);
  if (value) return mapper(value);
  return value;
}
function parseMoneyAmount(value) {
  return parseInt(String(value ?? "0").replace(/\D/g, ""), 10) || 0;
}
function isoDateOnly(date) {
  return date.toISOString().slice(0, 10);
}
async function checkDeepSeek(now) {
  const apiKey = getDeepSeekApiKey();
  const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
  if (!apiKey) return { ok: false, error: "DEEPSEEK_API_KEY em falta no ambiente do servidor (ou alias DEEPSEEK_SECRET_KEY)", model, lastCheck: now.toISOString() };
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, model, lastCheck: now.toISOString() };
    const balances = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
    const usd = balances.find((b) => String(b.currency || "").toUpperCase() === "USD") || balances[0];
    const totalBalance = Number(usd?.total_balance ?? usd?.granted_balance ?? 0);
    const toppedUpBalance = Number(usd?.topped_up_balance ?? 0);
    return {
      ok: true,
      model,
      currency: usd?.currency || "USD",
      total_balance: totalBalance,
      topped_up_balance: toppedUpBalance,
      low: totalBalance < 1,
      estimatedLyricsRemaining: Math.floor(totalBalance / (Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 5e-4)),
      lastCheck: now.toISOString()
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), model, lastCheck: now.toISOString() };
  }
}
function extractStoragePath(url, bucket) {
  if (!url) return null;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
    }
  }
  const r2Match = url.match(/r2\.dev\/([^?]+)/);
  if (r2Match) {
    const fullPath = decodeURIComponent(r2Match[1]);
    const bucketPrefix = `${bucket}/`;
    return fullPath.startsWith(bucketPrefix) ? fullPath.slice(bucketPrefix.length) : fullPath;
  }
  if (!url.startsWith("http") && !url.startsWith("//") && url.includes("/")) {
    return url.split("?")[0];
  }
  return null;
}
function safeAudioFilename(title) {
  const base = String(title || "seubeat-musica").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return `${base || "seubeat-musica"}.mp3`;
}
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const [usersRes, requestsRes, paymentsRes, songsRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact" }),
      supabase.from("song_requests").select("id, status", { count: "exact" }),
      supabase.from("payments").select("id, status, amount, plan, created_at"),
      supabase.from("songs").select("id, audio_url, mureka_status, created_at")
    ]);
    const payments = paymentsRes.data || [];
    const pendingPayments = payments.filter((p) => p.status === "pending_verification").length;
    const approvedPayments = payments.filter((p) => p.status === "approved").length;
    const totalRevenue = payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + parseMoneyAmount(p.amount), 0);
    const songs = songsRes.data || [];
    const musicGenerated = songs.filter((s) => s.audio_url).length;
    const requests = requestsRes.data || [];
    const requestsByStatus = {};
    requests.forEach((r) => {
      requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1;
    });
    res.json({
      totalUsers: usersRes.count || 0,
      totalRequests: requestsRes.count || 0,
      pendingPayments,
      approvedPayments,
      totalRevenue: `${totalRevenue.toLocaleString("pt")} Kz`,
      musicGenerated,
      requestsByStatus
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/funnel", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const now = /* @__PURE__ */ new Date();
    const today = isoDateOnly(now);
    const weekAgo = isoDateOnly(new Date(now.getTime() - 7 * 864e5));
    const monthAgo = isoDateOnly(new Date(now.getTime() - 30 * 864e5));
    const [requestsRes, paymentsRes, deliveredRes, revenueByDayRes] = await Promise.all([
      supabase.from("song_requests").select("id, status, created_at"),
      supabase.from("payments").select("id, status, amount, plan, created_at"),
      supabase.from("song_requests").select("id", { count: "exact" }).eq("status", "delivered"),
      supabase.from("payments").select("amount, created_at").eq("status", "approved").gte("created_at", monthAgo).order("created_at", { ascending: true })
    ]);
    const requests = requestsRes.data || [];
    const payments = paymentsRes.data || [];
    const approvedPayments = payments.filter((p) => p.status === "approved");
    const lyricsGenerated = requests.filter((r) => !["lyrics_generating"].includes(r.status)).length;
    const paymentSubmitted = payments.length;
    const paymentApproved = approvedPayments.length;
    const conversionRate = lyricsGenerated > 0 ? (paymentApproved / lyricsGenerated * 100).toFixed(1) : "0";
    const totalRevenue = approvedPayments.reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueToday = approvedPayments.filter((p) => p.created_at?.startsWith(today)).reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueWeek = approvedPayments.filter((p) => (p.created_at || "") >= weekAgo).reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const revenueMonth = approvedPayments.filter((p) => (p.created_at || "") >= monthAgo).reduce((s, p) => s + parseMoneyAmount(p.amount), 0);
    const aov = paymentApproved > 0 ? Math.round(totalRevenue / paymentApproved) : 0;
    const revenueByDay = {};
    for (const p of revenueByDayRes.data || []) {
      const day = (p.created_at || "").slice(0, 10);
      if (day) revenueByDay[day] = (revenueByDay[day] || 0) + parseMoneyAmount(p.amount);
    }
    const revenueChart = Object.entries(revenueByDay).sort((a, b) => a[0].localeCompare(b[0])).map(([day, amount]) => ({ day, amount }));
    res.json({
      funnel: {
        lyricsGenerated,
        paymentSubmitted,
        paymentApproved,
        delivered: deliveredRes.count || 0,
        conversionRate: `${conversionRate}%`
      },
      revenue: {
        total: totalRevenue,
        today: revenueToday,
        week: revenueWeek,
        month: revenueMonth,
        aov,
        chart: revenueChart
      }
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/payments", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data, error } = await supabase.from("payments").select("*, song_requests(id, recipient_name, occasion, music_style, status, users(name, email, phone))").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, payments: data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/payment/:id/proof-url", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: payment, error } = await supabase.from("payments").select("proof_path, proof_url, proof_filename").eq("id", id).single();
    if (error || !payment) return res.status(404).json({ success: false, error: "Pagamento n\xE3o encontrado." });
    let path6 = payment.proof_path;
    if (!path6 && payment.proof_url) {
      path6 = payment.proof_url.replace(/^storage:/, "");
    }
    if (path6) {
      const signedUrl2 = await createSignedStorageUrl("payment-proofs", path6, 3600);
      if (signedUrl2) {
        res.json({
          url: signedUrl2,
          filename: payment.proof_filename || null,
          mimeType: payment.proof_filename?.endsWith(".pdf") ? "application/pdf" : null
        });
        return;
      }
    }
    if (payment.proof_url && /^https?:\/\//.test(payment.proof_url)) {
      res.json({
        url: payment.proof_url,
        filename: payment.proof_filename || null,
        mimeType: payment.proof_filename?.endsWith(".pdf") ? "application/pdf" : null
      });
      return;
    }
    if (!path6) return res.status(404).json({ success: false, error: "Comprovativo n\xE3o encontrado." });
    const signedUrl = await createSignedStorageUrl("payment-proofs", path6, 3600);
    const finalUrl = signedUrl || payment.proof_url || null;
    if (!finalUrl) return res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel gerar URL do comprovativo." });
    res.json({
      url: finalUrl,
      filename: payment.proof_filename || null,
      mimeType: payment.proof_filename?.endsWith(".pdf") ? "application/pdf" : null
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/payment/:id/approve", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: payment, error: paymentError } = await supabase.from("payments").update({
      status: "approved",
      notes: notes || null,
      approved_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("status", "pending_verification").select("*, song_requests(*, songs(*), users(*))").single();
    if (paymentError || !payment) {
      return res.status(409).json({ success: false, error: "Pagamento n\xE3o encontrado ou j\xE1 processado." });
    }
    const songRequest = payment.song_requests;
    const requestId = payment.request_id;
    const songData = firstRelated(songRequest?.songs);
    const userEmail = payment.user_email || songRequest?.users?.email;
    const letterText = songData?.letter_text || "Prepar\xE1mos uma dedicat\xF3ria especial para si.";
    if (!requestId || !songData) {
      return res.status(400).json({ success: false, error: "Dados da m\xFAsica em falta." });
    }
    const numericAmount = parseInt(String(payment.amount || "0").replace(/[^0-9]/g, ""), 10) || 0;
    const planName = payment.plan || songRequest?.plan || "standard";
    logAdminAction({ action: "approve", entityType: "payment", entityId: id, notes: notes || void 0 });
    logAnalyticsEvent("payment_approved", { requestId: requestId || void 0, metadata: { plan: planName, amount: numericAmount } }).catch(() => {
    });
    const userPhone = songRequest?.phone || null;
    const userFullName = songRequest?.users?.name || "";
    const lastName = userFullName.split(" ").filter(Boolean).slice(-1)[0] || void 0;
    const firePurchaseEvent = () => {
      if (payment.meta_purchase_sent_at) {
        logInfo("[Admin] Meta CAPI Purchase j\xE1 enviado para este pagamento, a ignorar", { paymentId: id });
        return;
      }
      const purchaseEventKey = planName === "video_upsell" ? id : requestId;
      sendPurchaseEvent({
        eventId: generateServerEventId(purchaseEventKey, "Purchase"),
        email: payment.user_email || userEmail || "",
        phone: userPhone || void 0,
        value: numericAmount,
        currency: "AOA",
        contentName: planName,
        orderId: id,
        eventSourceUrl: req.headers.referer || void 0,
        clientIp: req.ip || req.socket.remoteAddress || void 0,
        clientUserAgent: req.headers["user-agent"],
        externalId: payment.user_email || userEmail || void 0,
        ln: lastName
      }).then((ok) => {
        if (ok) {
          return supabase.from("payments").update({ meta_purchase_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).eq("status", "approved");
        }
        return void 0;
      }).catch(
        (err) => logError("[Admin] Meta CAPI Purchase event failed after retries", err, { paymentId: id })
      );
    };
    const hasGeneratedAudio = !!(songData.full_song_url || songData.audio_url);
    const hasVoiceSample = !!songRequest.voice_sample_url;
    const isStandard = planName === "standard";
    if (hasGeneratedAudio) {
      const fullAudioUrl = songData.full_song_url || songData.audio_url;
      if (isStandard) {
        const approvedAt = payment.approved_at || payment.created_at || (/* @__PURE__ */ new Date()).toISOString();
        const deliverAt = new Date(new Date(approvedAt).getTime() + 24 * 60 * 60 * 1e3).toISOString();
        await supabase.from("song_requests").update({
          status: "approved",
          deliver_at: deliverAt,
          final_mixed_audio_url: fullAudioUrl || songRequest.final_mixed_audio_url || null
        }).eq("id", requestId);
        if (userEmail) {
          logInfo("[Admin] Enviando email de confirmacao (standard)", { requestId, userEmail });
          sendConfirmationEmail(userEmail, songRequest.recipient_name, requestId, "standard_approved").catch(
            (err) => logError("[Admin] Falha ao enviar email de confirmacao (standard)", err, { requestId, userEmail })
          );
        }
        const standardPhone = songRequest.phone || songRequest.users?.phone || null;
        if (standardPhone) {
          sendPaymentApprovedWhatsApp({
            requestId,
            phone: standardPhone,
            recipientName: songRequest.recipient_name
          }).catch((err) => logError("[Admin] Falha ao enviar WhatsApp de aprovacao (standard)", err, { requestId }));
        }
        firePurchaseEvent();
        sendVideoUpsellOffer(requestId, songRequest, req);
        return res.json({ success: true, message: "Pagamento aprovado. M\xFAsica ser\xE1 entregue em 24h por e-mail.", isStandard: true });
      }
      await supabase.from("song_requests").update({
        status: "delivered",
        delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
        final_mixed_audio_url: fullAudioUrl || songRequest.final_mixed_audio_url || null
      }).eq("id", requestId);
      firePurchaseEvent();
      const slug = (songRequest.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
      const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
      if (userEmail) {
        logInfo("[Admin] Enviando email de entrega (express/premium)", { requestId, userEmail });
        sendPersonalizedEmail(userEmail, songRequest.recipient_name, personalizedUrl, letterText).catch(
          (err) => logError("[Admin] Falha ao enviar email de entrega (express/premium)", err, { requestId, userEmail })
        );
      }
      if (songRequest.phone) {
        sendDeliveryWhatsApp({
          requestId,
          phone: songRequest.phone,
          recipientName: songRequest.recipient_name,
          songUrl: personalizedUrl
        }).catch((err) => logError("[Admin] Falha ao enviar WhatsApp de entrega (express/premium)", err, { requestId }));
        const feedbackTime = new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString();
        supabase.from("feedback_requests").upsert({
          request_id: requestId,
          scheduled_at: feedbackTime,
          status: "pending",
          recipient_name: songRequest.recipient_name,
          email: userEmail,
          phone: songRequest.phone,
          song_url: personalizedUrl
        }, { onConflict: "request_id" }).select().single().then(
          () => {
          },
          (err) => logError("[Admin] Falha ao agendar pedido de feedback (express/premium)", err, { requestId })
        );
      }
      sendVideoUpsellOffer(requestId, songRequest, req);
      return res.json({ success: true, message: "Pagamento aprovado. M\xFAsica entregue por e-mail e WhatsApp." });
    }
    const isProcessing = songData.mureka_status === "generating" || songData.mureka_status === "processing" || songData.mureka_status === "voice_processing" || songData.mureka_status === "completed" || songData.mureka_task_id && !hasGeneratedAudio;
    if (isProcessing) {
      firePurchaseEvent();
      return res.json({ success: true, message: "M\xFAsica j\xE1 est\xE1 em processamento. A entrega ser\xE1 autom\xE1tica quando conclu\xEDda.", alreadyProcessing: true });
    }
    if (userEmail) {
      logInfo("[Admin] Enviando email de confirmacao (suno workflow)", { requestId, userEmail });
      sendConfirmationEmail(userEmail, songRequest.recipient_name, requestId, "standard_approved").catch(
        (err) => logError("[Admin] Falha ao enviar email de confirmacao (suno workflow)", err, { requestId, userEmail })
      );
    }
    const sunoStandardPhone = songRequest.phone || songRequest.users?.phone || null;
    if (sunoStandardPhone) {
      sendPaymentApprovedWhatsApp({
        requestId,
        phone: sunoStandardPhone,
        recipientName: songRequest.recipient_name
      }).catch((err) => logError("[Admin] Falha ao enviar WhatsApp de aprovacao (suno workflow)", err, { requestId }));
    }
    await supabase.from("song_requests").update({ status: "music_processing" }).eq("id", requestId).eq("status", "payment_submitted");
    firePurchaseEvent();
    runBackgroundSunoWorkflow(requestId, songData.id, songRequest.music_style || "Kizomba", songData.title || "M\xFAsica SeuBeat", songData.lyrics || [], {
      voiceType: songRequest.voice_type || void 0,
      desiredEmotion: songRequest.desired_emotion || void 0
    }).catch((err) => logError("[Admin] Background Suno workflow falhou apos aprovacao", err, { requestId }));
    return res.json({ success: true, message: "Pagamento aprovado. M\xFAsica em processamento no Suno.", hasVoiceSample });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/payment/:id/reject", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: payment } = await supabase.from("payments").select("user_email, request_id, status, proof_path, amount, plan, meta_purchase_sent_at, song_requests(recipient_name, users(phone))").eq("id", id).eq("status", "pending_verification").single();
    if (!payment) return res.status(409).json({ success: false, error: "Pagamento n\xE3o encontrado ou j\xE1 processado." });
    const reason = typeof notes === "string" ? notes.trim() : "";
    if (!reason) {
      return res.status(400).json({ success: false, error: "Indique o motivo da rejei\xE7\xE3o \u2014 \xE9 enviado ao cliente." });
    }
    await supabase.from("payments").update({ status: "rejected", notes: reason }).eq("id", id).eq("status", "pending_verification");
    logAdminAction({ action: "reject", entityType: "payment", entityId: id, previousData: { status: payment?.status }, notes: reason });
    if (payment?.request_id) {
      await supabase.from("song_requests").update({ status: "payment_rejected" }).eq("id", payment.request_id).in("status", ["payment_submitted", "approved"]);
    }
    if (payment.meta_purchase_sent_at) {
      const rejectAmount = parseInt(String(payment.amount || "0").replace(/[^0-9]/g, ""), 10) || 0;
      sendRefundEvent({
        eventId: generateServerEventId(id, "Refund"),
        email: payment.user_email || "",
        phone: payment.song_requests?.users?.phone || void 0,
        value: rejectAmount,
        currency: "AOA",
        contentName: payment.plan || "standard",
        orderId: id,
        eventSourceUrl: req.headers.referer || void 0,
        clientIp: req.ip || req.socket.remoteAddress || void 0,
        clientUserAgent: req.headers["user-agent"],
        externalId: payment.user_email || void 0
      }).catch(
        (err) => logError("[Admin] Meta CAPI Refund event failed", err, { paymentId: id })
      );
    }
    if (payment?.user_email) {
      logInfo("[Admin] Enviando email de rejeicao", { paymentId: id, userEmail: payment.user_email });
      sendPaymentRejectionEmail(payment.user_email, reason).catch((err) => logError("[Admin] Falha ao enviar email de rejeicao", err, { userId: payment.user_email }));
    }
    const songRequest = payment?.song_requests;
    const phone = songRequest?.users?.phone || "";
    const recipientName = songRequest?.recipient_name || "";
    if (phone && payment?.request_id) {
      logInfo("[Admin] Enviando WhatsApp de rejei\xE7\xE3o", { paymentId: id, requestId: payment.request_id });
      sendPaymentRejectedWhatsApp({
        requestId: payment.request_id,
        phone,
        recipientName,
        reason
      }).catch((err) => logError("[Admin] Falha ao enviar WhatsApp de rejei\xE7\xE3o", err, { requestId: payment.request_id }));
    }
    res.json({ success: true, message: "Pagamento rejeitado." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/payment/:id/re-analyze", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: payment, error: fetchErr } = await supabase.from("payments").select("id, proof_path, proof_url, plan, payment_method, status").eq("id", id).single();
    if (fetchErr || !payment) {
      return res.status(404).json({ success: false, error: "Pagamento n\xE3o encontrado." });
    }
    if (!payment.proof_path && !payment.proof_url) {
      return res.status(400).json({ success: false, error: "Este pagamento n\xE3o tem comprovativo para analisar." });
    }
    const proofUrl = payment.proof_url || payment.proof_path;
    let proofBuffer;
    let proofMime = "image/jpeg";
    if (proofUrl && proofUrl.startsWith("http")) {
      const response = await fetch(proofUrl);
      if (!response.ok) return res.status(500).json({ success: false, error: "Falha ao download do comprovativo." });
      const arrayBuf = await response.arrayBuffer();
      proofBuffer = Buffer.from(arrayBuf);
      const contentType = response.headers.get("content-type");
      if (contentType) proofMime = contentType.split(";")[0].trim();
    } else {
      return res.status(400).json({ success: false, error: "Comprovativo n\xE3o acess\xEDvel." });
    }
    const plan = payment.plan || "standard";
    const method = payment.payment_method || "reference";
    const result = await verifyPaymentProof(proofBuffer, proofMime, plan, method);
    await supabase.from("payments").update({ verification_result: JSON.stringify({
      confidence: result.confidence,
      decision: result.decision,
      extracted: result.extracted,
      checks: result.checks,
      provider: result.provider,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      reanalyzed_by: "admin"
    }) }).eq("id", id);
    logAdminAction({ action: "re-analyze", entityType: "payment", entityId: id, notes: `confidence=${result.confidence}, decision=${result.decision}` });
    res.json({ success: true, result });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/requests", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestsData, error } = await supabase.from("song_requests").select("*, users(name, email, phone), songs(id, title, audio_url, mureka_status, created_at, letter_text, lyrics)").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    let paymentsMap = {};
    {
      const { data: paymentsData, error: paymentsError } = await supabase.from("payments").select("id, plan, plan_type, amount, status, created_at, payment_reference, user_email, request_id, proof_url, proof_filename, notes, approved_at").order("created_at", { ascending: false });
      if (paymentsError) {
        logWarn("[Admin] Falha ao carregar payments para /requests", { error: safeMessage(paymentsError) });
      }
      for (const p of paymentsData || []) {
        if (!p.request_id) continue;
        const plan = p.plan || p.plan_type || null;
        if (!paymentsMap[p.request_id]) paymentsMap[p.request_id] = [];
        paymentsMap[p.request_id].push({ ...p, plan });
      }
    }
    const data = (requestsData || []).map((r) => ({
      ...r,
      payments: paymentsMap[r.id] || []
    }));
    res.json({ success: true, requests: data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/songs", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data, error } = await supabase.from("songs").select("*, song_requests(id, recipient_name, music_style, occasion, users(name, email, phone))").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    const songs = data || [];
    const requestIds = Array.from(new Set(
      songs.map((song) => firstRelated(song.song_requests)?.id).filter(Boolean)
    ));
    const planByRequestId = /* @__PURE__ */ new Map();
    if (requestIds.length > 0) {
      const { data: payments, error: paymentsError } = await supabase.from("payments").select("request_id, plan, created_at").in("request_id", requestIds).order("created_at", { ascending: false });
      if (paymentsError) {
        logWarn("[Admin] Falha ao carregar planos para m\xFAsicas", { error: safeMessage(paymentsError) });
      } else {
        (payments || []).forEach((payment) => {
          if (payment.request_id && payment.plan && !planByRequestId.has(payment.request_id)) {
            planByRequestId.set(payment.request_id, payment.plan);
          }
        });
      }
    }
    const songsWithPlans = songs.map((song) => ({
      ...song,
      song_requests: mapRelated(song.song_requests, (requestData) => ({
        ...requestData,
        plan: planByRequestId.get(requestData.id)
      }))
    }));
    res.json({ success: true, songs: songsWithPlans });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/song/:id/generate-music", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { forceNew } = req.body || {};
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: songData, error } = await supabase.from("songs").select("*, song_requests(music_style, voice_type, desired_emotion)").eq("id", id).single();
    if (error || !songData) return res.status(404).json({ success: false, error: "M\xFAsica n\xE3o encontrada" });
    if (!forceNew && songData.request_id && songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(songData.request_id, id, songData.mureka_task_id).catch((err) => logError("[Admin] Resume Suno task falhou", err, { songId: id }));
      return res.json({ success: true, message: "Verifica\xE7\xE3o da task Suno existente iniciada." });
    }
    if (!songData.request_id) return res.status(400).json({ success: false, error: "Musica sem pedido associado." });
    await supabase.from("songs").update({
      mureka_status: "generating",
      mureka_task_id: null,
      audio_url: forceNew ? null : songData.audio_url,
      full_song_url: forceNew ? null : songData.full_song_url,
      preview_url: null
    }).eq("id", id);
    await supabase.from("song_requests").update({ status: "music_processing" }).eq("id", songData.request_id);
    const sr = songData.song_requests || {};
    runBackgroundSunoWorkflow(
      songData.request_id,
      id,
      sr?.music_style || "Kizomba",
      songData.title || "Musica SeuBeat",
      normalizeLyricsArray(songData.lyrics),
      { voiceType: sr?.voice_type || void 0, desiredEmotion: sr?.desired_emotion || void 0 }
    ).catch((err) => logError("[Admin] Background Suno falhou apos iniciar", err, { songId: id }));
    res.json({ success: true, message: "Gera\xE7\xE3o Suno iniciada em background." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/credits", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const now = /* @__PURE__ */ new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [sunoResult, deepseekResult, claudeResult, openaiResult, geminiResult, emailResult, songsRes, songsMonthRes, songsByMonthRes] = await Promise.all([
      // Suno live credit check
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: "SUNO_API_KEY em falta" };
        try {
          const creditsRes = await fetch("https://api.sunoapi.org/api/v1/generate/credit", { headers: { "Authorization": `Bearer ${key}` } });
          if (!creditsRes.ok) return { ok: false, error: `HTTP ${creditsRes.status}` };
          const creditsData = await creditsRes.json();
          const credits = creditsData.data || 0;
          return { ok: true, credits, low: credits < 20, lastCheck: now.toISOString() };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      checkDeepSeek(now),
      // Claude live check
      (async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY em falta" };
        try {
          const AnthropicClient = await loadAnthropic();
          const client = new AnthropicClient({ apiKey });
          const response = await client.messages.create({
            model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
          });
          return { ok: !!(response && response.content), model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022", lastCheck: now.toISOString() };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("quota") || msg.includes("limit") || msg.includes("429")) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022", lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // OpenAI live check
      (async () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { ok: false, error: "OPENAI_API_KEY em falta" };
        try {
          const OpenAIClient = await loadOpenAI();
          const openai = new OpenAIClient({ apiKey });
          const models = await openai.models.list({ timeout: 5e3 });
          const creditsRes = await fetch("https://api.openai.com/v1/dashboard/billing/credit_grants", {
            headers: { "Authorization": `Bearer ${apiKey}` }
          });
          if (creditsRes.ok) {
            const data = await creditsRes.json();
            return {
              ok: true,
              total_granted: data.total_granted || 0,
              total_used: data.total_used || 0,
              total_available: data.total_available || 0,
              model: process.env.OPENAI_MODEL || "gpt-4o",
              lastCheck: now.toISOString()
            };
          }
          return { ok: true, model: process.env.OPENAI_MODEL || "gpt-4o", lastCheck: now.toISOString() };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("quota") || msg.includes("limit") || msg.includes("429") || msg.includes("insufficient")) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.OPENAI_MODEL || "gpt-4o", lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // Gemini live check
      (async () => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return { ok: false, error: "GEMINI_API_KEY em falta" };
        try {
          const GoogleGenAIClient = await loadGoogleGenAI2();
          const genAI = new GoogleGenAIClient({ apiKey });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            config: { maxOutputTokens: 1 }
          });
          return { ok: true, model: process.env.GEMINI_MODEL || "gemini-2.5-flash", lastCheck: now.toISOString() };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("quota") || msg.includes("limit") || msg.includes("429") || msg.includes("insufficient") || msg.includes("RATE_LIMIT") || msg.includes("dailyLimitExceeded") || msg.includes("quotaExceeded")) {
            return { ok: true, quota_exceeded: true, error: msg, model: process.env.GEMINI_MODEL || "gemini-2.5-flash", lastCheck: now.toISOString() };
          }
          return { ok: false, error: msg };
        }
      })(),
      // Brevo API live check
      (async () => {
        const key = process.env.BREVO_API_KEY;
        if (!key) return { ok: false, error: "BREVO_API_KEY em falta" };
        try {
          const test = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, accept: "application/json" } });
          if (!test.ok) return { ok: false, error: `Brevo API error (${test.status})` };
          const data = await test.json();
          return { ok: true, provider: "Brevo", email: data.email, lastCheck: now.toISOString() };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      // Total songs generated
      supabase.from("songs").select("id", { count: "exact", head: true }).not("lyrics", "is", null),
      // Songs this month
      supabase.from("songs").select("id", { count: "exact", head: true }).not("lyrics", "is", null).gte("created_at", firstOfMonth),
      // Songs by month for chart
      supabase.from("songs").select("created_at").not("lyrics", "is", null).order("created_at", { ascending: true })
    ]);
    const totalSongs = songsRes.count || 0;
    const songsThisMonth = songsMonthRes.count || 0;
    const songsData = songsByMonthRes.data || [];
    const monthlyCount = {};
    songsData.forEach((s) => {
      if (s.created_at) {
        const month = s.created_at.slice(0, 7);
        monthlyCount[month] = (monthlyCount[month] || 0) + 1;
      }
    });
    const songsByMonth = Object.entries(monthlyCount).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
    const sunoCredits = sunoResult.ok ? sunoResult.credits : 0;
    const CREDITS_PER_SONG = 24;
    const estCreditsUsed = totalSongs * CREDITS_PER_SONG;
    const estSongsRemaining = sunoCredits > 0 ? Math.floor(sunoCredits / CREDITS_PER_SONG) : 0;
    const sunoCostPerCredit = Number(process.env.SUNO_COST_PER_CREDIT_USD) || 5e-3;
    const deepseekCostPerGen = Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 5e-4;
    const claudeCostPerGen = Number(process.env.CLAUDE_COST_PER_GENERATION_USD) || 0.03;
    const openaiCostPerGen = Number(process.env.OPENAI_COST_PER_GENERATION_USD) || 0.01;
    const estSunoCost = +(estCreditsUsed * sunoCostPerCredit).toFixed(2);
    const estDeepSeekCost = +(totalSongs * deepseekCostPerGen).toFixed(2);
    const estClaudeCost = +(totalSongs * claudeCostPerGen).toFixed(2);
    const estOpenAICost = +(totalSongs * openaiCostPerGen).toFixed(2);
    const estLyricCost = Math.min(estDeepSeekCost, estClaudeCost, estOpenAICost);
    const estTotalCost = +(estSunoCost + estLyricCost).toFixed(2);
    res.json({
      suno: sunoResult,
      deepseek: deepseekResult,
      claude: claudeResult,
      openai: openaiResult,
      gemini: geminiResult,
      email: emailResult,
      usage: {
        totalSongs,
        songsThisMonth,
        songsByMonth,
        estimatedSunoCreditsUsed: estCreditsUsed,
        estimatedSongsRemaining: estSongsRemaining,
        cost: {
          sunoUSD: estSunoCost,
          deepseekUSD: estDeepSeekCost,
          claudeUSD: estClaudeCost,
          openaiUSD: estOpenAICost,
          lyricUSD: +estLyricCost.toFixed(2),
          totalUSD: estTotalCost,
          perSong: +(sunoCostPerCredit * CREDITS_PER_SONG + Math.min(deepseekCostPerGen, claudeCostPerGen, openaiCostPerGen)).toFixed(4)
        }
      }
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
var VALID_STATUSES = {
  song_requests: ["lyrics_generating", "lyrics_ready", "approved", "music_processing", "voice_processing", "music_ready", "delivered", "failed", "payment_rejected", "payment_submitted"],
  payments: ["pending_verification", "approved", "rejected", "failed"],
  songs: ["not_started", "generating", "processing", "completed", "failed"]
};
router.post("/request/:id/force-status", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { table, status: status2, field } = req.body;
    if (!table || !status2) {
      return res.status(400).json({ success: false, error: 'Par\xE2metros "table" e "status" s\xE3o obrigat\xF3rios.' });
    }
    const allowed = VALID_STATUSES[table];
    if (!allowed) {
      return res.status(400).json({ success: false, error: `Tabela inv\xE1lida. Use: ${Object.keys(VALID_STATUSES).join(", ")}` });
    }
    if (!allowed.includes(status2)) {
      return res.status(400).json({ success: false, error: `Status inv\xE1lido para "${table}". Permitidos: ${allowed.join(", ")}` });
    }
    const ALLOWED_FIELDS = {
      song_requests: ["status"],
      payments: ["status"],
      songs: ["mureka_status"]
    };
    const statusField = field || (table === "songs" ? "mureka_status" : "status");
    const allowedFields = ALLOWED_FIELDS[table] || [];
    if (!allowedFields.includes(statusField)) {
      return res.status(400).json({ success: false, error: `Campo "${statusField}" n\xE3o \xE9 edit\xE1vel. Permitidos: ${allowedFields.join(", ")}` });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const updatePayload = { [statusField]: status2 };
    if (table === "song_requests" && status2 === "delivered") {
      updatePayload.delivered_at = (/* @__PURE__ */ new Date()).toISOString();
    }
    const { data, error } = await supabase.from(table).update(updatePayload).eq("id", id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    if (!data) return res.status(404).json({ success: false, error: "Registo n\xE3o encontrado." });
    logInfo("[Admin] Status for\xE7ado manualmente", { table, id, status: status2, field: statusField });
    logAdminAction({ action: "force_status", entityType: table, entityId: id, previousData: { [statusField]: data[statusField] || data.status }, newData: { [statusField]: status2 }, notes: `For\xE7ado para ${status2}` });
    if (table === "song_requests" && status2 === "delivered") {
      const { data: songRequest } = await supabase.from("song_requests").select("*, songs(*), users(*)").eq("id", id).single();
      const song = firstRelated(songRequest?.songs);
      if (songRequest?.users?.email && song) {
        const slug = (songRequest.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
        const url = `${getAppUrl(req)}/song/${slug}?id=${song.id}`;
        sendPersonalizedEmail(songRequest.users.email, songRequest.recipient_name, url, song.letter_text || "Dedicat\xF3ria.").catch((err) => logWarn("[Admin] Falha ao enviar email ap\xF3s force-status delivered", { error: err?.message }));
        const clientPhone = songRequest.phone || songRequest.users?.phone;
        if (clientPhone) {
          sendDeliveryWhatsApp({
            requestId: songRequest.id,
            phone: clientPhone,
            recipientName: songRequest.recipient_name,
            songUrl: url
          }).catch((err) => logWarn("[Admin] Falha ao enviar WhatsApp de entrega", { error: String(err) }));
        }
      }
    }
    res.json({ success: true, message: `Status atualizado para "${status2}" em "${table}".`, data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/diagnostics", adminAuth, async (req, res) => {
  try {
    const now = /* @__PURE__ */ new Date();
    const [supabaseDiag, deepseekDiag, claudeDiag, openaiDiag, geminiDiag, sunoDiag, sunoVoiceDiag, emailDiag] = await Promise.all([
      (async () => {
        const supabase = getAdminSupabase();
        if (!supabase) return { ok: false, error: "Cliente n\xE3o inicializado" };
        try {
          const { data, error } = await supabase.storage.listBuckets();
          if (error) return { ok: false, error: error.message };
          return { ok: true, buckets: data.map((b) => ({ name: b.name, public: b.public })) };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      checkDeepSeek(now),
      (async () => {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY em falta" };
        try {
          const AnthropicClient = await loadAnthropic();
          const client = new AnthropicClient({ apiKey });
          const response = await client.messages.create({
            model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20241022",
            max_tokens: 5,
            messages: [{ role: "user", content: "ping" }]
          });
          return { ok: !!(response && response.content) };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      (async () => {
        const key = process.env.OPENAI_API_KEY;
        if (!key) return { ok: false, error: "OPENAI_API_KEY em falta" };
        try {
          const OpenAIClient = await loadOpenAI();
          const openai = new OpenAIClient({ apiKey: key });
          await openai.models.list({ timeout: 5e3 });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      // Gemini diagnostic
      (async () => {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return { ok: false, error: "GEMINI_API_KEY em falta" };
        try {
          const GoogleGenAIClient = await loadGoogleGenAI2();
          const genAI = new GoogleGenAIClient({ apiKey: key });
          const response = await genAI.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: "ping" }] }],
            config: { maxOutputTokens: 8 }
          });
          return { ok: !!response };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: "SUNO_API_KEY em falta" };
        try {
          const creditsRes = await fetch("https://api.sunoapi.org/api/v1/generate/credit", { headers: { "Authorization": `Bearer ${key}` } });
          if (!creditsRes.ok) return { ok: false, error: `HTTP ${creditsRes.status}` };
          const creditsData = await creditsRes.json();
          return { ok: true, credits: creditsData.data || 0 };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      (async () => {
        const key = process.env.SUNO_API_KEY;
        if (!key) return { ok: false, error: "SUNO_API_KEY em falta" };
        try {
          const res2 = await fetch("https://api.sunoapi.org/api/v1/voice/record-info?taskId=ping_test", { headers: { "Authorization": `Bearer ${key}` } });
          return { ok: res2.status !== 401 && res2.status !== 403 };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      })(),
      (async () => {
        const key = process.env.BREVO_API_KEY;
        if (!key) return { ok: false, error: "BREVO_API_KEY em falta" };
        return { ok: true, provider: "Brevo" };
      })()
    ]);
    const mem = process.memoryUsage();
    res.json({
      supabase: supabaseDiag,
      deepseek: deepseekDiag,
      claude: claudeDiag,
      openai: openaiDiag,
      gemini: geminiDiag,
      suno: sunoDiag,
      sunoVoice: sunoVoiceDiag,
      email: emailDiag,
      server: {
        uptime: process.uptime(),
        node: process.version,
        platform: process.platform,
        memory: {
          rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
        }
      }
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/retry", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData } = await supabase.from("song_requests").select("*, songs(*)").eq("id", id).single();
    if (!requestData) return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado" });
    const songData = firstRelated(requestData.songs);
    if (!songData) return res.status(400).json({ success: false, error: "M\xFAsica associada em falta." });
    if (songData.mureka_task_id && !songData.audio_url) {
      resumeSunoTaskWorkflow(id, songData.id, songData.mureka_task_id).catch((err) => logError("[Admin] Resume Suno task falhou no retry", err, { requestId: id }));
      return res.json({ success: true, message: "Retomado." });
    }
    await supabase.from("song_requests").update({ status: "music_processing" }).eq("id", id);
    await supabase.from("songs").update({ mureka_status: "generating" }).eq("id", songData.id);
    runBackgroundSunoWorkflow(id, songData.id, requestData.music_style || "Kizomba", songData.title || "M\xFAsica SeuBeat", songData.lyrics || [], {
      voiceType: requestData.voice_type || void 0,
      desiredEmotion: requestData.desired_emotion || void 0
    }).catch((err) => logError("[Admin] Background Suno falhou no retry", err, { requestId: id }));
    res.json({ success: true, message: "Reiniciado." });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logError("[Admin] retry ERRO", err instanceof Error ? err : new Error(errMsg), { requestId: req.params?.id });
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/recover", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB nao disponivel" });
    const { data: requestData } = await supabase.from("song_requests").select("*, songs(*)").eq("id", id).single();
    if (!requestData) return res.status(404).json({ success: false, error: "Pedido nao encontrado" });
    const songData = firstRelated(requestData.songs);
    if (!songData) return res.status(400).json({ success: false, error: "M\xFAsica associada em falta." });
    const knownTaskIds = [
      "f5ecb840034c7661a0c6f5b1868b7f44",
      "52d7f402a8cd806e7bd29796d23acb58",
      "6909cae212783daf684c2fe6db85fa87"
    ];
    logInfo("[Admin Recover] Iniciando recovery", { ourId: id });
    let foundAudioUrl = null;
    let usedTaskId = null;
    for (const taskId of knownTaskIds) {
      if (!taskId) continue;
      try {
        const result = await querySunoTask(taskId);
        if (result.audioUrl) {
          foundAudioUrl = result.audioUrl;
          usedTaskId = taskId;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    if (!foundAudioUrl) {
      return res.json({ success: false, error: "Nenhuma task tem \xE1udio." });
    }
    const persistResult = await persistGeneratedSunoAudio(songData.id, usedTaskId, foundAudioUrl, {
      skipProcessing: true,
      hintDuration: songData.duration ?? 239
    });
    await supabase.from("songs").update({
      audio_url: persistResult.fullAudioUrl,
      full_song_url: persistResult.fullAudioUrl,
      preview_url: null,
      duration: persistResult.duration,
      mureka_task_id: usedTaskId,
      mureka_status: "completed"
    }).eq("id", songData.id);
    return res.json({ success: true, message: "Recovery OK" });
  } catch (err) {
    logRouteError(req, err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});
router.post("/request/:id/force-voice", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData } = await supabase.from("song_requests").select("*, songs(*)").eq("id", id).single();
    const songData = firstRelated(requestData?.songs);
    if (!requestData || !songData) return res.status(404).json({ success: false, error: "Pedido ou m\xFAsica n\xE3o encontrada" });
    if (!requestData.voice_sample_url) return res.status(400).json({ success: false, error: "Sem amostra de voz." });
    await supabase.from("song_requests").update({ status: "voice_processing" }).eq("id", id);
    const voiceSampleUrl = requestData.voice_sample_url;
    processSunoVoice(id, songData.id, voiceSampleUrl).then((voiceId) => {
      if (voiceId) {
        supabase.from("song_requests").update({ status: "music_processing" }).eq("id", id).then(({ error }) => {
          if (error) logError("[Admin] Force-voice: falha ao setar music_processing", error, { requestId: id });
        });
      }
    }).catch((err) => logError("[Admin] Force Suno Voice falhou", err, { requestId: id }));
    res.json({ success: true, message: "Processamento de voz Suno Voice for\xE7ado." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/resend-email", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData } = await supabase.from("song_requests").select("*, songs(*), users(*)").eq("id", id).single();
    const songData = firstRelated(requestData?.songs);
    if (!requestData || !songData || !requestData.users?.email) return res.status(404).json({ success: false, error: "Dados insuficientes." });
    const deliverableStatuses = ["delivered", "approved", "music_ready"];
    if (!deliverableStatuses.includes(requestData.status)) {
      return res.status(400).json({ success: false, error: `Estado "${requestData.status}" n\xE3o permite reenvio de email.` });
    }
    const slug = (requestData.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
    const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
    await sendPersonalizedEmail(requestData.users.email, requestData.recipient_name, personalizedUrl, songData.letter_text || "Dedicat\xF3ria.");
    res.json({ success: true, message: "Email reenviado." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/song/:id/edit-lyrics", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, lyrics, letterText } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const lyricsArray = normalizeLyricsArray(lyrics);
    const { data, error } = await supabase.from("songs").update({ title, lyrics: lyricsArray, letter_text: letterText || null }).eq("id", id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, song: data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
router.get("/song/:id/audio-url", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: song, error } = await supabase.from("songs").select("id, title, audio_url, full_song_url, preview_url, audio_url_v2, full_song_url_v2").eq("id", id).single();
    if (error || !song) return res.status(404).json({ success: false, error: "M\xFAsica n\xE3o encontrada." });
    const wantV2 = req.query.version === "2";
    const fullUrl = wantV2 ? song.full_song_url_v2 || song.audio_url_v2 || null : song.full_song_url || song.audio_url;
    const fullPath = extractStoragePath(fullUrl, "full-audio");
    if (fullPath) {
      const downloadName = safeAudioFilename(song.title);
      const options = req.query.download === "1" ? { download: downloadName } : void 0;
      const signedUrl = await createSignedStorageUrl("full-audio", fullPath, 3600);
      if (!signedUrl) return res.status(500).json({ success: false, error: "N\xE3o foi poss\xEDvel gerar link seguro da m\xFAsica completa." });
      return res.json({ success: true, url: signedUrl, filename: downloadName, source: "full-audio" });
    }
    const fallbackUrl = fullUrl || song.preview_url;
    if (!fallbackUrl) return res.status(404).json({ success: false, error: "\xC1udio indispon\xEDvel." });
    res.json({ success: true, url: fallbackUrl, filename: safeAudioFilename(song.title), source: "audio" });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/song/:id/upload-audio", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const { audioBase64, audioFilename, audioMimeType } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    if (typeof audioBase64 !== "string") return res.status(400).json({ success: false, error: "\xC1udio ausente ou inv\xE1lido." });
    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 50 * 1024 * 1024) return res.status(400).json({ success: false, error: "\xC1udio demasiado grande. M\xE1x. 50MB." });
    const sanitizedAudioFilename = String(audioFilename || "manual_audio.mp3").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `songs/${Date.now()}_${sanitizedAudioFilename}`;
    const fullAudioUrl = await uploadFileToStorage("full-audio", filename, buffer, audioMimeType || "audio/mpeg");
    await supabase.from("songs").update({ audio_url: fullAudioUrl, full_song_url: fullAudioUrl, mureka_status: "completed", preview_url: null }).eq("id", id);
    const { data: songData } = await supabase.from("songs").select("request_id").eq("id", id).single();
    if (songData?.request_id) {
      const { data: approvedPayment } = await supabase.from("payments").select("id, plan, created_at").eq("request_id", songData.request_id).eq("status", "approved").maybeSingle();
      if (approvedPayment) {
        const isStandard = approvedPayment.plan === "standard";
        const paymentCreatedAt = approvedPayment.created_at || (/* @__PURE__ */ new Date()).toISOString();
        const deliverAt = isStandard ? new Date(new Date(paymentCreatedAt).getTime() + 24 * 60 * 60 * 1e3).toISOString() : null;
        const retryUpdate = {
          status: isStandard ? "approved" : "delivered",
          deliver_at: deliverAt,
          final_mixed_audio_url: fullAudioUrl
        };
        if (!isStandard) retryUpdate.delivered_at = (/* @__PURE__ */ new Date()).toISOString();
        await supabase.from("song_requests").update(retryUpdate).eq("id", songData.request_id);
      } else {
        await supabase.from("song_requests").update({ status: "music_ready" }).eq("id", songData.request_id);
      }
    }
    res.json({ success: true });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/clients", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data, error } = await supabase.from("users").select("*, song_requests(id, status, created_at)").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, clients: data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/progress", adminAuth, async (req, res) => {
  try {
    const progress2 = { ...requestProgressMap };
    const now = Date.now();
    const PROGRESS_TTL_MS2 = 5 * 60 * 1e3;
    for (const [id, p] of Object.entries(progress2)) {
      if (now - p.updatedAt > PROGRESS_TTL_MS2) delete progress2[id];
    }
    res.json(progress2);
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/undo", adminAuth, async (req, res) => {
  try {
    const { entityType, entityId, action } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    if (!entityType || !entityId || !action) {
      return res.status(400).json({ success: false, error: 'Par\xE2metros "entityType", "entityId" e "action" obrigat\xF3rios.' });
    }
    if (action === "approve" || action === "reject") {
      if (entityType === "payment") {
        const targetStatus = action === "approve" ? "approved" : "rejected";
        const { error: undoError } = await supabase.from("payments").update({ status: "pending_verification", approved_at: null, verification_result: null, ai_verified: false, notes: "Desfeito pelo admin" }).eq("id", entityId).eq("status", targetStatus);
        if (!undoError) {
          const { data: pay } = await supabase.from("payments").select("request_id, status").eq("id", entityId).single();
          if (pay?.request_id && pay.status === "pending_verification") {
            await supabase.from("song_requests").update({ status: "payment_submitted" }).eq("id", pay.request_id).in("status", ["payment_rejected", "approved", "delivered", "music_ready", "music_processing", "voice_processing"]);
          }
        }
        if (undoError) {
          logAdminAction({ action: "undo", entityType: "payment", entityId, notes: `Undo falhou: ${undoError.message}` });
          return res.status(500).json({ success: false, error: `Falha ao reverter pagamento: ${undoError.message}` });
        }
        logAdminAction({ action: "undo", entityType: "payment", entityId, notes: `Undo: ${action}` });
        return res.json({ success: true, message: `Ac\xE7\xE3o de "${action}" revertida. Pagamento voltou a "pending_verification".` });
      }
    }
    if (action === "force_status") {
      const { previousStatus } = req.body;
      if (!previousStatus) return res.status(400).json({ success: false, error: 'For\xE7a-status undo requer "previousStatus".' });
      const undoAllowed = VALID_STATUSES[entityType] || [];
      if (undoAllowed.length > 0 && !undoAllowed.includes(previousStatus)) {
        return res.status(400).json({ success: false, error: `previousStatus "${previousStatus}" inv\xE1lido para "${entityType}". Permitidos: ${undoAllowed.join(", ")}` });
      }
      if (entityType === "song_requests" || entityType === "payments") {
        const { error: undoFsErr } = await supabase.from(entityType).update({ status: previousStatus }).eq("id", entityId);
        if (undoFsErr) return res.status(500).json({ success: false, error: `Falha ao reverter ${entityType}: ${undoFsErr.message}` });
        logAdminAction({ action: "undo", entityType, entityId, notes: `Undo force_status: revertido para ${previousStatus}` });
        return res.json({ success: true, message: `Estado revertido para "${previousStatus}".` });
      }
      if (entityType === "songs") {
        const { error: undoSongErr } = await supabase.from("songs").update({ mureka_status: previousStatus }).eq("id", entityId);
        if (undoSongErr) return res.status(500).json({ success: false, error: `Falha ao reverter songs: ${undoSongErr.message}` });
        logAdminAction({ action: "undo", entityType: "songs", entityId, notes: `Undo force_status: revertido para ${previousStatus}` });
        return res.json({ success: true, message: `Estado revertido para "${previousStatus}".` });
      }
    }
    res.status(400).json({ success: false, error: "Combina\xE7\xE3o entityType/action n\xE3o suportada para undo." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/update-style", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { music_style, voice_type } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const updateData = {};
    if (music_style) updateData.music_style = music_style;
    if (voice_type) updateData.voice_type = voice_type;
    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: "Nada para atualizar." });
    const { data, error } = await supabase.from("song_requests").update(updateData).eq("id", id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true, data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/user/:id/edit", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const updateData = {};
    if (name !== void 0) {
      if (typeof name !== "string" || name.length > 100) return res.status(400).json({ success: false, error: "Nome inv\xE1lido (max 100 caracteres)." });
      updateData.name = name.trim() || null;
    }
    if (email !== void 0) {
      if (typeof email !== "string" || !email.includes("@")) return res.status(400).json({ success: false, error: "Email inv\xE1lido." });
      const normalizedEmail = email.trim().toLowerCase();
      const { data: existing } = await supabase.from("users").select("id").eq("email", normalizedEmail).neq("id", id).maybeSingle();
      if (existing) return res.status(400).json({ success: false, error: "Este email j\xE1 est\xE1 em uso por outro cliente." });
      updateData.email = normalizedEmail;
    }
    if (phone !== void 0) {
      if (typeof phone === "string" && phone.trim() && !/^\+?[\d\s()-]{7,18}$/.test(phone.trim())) {
        return res.status(400).json({ success: false, error: "Telefone inv\xE1lido (7-18 caracteres)." });
      }
      updateData.phone = phone?.trim() || null;
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: "Nada para atualizar." });
    const { data, error } = await supabase.from("users").update(updateData).eq("id", id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    logInfo("[Admin] Dados do cliente atualizados", { userId: id, fields: Object.keys(updateData) });
    res.json({ success: true, data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/edit-details", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient_name, relationship, occasion, language } = req.body;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const updateData = {};
    if (recipient_name !== void 0) {
      if (typeof recipient_name !== "string" || recipient_name.trim().length < 1 || recipient_name.trim().length > 100) {
        return res.status(400).json({ success: false, error: "Nome do destinat\xE1rio inv\xE1lido (1-100 caracteres)." });
      }
      updateData.recipient_name = recipient_name.trim();
    }
    if (relationship !== void 0) {
      if (typeof relationship !== "string" || !relationship.trim()) {
        return res.status(400).json({ success: false, error: "Rela\xE7\xE3o inv\xE1lida." });
      }
      updateData.relationship = relationship.trim().toLowerCase();
    }
    if (occasion !== void 0) {
      if (typeof occasion !== "string" || !occasion.trim()) {
        return res.status(400).json({ success: false, error: "Ocasi\xE3o inv\xE1lida." });
      }
      updateData.occasion = occasion.trim().toLowerCase();
    }
    if (language !== void 0) {
      if (typeof language !== "string" || !language.trim()) {
        return res.status(400).json({ success: false, error: "Idioma inv\xE1lido." });
      }
      updateData.language = language.trim().toLowerCase();
    }
    if (Object.keys(updateData).length === 0) return res.status(400).json({ success: false, error: "Nada para atualizar." });
    const { data, error } = await supabase.from("song_requests").update(updateData).eq("id", id).select().single();
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    logInfo("[Admin] Dados do pedido atualizados", { requestId: id, fields: Object.keys(updateData) });
    res.json({ success: true, data });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/request/:id/regenerate-lyrics", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData, error: reqError } = await supabase.from("song_requests").select("*, songs(id, title, lyrics, letter_text), users(name, email, phone)").eq("id", id).single();
    if (reqError || !requestData) return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado" });
    const existingSong = firstRelated(requestData.songs);
    const formData = {
      userNick: requestData.users?.name || "Autor",
      recipientName: requestData.recipient_name,
      recipientGender: requestData.recipient_gender || "Masculino",
      recipientRelation: requestData.relationship,
      recipientNick: requestData.recipient_nick || "",
      occasion: requestData.occasion,
      musicStyle: requestData.music_style,
      voiceType: requestData.voice_type,
      unforgettableMemory: requestData.memory || "",
      whatMakesSpecial: requestData.special_traits || "",
      onlySheDoes: requestData.only_she_does || "",
      whereItHappened: requestData.where_it_happened || "",
      whyCreatedToday: requestData.why_created_today || "",
      referenceArtist: requestData.reference_artist || "",
      messageFromTheHeart: requestData.heart_message || "",
      hookPhrase: requestData.hook_phrase || "",
      desiredEmotion: requestData.desired_emotion || "Emocionante",
      language: requestData.language || "portugu\xEAs"
    };
    const { generateLyrics: generateLyrics2 } = await Promise.resolve().then(() => (init_ai(), ai_exports));
    const { result: parsedData } = await generateLyrics2(formData, {
      requestId: requestData.id,
      email: requestData.users?.email || void 0
    });
    if (existingSong) {
      const { data: updatedSong, error: songError } = await supabase.from("songs").update({
        title: parsedData.songTitle,
        lyrics: parsedData.lyrics,
        lyrics_snippet: parsedData.lyricsSnippet,
        letter_text: parsedData.letterText
      }).eq("id", existingSong.id).select().single();
      if (songError) return res.status(500).json({ success: false, error: safeMessage(songError) });
      return res.json({ success: true, song: updatedSong, recovered: false });
    }
    const { data: createdSong, error: createError } = await supabase.from("songs").insert([{
      request_id: requestData.id,
      title: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyrics_snippet: parsedData.lyricsSnippet,
      letter_text: parsedData.letterText,
      mureka_status: "not_started"
    }]).select().single();
    if (createError) return res.status(500).json({ success: false, error: safeMessage(createError) });
    if (requestData.status === "failed") {
      const { error: statusError } = await supabase.from("song_requests").update({ status: "lyrics_ready", error_details: null }).eq("id", requestData.id);
      if (statusError) {
        logError("[API] Falha ao atualizar status ap\xF3s regenerar pedido falhado", statusError, { requestId: requestData.id });
      }
    }
    res.json({ success: true, song: createdSong, recovered: true });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/request/:id/logs", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData } = await supabase.from("song_requests").select("*, songs(*), payments(*)").eq("id", id).single();
    if (!requestData) return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado" });
    const logs = [];
    const push = (ts, event, detail) => logs.push({ timestamp: ts, event, detail });
    if (requestData.created_at) push(requestData.created_at, "Pedido Criado", `Por ${requestData.users?.name || "\u2014"} (${requestData.users?.email || "\u2014"})`);
    if (requestData.status) push(requestData.updated_at || requestData.created_at, `Status: ${requestData.status}`, "");
    const song = firstRelated(requestData.songs);
    if (song?.created_at) push(song.created_at, "Letra Gerada", `T\xEDtulo: ${song.title}`);
    if (requestData.payments?.length) {
      requestData.payments.forEach((p) => {
        push(p.created_at, "Pagamento Submetido", `${p.plan} \u2014 ${p.amount}`);
        if (p.status === "approved") push(p.approved_at || p.created_at, "Pagamento Aprovado", "");
        if (p.status === "rejected") push(p.updated_at || p.created_at, "Pagamento Rejeitado", p.notes || "");
      });
    }
    if (song?.audio_url) push(song.created_at, "\xC1udio Gerado", "URL do \xE1udio dispon\xEDvel");
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    res.json({ success: true, logs });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/metrics", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const [requestsRes, paymentsRes, songsRes] = await Promise.all([
      supabase.from("song_requests").select("id, status, created_at, music_style", { count: "exact" }),
      supabase.from("payments").select("id, request_id, status, amount, plan, created_at, approved_at"),
      supabase.from("songs").select("id, created_at, request_id")
    ]);
    const requests = requestsRes.data || [];
    const payments = paymentsRes.data || [];
    const songs = songsRes.data || [];
    const firstActivityAt = [...requests.map((r) => r.created_at), ...payments.map((p) => p.created_at), ...songs.map((s) => s.created_at)].filter(Boolean).sort()[0];
    const since = firstActivityAt ? isoDateOnly(new Date(firstActivityAt)) : isoDateOnly(/* @__PURE__ */ new Date());
    const until = isoDateOnly(/* @__PURE__ */ new Date());
    const metaAds = await getMetaAdsSpend({ since, until });
    const { ENV: MetricsEnv } = await Promise.resolve().then(() => (init_env(), env_exports));
    const usdToKz = MetricsEnv.USD_TO_KZ_RATE;
    const totalRequests = requests.length;
    const paidRequests = new Set(payments.filter((p) => p.status === "approved" && p.request_id).map((p) => p.request_id)).size;
    const conversionRate = totalRequests > 0 ? (paidRequests / totalRequests * 100).toFixed(1) : "0.0";
    const approvedPayments = payments.filter((p) => p.status === "approved" && p.approved_at);
    let avgApprovalHours = 0;
    if (approvedPayments.length > 0) {
      const totalHours = approvedPayments.reduce((sum, p) => {
        const created = new Date(p.created_at).getTime();
        const approved = new Date(p.approved_at).getTime();
        return sum + (approved - created) / (1e3 * 60 * 60);
      }, 0);
      avgApprovalHours = Math.round(totalHours / approvedPayments.length);
    }
    const styleCount = {};
    requests.forEach((r) => {
      const style = r.music_style || "Outro";
      styleCount[style] = (styleCount[style] || 0) + 1;
    });
    const popularStyles = Object.entries(styleCount).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([style, count]) => ({ style, count }));
    const monthlyRevenue = {};
    approvedPayments.forEach((p) => {
      const month = new Date(p.approved_at).toISOString().slice(0, 7);
      const num = parseMoneyAmount(p.amount);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + num;
    });
    const revenueByMonth = Object.entries(monthlyRevenue).sort((a, b) => a[0].localeCompare(b[0])).map(([month, revenue]) => ({ month, revenue }));
    const planRevenue = {};
    approvedPayments.forEach((p) => {
      const plan = p.plan || "standard";
      const num = parseMoneyAmount(p.amount);
      planRevenue[plan] = (planRevenue[plan] || 0) + num;
    });
    const revenueByPlan = Object.entries(planRevenue).map(([plan, revenue]) => ({ plan, revenue }));
    const pendingCount = requests.filter((r) => r.status === "payment_submitted").length + payments.filter((p) => p.status === "pending_verification").length;
    const totalRevenue = approvedPayments.reduce((sum, p) => sum + parseMoneyAmount(p.amount), 0);
    const adSpendKz = +(metaAds.spendUSD * usdToKz).toFixed(0);
    const netAfterAdsKz = +(totalRevenue - adSpendKz).toFixed(0);
    const roas = metaAds.spendUSD > 0 ? +(totalRevenue / usdToKz / metaAds.spendUSD).toFixed(2) : null;
    const lyricsReadyCount = requests.filter((r) => ["lyrics_ready", "payment_submitted", "approved", "delivered"].includes(r.status)).length;
    const paymentSubmittedCount = requests.filter((r) => ["payment_submitted", "approved", "delivered"].includes(r.status)).length;
    const completedCount = requests.filter((r) => ["approved", "delivered"].includes(r.status)).length;
    const failedCount = requests.filter((r) => r.status === "failed").length;
    const funnel = {
      totalRequests,
      lyricsReady: lyricsReadyCount,
      paymentSubmitted: paymentSubmittedCount,
      completed: completedCount,
      failed: failedCount,
      step1To2Pct: totalRequests > 0 ? Number((lyricsReadyCount / totalRequests * 100).toFixed(1)) : 0,
      step2To3Pct: lyricsReadyCount > 0 ? Number((paymentSubmittedCount / lyricsReadyCount * 100).toFixed(1)) : 0,
      step3To4Pct: paymentSubmittedCount > 0 ? Number((completedCount / paymentSubmittedCount * 100).toFixed(1)) : 0,
      overallConversionPct: Number(conversionRate)
    };
    res.json({
      totalRequests,
      paidRequests,
      conversionRate: `${conversionRate}%`,
      avgApprovalHours,
      popularStyles,
      revenueByMonth,
      revenueByPlan,
      pendingCount,
      totalRevenue,
      funnel,
      metaAds: {
        ...metaAds,
        spendKz: adSpendKz,
        netAfterAdsKz,
        roas
      }
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/profitability", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { ENV: ENV2 } = await Promise.resolve().then(() => (init_env(), env_exports));
    const sunoCostPerCreditUSD = ENV2.SUNO_COST_PER_CREDIT_USD;
    const deepseekCostPerGenUSD = Number(process.env.DEEPSEEK_COST_PER_GENERATION_USD) || 5e-4;
    const claudeCostPerGenUSD = ENV2.CLAUDE_COST_PER_GENERATION_USD;
    const monthlyFixedUSD = ENV2.MONTHLY_FIXED_COST_USD;
    const usdToKz = ENV2.USD_TO_KZ_RATE;
    const [paymentsRes, songsRes] = await Promise.all([
      supabase.from("payments").select("amount, plan, created_at, approved_at").eq("status", "approved"),
      supabase.from("songs").select("id, created_at, request_id", { count: "exact" }).not("lyrics", "is", null)
    ]);
    const approvedPayments = paymentsRes.data || [];
    const songsGenerated = songsRes.data || [];
    const songCount = songsGenerated.length;
    const totalRevenueKz = approvedPayments.reduce((sum, p) => {
      return sum + parseMoneyAmount(p.amount);
    }, 0);
    const totalRevenueUSD = +(totalRevenueKz / usdToKz).toFixed(2);
    const firstActivityAt = [...approvedPayments.map((p) => p.created_at), ...songsGenerated.map((s) => s.created_at)].filter(Boolean).sort()[0];
    const since = firstActivityAt ? isoDateOnly(new Date(firstActivityAt)) : isoDateOnly(/* @__PURE__ */ new Date());
    const until = isoDateOnly(/* @__PURE__ */ new Date());
    const metaAds = await getMetaAdsSpend({ since, until });
    const metaAdsCostUSD = metaAds.ok ? metaAds.spendUSD : 0;
    const revenueByPlanBreakdown = {};
    approvedPayments.forEach((p) => {
      const plan = p.plan || "standard";
      revenueByPlanBreakdown[plan] = (revenueByPlanBreakdown[plan] || 0) + parseMoneyAmount(p.amount) / usdToKz;
    });
    const CREDITS_PER_SONG = 24;
    const sunoCreditsUsed = songCount * CREDITS_PER_SONG;
    const sunoCostUSD = +(sunoCreditsUsed * sunoCostPerCreditUSD).toFixed(2);
    const deepseekCostUSD = +(songCount * deepseekCostPerGenUSD).toFixed(2);
    const claudeCostUSD = +(songCount * claudeCostPerGenUSD).toFixed(2);
    const lyricCostUSD = Math.min(deepseekCostUSD, claudeCostUSD);
    const totalAPIcostUSD = +(sunoCostUSD + lyricCostUSD).toFixed(2);
    const totalCostsUSD = +(totalAPIcostUSD + monthlyFixedUSD + metaAdsCostUSD).toFixed(2);
    const apiCostPerSong = totalAPIcostUSD / Math.max(songCount, 1);
    const netProfitUSD = +(totalRevenueUSD - totalCostsUSD).toFixed(2);
    const profitMargin = totalRevenueUSD > 0 ? (netProfitUSD / totalRevenueUSD * 100).toFixed(1) : "0.0";
    const costPerSong = {
      suno: +(sunoCostPerCreditUSD * CREDITS_PER_SONG).toFixed(2),
      deepseek: +deepseekCostPerGenUSD.toFixed(4),
      claude: +claudeCostPerGenUSD.toFixed(2),
      total: +(sunoCostPerCreditUSD * CREDITS_PER_SONG + Math.min(deepseekCostPerGenUSD, claudeCostPerGenUSD)).toFixed(4)
    };
    const paymentsWithPlanCount = await supabase.from("payments").select("plan, request_id").eq("status", "approved").not("request_id", "is", null);
    const planCount = {};
    if (paymentsWithPlanCount.data) {
      paymentsWithPlanCount.data.forEach((p) => {
        const pl = p.plan || "standard";
        planCount[pl] = (planCount[pl] || 0) + 1;
      });
    }
    const totalPlanCount = Object.values(planCount).reduce((a, b) => a + b, 0);
    const planDetails = Object.entries(revenueByPlanBreakdown).map(([plan, rev]) => {
      const count = planCount[plan] || 0;
      const share = totalPlanCount > 0 ? count / totalPlanCount : 0;
      const cost = +((totalAPIcostUSD + metaAdsCostUSD) * share).toFixed(2);
      return {
        plan,
        revenueUSD: +rev.toFixed(2),
        costUSD: cost,
        profitUSD: +(rev - cost).toFixed(2),
        songCount: count
      };
    });
    res.json({
      summary: {
        totalRevenueUSD,
        totalCostsUSD,
        netProfitUSD,
        margin: `${profitMargin}%`,
        songCount
      },
      costs: {
        sunoUSD: sunoCostUSD,
        deepseekUSD: deepseekCostUSD,
        claudeUSD: claudeCostUSD,
        lyricUSD: +lyricCostUSD.toFixed(2),
        metaAdsUSD: +metaAdsCostUSD.toFixed(2),
        totalUSD: totalAPIcostUSD,
        fixedUSD: monthlyFixedUSD,
        costPerSong
      },
      metaAds,
      byPlan: planDetails
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/export/:type", adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    let rows = [];
    let headers = [];
    const MAX_EXPORT_ROWS = 5e3;
    if (type === "requests") {
      const { data } = await supabase.from("song_requests").select("*, users(name, email)").order("created_at", { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ["ID", "Criado em", "Cliente", "Email", "Destinat\xE1rio", "Rela\xE7\xE3o", "Ocasi\xE3o", "Estilo", "Status"];
        rows = data.map((r) => ({
          ID: r.id,
          "Criado em": r.created_at,
          Cliente: r.users?.name || "",
          Email: r.users?.email || "",
          Destinat\u00E1rio: r.recipient_name,
          Rela\u00E7\u00E3o: r.relationship,
          Ocasi\u00E3o: r.occasion,
          Estilo: r.music_style,
          Status: r.status
        }));
      }
    } else if (type === "payments") {
      const { data } = await supabase.from("payments").select("*, song_requests(recipient_name)").order("created_at", { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ["ID", "Criado em", "Email", "Plano", "Valor", "Status", "Destinat\xE1rio", "Notas"];
        rows = data.map((p) => ({
          ID: p.id,
          "Criado em": p.created_at,
          Email: p.user_email,
          Plano: p.plan,
          Valor: p.amount,
          Status: p.status,
          Destinat\u00E1rio: p.song_requests?.recipient_name || "",
          Notas: p.notes || ""
        }));
      }
    } else if (type === "clients") {
      const { data } = await supabase.from("users").select("*, song_requests(id)").order("created_at", { ascending: false }).limit(MAX_EXPORT_ROWS);
      if (data) {
        headers = ["ID", "Nome", "Email", "Telefone", "Criado em", "Total Pedidos"];
        rows = data.map((u) => ({
          ID: u.id,
          Nome: u.name || "",
          Email: u.email || "",
          Telefone: u.phone || "",
          "Criado em": u.created_at || "",
          "Total Pedidos": u.song_requests?.length || 0
        }));
      }
    } else {
      return res.status(400).json({ success: false, error: "Tipo inv\xE1lido. Use: requests, payments, clients" });
    }
    const csvHeader = headers.join(",");
    const csvRows = rows.map((row) => headers.map((h) => {
      const val = String(row[h] || "").replace(/"/g, '""');
      return `"${val}"`;
    }).join(","));
    const csv = [csvHeader, ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${type}_${Date.now()}.csv"`);
    res.send("\uFEFF" + csv);
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.delete("/request/:id", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: requestData, error: fetchError } = await supabase.from("song_requests").select("*, songs(*), payments(*)").eq("id", id).single();
    if (fetchError || !requestData) {
      return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado." });
    }
    const storageDeletions = {
      "photos": [],
      "voice-samples": [],
      "full-audio": [],
      "preview": [],
      "payment-proofs": []
    };
    if (requestData.photo_url) {
      const path6 = extractStoragePath(requestData.photo_url, "photos");
      if (path6) storageDeletions["photos"].push(path6);
    }
    if (requestData.voice_sample_url) {
      const path6 = requestData.voice_sample_url.startsWith("http") ? extractStoragePath(requestData.voice_sample_url, "voice-samples") : requestData.voice_sample_url;
      if (path6) storageDeletions["voice-samples"].push(path6);
    }
    const songs = Array.isArray(requestData.songs) ? requestData.songs : requestData.songs ? [requestData.songs] : [];
    for (const song of songs) {
      if (song.audio_url) {
        const path6 = extractStoragePath(song.audio_url, "full-audio");
        if (path6) storageDeletions["full-audio"].push(path6);
      }
      if (song.full_song_url) {
        const path6 = extractStoragePath(song.full_song_url, "full-audio");
        if (path6) storageDeletions["full-audio"].push(path6);
      }
      if (song.preview_url) {
        const path6 = extractStoragePath(song.preview_url, "preview");
        if (path6) storageDeletions["preview"].push(path6);
      }
    }
    const payments = Array.isArray(requestData.payments) ? requestData.payments : requestData.payments ? [requestData.payments] : [];
    for (const payment of payments) {
      if (payment.proof_path) {
        storageDeletions["payment-proofs"].push(payment.proof_path);
      } else if (payment.proof_url) {
        const path6 = payment.proof_url.startsWith("storage:") ? payment.proof_url.replace(/^storage:/, "") : extractStoragePath(payment.proof_url, "payment-proofs");
        if (path6) storageDeletions["payment-proofs"].push(path6);
      }
    }
    Promise.all(
      Object.entries(storageDeletions).map(async ([bucket, paths]) => {
        const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
        if (uniquePaths.length === 0) return;
        try {
          await deleteStorageFiles(bucket, uniquePaths);
          logInfo(`[Admin Delete] Ficheiros removidos do bucket "${bucket}" com sucesso`, { paths: uniquePaths });
        } catch (err) {
          logWarn(`[Admin Delete] Excep\xE7\xE3o ao remover do bucket "${bucket}"`, { error: err instanceof Error ? err.message : String(err) });
        }
      })
    ).catch((err) => logError("[Admin Delete] Erro cr\xEDtico no cleanup de storage", err));
    const { error: deleteError } = await supabase.from("song_requests").delete().eq("id", id);
    if (deleteError) {
      return res.status(500).json({ success: false, error: `Falha ao apagar pedido: ${deleteError.message}` });
    }
    logAdminAction({
      action: "delete",
      entityType: "song_requests",
      entityId: id,
      previousData: {
        recipient_name: requestData.recipient_name,
        email: requestData.users?.email,
        status: requestData.status
      },
      notes: "Pedido e todos os ficheiros de Storage associados eliminados permanentemente."
    });
    res.json({ success: true, message: "Pedido e ficheiros associados apagados com sucesso." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/utm-stats", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data, error } = await supabase.from("song_requests").select("utm_campaign, utm_source, utm_medium, utm_term, utm_content, status, payments(amount)").not("utm_campaign", "is", null).neq("utm_campaign", "");
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    const campaignMap = /* @__PURE__ */ new Map();
    for (const row of data || []) {
      const key = row.utm_campaign || "Sem nome";
      const existing = campaignMap.get(key) || {
        campaign: key,
        source: row.utm_source || "\u2014",
        medium: row.utm_medium || "\u2014",
        total_requests: 0,
        converted: 0,
        delivered: 0,
        revenue: 0
      };
      existing.total_requests++;
      if (row.status === "approved" || row.status === "delivered") {
        existing.converted++;
        const paymentArr = row.payments;
        const amount = parseMoneyAmount(paymentArr?.[0]?.amount);
        if (!isNaN(amount)) existing.revenue += amount;
      }
      if (row.status === "delivered") existing.delivered++;
      campaignMap.set(key, existing);
    }
    const campaigns = Array.from(campaignMap.values()).sort((a, b) => b.total_requests - a.total_requests);
    res.json({ success: true, data: campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar estat\xEDsticas UTM";
    res.status(500).json({ success: false, error: message });
  }
});
router.get("/abandoned", adminAuth, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { range } = req.query;
    let rangeFilter = null;
    if (range !== void 0 && range !== "" && range !== "all") {
      if (!isAbandonedTimeRange(range)) {
        return res.status(400).json({ success: false, error: "Filtro de tempo inv\xE1lido." });
      }
      const matchRange = range;
      rangeFilter = (elapsedMs) => elapsedInRange(elapsedMs, matchRange);
    }
    const { data, error } = await supabase.from("song_requests").select(
      "id, email, phone, recipient_name, created_at, status, abandoned_30min_sent_at, abandoned_24h_sent_at, abandoned_48h_sent_at, abandoned_72h_sent_at, abandoned_7d_sent_at, whatsapp_30min_sent_at, whatsapp_24h_sent_at, whatsapp_48h_sent_at, whatsapp_72h_sent_at, manual_contacted_at, users(name, phone)"
    ).in("status", ["lyrics_ready", "lyrics_generating"]).is("deleted_at", null).not("email", "is", null).order("created_at", { ascending: false });
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    const requestIds = (data || []).map((r) => r.id);
    const { data: sendLogs } = requestIds.length > 0 ? await supabase.from("whatsapp_send_log").select("request_id, status, template_name, created_at").in("request_id", requestIds).order("created_at", { ascending: false }) : { data: [] };
    const logsByRequest = {};
    for (const log of sendLogs || []) {
      if (!logsByRequest[log.request_id]) logsByRequest[log.request_id] = [];
      logsByRequest[log.request_id].push({ status: log.status, template: log.template_name || "", at: log.created_at });
    }
    const appUrl = getAppUrl(req);
    const now = Date.now();
    const bucketMap = {};
    for (const key of ABANDONED_BUCKET_ORDER) {
      bucketMap[key] = { key, label: bucketLabel(key), clients: [] };
    }
    for (const row of data || []) {
      const elapsedMs = now - new Date(row.created_at).getTime();
      const bucket = bucketForElapsed(elapsedMs);
      if (!bucket) continue;
      if (rangeFilter && !rangeFilter(elapsedMs)) continue;
      const phoneRaw = row.phone || row.users?.[0]?.phone;
      const resumePath = `/wizard?resume=${row.id}&step=payment`;
      const client = {
        id: row.id,
        recipientName: row.recipient_name || "",
        email: row.email,
        phone: phoneRaw || "",
        waDigits: normalizePhoneToE164(phoneRaw),
        status: row.status,
        createdAt: row.created_at,
        elapsedMs,
        reminders: [
          row.abandoned_30min_sent_at ? "30min" : null,
          row.abandoned_24h_sent_at ? "24h" : null,
          row.abandoned_48h_sent_at ? "48h" : null,
          row.abandoned_72h_sent_at ? "72h" : null,
          row.abandoned_7d_sent_at ? "7d" : null
        ].filter((r) => Boolean(r)),
        whatsappSent: [
          row.whatsapp_30min_sent_at ? "30min" : null,
          row.whatsapp_24h_sent_at ? "24h" : null,
          row.whatsapp_48h_sent_at ? "48h" : null,
          row.whatsapp_72h_sent_at ? "72h" : null
        ].filter((r) => Boolean(r)),
        manualContactedAt: row.manual_contacted_at,
        whatsappLogs: logsByRequest[row.id] || [],
        message: buildAbandonedMessage(bucket, row.recipient_name || "", `${appUrl}${resumePath}`),
        resumePath
      };
      bucketMap[bucket].clients.push(client);
    }
    const buckets = ABANDONED_BUCKET_ORDER.map((key) => bucketMap[key]).filter((b) => b.clients.length > 0);
    const bucketedRows = (data || []).filter((row) => {
      const elapsedMs = now - new Date(row.created_at).getTime();
      if (bucketForElapsed(elapsedMs) === null) return false;
      if (rangeFilter && !rangeFilter(elapsedMs)) return false;
      return true;
    });
    let linked = false;
    let waPhone = null;
    let codeVerificationStatus = null;
    try {
      const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
      const st = await wa.getLinkStatus();
      linked = !!st.linked;
      waPhone = typeof st.phone === "string" ? st.phone : null;
      codeVerificationStatus = wa.getCachedVerificationStatus() || (await wa.getPhoneNumberVerificationStatus()).status || null;
    } catch {
      linked = false;
    }
    res.json({
      success: true,
      buckets,
      total: bucketedRows.length,
      notContacted: bucketedRows.filter((r) => !r.manual_contacted_at).length,
      linked,
      phone: waPhone,
      codeVerificationStatus
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/abandoned/send-status", adminAuth, async (req, res) => {
  try {
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    res.json({ success: true, progress: wa.getSendProgress() });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/abandoned/:id/mark-contacted", adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { error } = await supabase.from("song_requests").update({ manual_contacted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id);
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    res.json({ success: true });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/whatsapp/config-status", adminAuth, async (req, res) => {
  try {
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    const status2 = await wa.getConfigStatus();
    res.json({ success: true, ...status2 });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/whatsapp/test-send", adminAuth, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Indica o n\xFAmero de destino para o teste (campo "phone").' });
    }
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    if (!wa.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente."
      });
    }
    const { normalizePhoneToE164: normalize } = await Promise.resolve().then(() => (init_abandonedMessages(), abandonedMessages_exports));
    const normalized = normalize(phone.trim());
    if (!normalized) {
      return res.status(400).json({ success: false, error: `N\xFAmero inv\xE1lido: "${phone}". Usa formato E.164 (ex: +244922058136).` });
    }
    const { templateForBucket: tpl } = await Promise.resolve().then(() => (init_whatsappTemplates(), whatsappTemplates_exports));
    const testTemplate = tpl("30min")?.name || "hello_world";
    logInfo("[WhatsApp] Envio de teste iniciado", { phone: normalized, template: testTemplate });
    const result = await wa.sendTemplate(normalized, testTemplate, ["Teste", "https://seubeat.com"]);
    if (result.ok) {
      logInfo("[WhatsApp] Teste de envio bem-sucedido", { phone: normalized, messageId: result.messageId });
      return res.json({ success: true, messageId: result.messageId, phone: normalized, template: testTemplate });
    } else {
      logWarn("[WhatsApp] Teste de envio falhou", { phone: normalized, error: result.error, code: result.code });
      return res.status(422).json({ success: false, error: result.error, code: result.code, phone: normalized });
    }
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.get("/whatsapp/verification-status", adminAuth, async (req, res) => {
  try {
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: "WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente." });
    }
    const info = await wa.getPhoneNumberVerificationStatus();
    res.json({ success: true, ...info, cached: wa.getCachedVerificationStatus() });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/whatsapp/request-code", adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { method, language } = req.body || {};
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: "WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente." });
    }
    const m = method === "VOICE" ? "VOICE" : "SMS";
    const lang = typeof language === "string" && language ? language : "en_US";
    const result = await wa.requestVerificationCode(m, lang);
    if (!result.ok) return res.status(422).json({ success: false, error: result.error, metaCode: result.metaCode, metaRaw: result.metaRaw });
    logInfo("[WhatsApp] C\xF3digo de verifica\xE7\xE3o pedido pelo admin", { method: m, language: lang });
    res.json({ success: true, method: m, language: lang });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/whatsapp/verify-code", adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Indica o c\xF3digo de verifica\xE7\xE3o recebido (campo "code").' });
    }
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    if (!wa.isConfigured()) {
      return res.status(400).json({ success: false, error: "WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente." });
    }
    const result = await wa.submitVerificationCode(code.trim());
    if (!result.ok) return res.status(422).json({ success: false, error: result.error });
    const info = await wa.getPhoneNumberVerificationStatus();
    logInfo("[WhatsApp] C\xF3digo de verifica\xE7\xE3o confirmado pelo admin", { codeVerificationStatus: info.status });
    res.json({ success: true, codeVerificationStatus: info.status });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
router.post("/abandoned/send-bulk", adminAuth, whatsappBulkLimiter, async (req, res) => {
  try {
    const { requestIds } = req.body || {};
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    let query = supabase.from("song_requests").select("id, phone, recipient_name, created_at, email, users(phone)").in("status", ["lyrics_ready", "lyrics_generating"]).is("deleted_at", null).not("email", "is", null).order("created_at", { ascending: false });
    if (Array.isArray(requestIds) && requestIds.length > 0) {
      const ids = requestIds.map((id) => String(id)).filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
      if (!ids.length) return res.status(400).json({ success: false, error: "IDs inv\xE1lidos." });
      query = query.in("id", ids);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ success: false, error: safeMessage(error) });
    const appUrl = getAppUrl(req);
    const now = Date.now();
    const clients = [];
    for (const row of data || []) {
      const phone = normalizePhoneToE164(row.phone || row.users?.[0]?.phone);
      if (!phone) continue;
      const bucket = bucketForElapsed(now - new Date(row.created_at).getTime());
      if (!bucket) continue;
      if (!enabledWhatsAppBuckets().includes(bucket)) continue;
      clients.push({
        requestId: row.id,
        phone,
        bucket,
        templateName: templateForBucket(bucket)?.name || "",
        params: [row.recipient_name || "", `${appUrl}/wizard?resume=${row.id}&step=payment`],
        message: buildAbandonedMessage(bucket, row.recipient_name || "", `${appUrl}/wizard?resume=${row.id}&step=payment`)
      });
    }
    if (!clients.length) {
      return res.status(400).json({ success: false, error: "Nenhum cliente com telefone v\xE1lido para enviar." });
    }
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    if (wa.getSendProgress().running) {
      return res.status(409).json({ success: false, error: "J\xE1 existe um envio em curso." });
    }
    const linkStatus = await wa.getLinkStatus();
    if (!linkStatus.linked) {
      return res.status(400).json({ success: false, error: "WhatsApp API n\xE3o configurada. Define WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente." });
    }
    void wa.runSendBulk(clients).catch((err) => {
      logError("[WhatsApp] Erro ao iniciar campanha", err instanceof Error ? err : new Error(String(err)));
    });
    res.json({ success: true, started: true, total: clients.length });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
async function sendVideoUpsellOffer(requestId, songRequest, req) {
  try {
    if (songRequest.video_upsell_sent_at) return;
    const supabase = getAdminSupabase();
    if (!supabase) return;
    let songTitle = "a tua m\xFAsica";
    try {
      const { data: songData } = await supabase.from("songs").select("title").eq("request_id", requestId).single();
      if (songData?.title) songTitle = songData.title;
    } catch {
    }
    const upsellUrl = `${getAppUrl(req)}/video-upsell?requestId=${requestId}&email=${encodeURIComponent(songRequest.user_email || "")}`;
    try {
      await supabase.from("song_requests").update({ video_upsell_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId);
    } catch {
    }
    const phone = songRequest.phone || songRequest.users?.phone || null;
    if (phone) {
      sendVideoUpsellWhatsApp({
        requestId,
        phone,
        recipientName: songRequest.recipient_name,
        songTitle
      }).catch((err) => logError("[Admin] Falha ao enviar offer de videoclipe (WhatsApp)", err, { requestId }));
    }
    if (songRequest.user_email) {
      sendVideoUpsellOfferEmail(songRequest.user_email, songRequest.recipient_name || "", songTitle, upsellUrl).catch((err) => logError("[Admin] Falha ao enviar offer de videoclipe (email)", err, { requestId }));
    }
    logInfo("[Admin] Video upsell offer enviada", { requestId, phone: !!phone, email: !!songRequest.user_email });
  } catch (err) {
    logError("[Admin] Falha ao enviar offer de videoclipe", err, { requestId });
  }
}
router.post("/recover-audio", adminAuth, async (req, res) => {
  const { requestId, taskId } = req.body || {};
  try {
    if (!requestId || !taskId) {
      return res.status(400).json({ success: false, error: "requestId e taskId obrigat\xF3rios" });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "DB n\xE3o dispon\xEDvel" });
    const { data: song, error: songErr } = await supabase.from("songs").select("id, request_id, mureka_status").eq("request_id", requestId).single();
    if (songErr || !song) return res.status(404).json({ success: false, error: "Song n\xE3o encontrada" });
    logInfo("[Admin] recover-audio: a consultar Suno", { requestId, taskId });
    const sunoResult = await querySunoTask(taskId);
    if (!sunoResult.audioUrl) {
      return res.status(400).json({ success: false, error: `Suno n\xE3o tem \xE1udio pronto. Status: ${sunoResult.status}` });
    }
    logInfo("[Admin] recover-audio: \xE1udio encontrado no Suno", { requestId, taskId, audioUrl: sunoResult.audioUrl.slice(0, 80), hasV2: !!sunoResult.audioUrlV2 });
    const persistResult = await persistGeneratedSunoAudio(song.id, taskId, sunoResult.audioUrl, { skipProcessing: false });
    let fullAudioUrlV2 = null;
    let durationV2 = null;
    if (sunoResult.audioUrlV2) {
      try {
        logInfo("[Admin] recover-audio: a processar v2", { requestId, taskId });
        const persistV2 = await persistGeneratedSunoAudio(`${song.id}_v2`, taskId, sunoResult.audioUrlV2, { skipProcessing: false });
        fullAudioUrlV2 = persistV2.fullAudioUrl;
        durationV2 = persistV2.duration;
        logInfo("[Admin] recover-audio: v2 conclu\xEDdo", { requestId, durationV2 });
      } catch (v2Err) {
        logWarn("[Admin] recover-audio: falha no v2 (v1 mantido)", v2Err);
      }
    }
    await supabase.from("songs").update({
      audio_url: persistResult.fullAudioUrl,
      audio_url_v2: fullAudioUrlV2,
      full_song_url: persistResult.fullAudioUrl,
      mureka_task_id: taskId,
      mureka_status: "completed",
      duration: persistResult.duration,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", song.id);
    const { error: reqUpdateErr } = await supabase.from("song_requests").update({
      status: "approved",
      deliver_at: null,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", requestId).eq("status", "failed");
    if (reqUpdateErr) {
      logWarn("[Admin] recover-audio: falha ao atualizar request status", reqUpdateErr);
    }
    logInfo("[Admin] recover-audio: sucesso", { requestId, taskId, duration: persistResult.duration, durationV2 });
    res.json({ success: true, data: { fullAudioUrl: persistResult.fullAudioUrl, fullAudioUrlV2, duration: persistResult.duration, durationV2 } });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : "";
    logError("[Admin] recover-audio ERRO", err instanceof Error ? err : new Error(errMsg), { requestId, taskId });
    res.status(500).json({ success: false, error: safeMessage(err) });
  }
});
var admin_default = router;

// server/routes/public.ts
init_supabase();
init_storage();
import express2 from "express";
import multer from "multer";
import { randomUUID as randomUUID2, createHash } from "node:crypto";
import fs8 from "fs";
import os3 from "os";
import path5 from "path";
init_ai();
init_email();
init_whatsapp();
init_metaPixelCapi();
init_metaPixelCapi();
init_helpers();

// server/utils/aiFailure.ts
var LYRIC_GENERATION_QUEUED_MESSAGE = "O servi\xE7o de gera\xE7\xE3o est\xE1 temporariamente sobrecarregado. Guard\xE1mos o teu pedido \u2014 vamos gerar a tua m\xFAsica automaticamente e avisamos por email.";
function allFailuresTransient(failures) {
  return Array.isArray(failures) && failures.length > 0 && failures.every((f) => f && typeof f === "object" && f.kind === "transient");
}

// server/shared/validation.ts
import { z } from "zod";
function lower(val) {
  return typeof val === "string" ? val.toLowerCase() : val;
}
var RECIPIENT_RELATIONS = [
  "m\xE3e",
  "pai",
  "av\xF3",
  "av\xF4",
  "filho",
  "filha",
  "irm\xE3",
  "irm\xE3o",
  "c\xF4njuge",
  "marido",
  "esposa",
  "namorada",
  "namorado",
  "parceira",
  "parceiro",
  "melhor amiga",
  "melhor amigo",
  "amiga",
  "amigo",
  "colega",
  "chefe",
  "professor",
  "professora",
  "pastor",
  "pastora",
  "mestre",
  "outro",
  "ex-namorado",
  "av\xF3-av\xF4",
  "para-mim"
];
var OCCASIONS = [
  "anivers\xE1rio",
  "casamento",
  "homenagem",
  "memorial",
  "saudade",
  "pedido de desculpas",
  "declara\xE7\xE3o",
  "formatura",
  "promo\xE7\xE3o",
  "nova casa",
  "nascimento",
  "recupera\xE7\xE3o",
  "despedida",
  "anivers\xE1rio de namoro",
  "agradecimento",
  "sem motivo"
];
var MUSIC_STYLES = [
  "kizomba",
  "semba",
  "afrobeat",
  "gospel",
  "acoustic",
  "romantic pop",
  "zouk",
  "balada",
  "pop",
  "r&b",
  "rap",
  "funk",
  "trap",
  "reggae",
  "samba",
  "hino"
];
var GENDERS = [
  "masculino",
  "feminino"
];
var VOICE_TYPES = [
  "masculina",
  "feminina",
  "dueto",
  "sem prefer\xEAncia"
];
var GenerateLyricsSchema = z.object({
  userNick: z.string().max(50, "Nome muito longo").trim().optional(),
  email: z.preprocess(
    (v) => v === "" ? void 0 : v,
    z.string().email("Email inv\xE1lido").toLowerCase().optional()
  ),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, "Telefone inv\xE1lido"),
  recipientName: z.string().min(1, "Nome do destinat\xE1rio requerido").max(100).trim(),
  recipientGender: z.preprocess(lower, z.enum(GENDERS).catch("feminino")),
  recipientRelation: z.preprocess(lower, z.enum(RECIPIENT_RELATIONS).catch("outro")),
  recipientNick: z.string().max(50).trim().optional(),
  occasion: z.preprocess(lower, z.enum(OCCASIONS).catch("declara\xE7\xE3o")),
  whyCreatedToday: z.string().max(500).trim().optional(),
  musicStyle: z.preprocess(lower, z.enum(MUSIC_STYLES).catch("kizomba")),
  referenceArtist: z.string().max(100).trim().optional(),
  voiceType: z.preprocess(lower, z.enum(VOICE_TYPES).catch("sem prefer\xEAncia")),
  whatMakesSpecial: z.string().max(4e3).trim().optional(),
  onlySheDoes: z.string().max(1e3).trim().optional(),
  unforgettableMemory: z.string().max(4e3).trim().optional(),
  whereItHappened: z.string().max(1e3).trim().optional(),
  messageFromTheHeart: z.string().max(4e3).trim().optional(),
  hookPhrase: z.string().max(200).trim().optional(),
  desiredEmotion: z.preprocess(
    (v) => !v || typeof v !== "string" || v.trim() === "" ? void 0 : v.toLowerCase(),
    z.string().max(50).optional()
  ),
  language: z.preprocess(
    (v) => !v || typeof v !== "string" || v.trim() === "" ? "portugu\xEAs" : v.toLowerCase(),
    z.string().max(50)
  ).default("portugu\xEAs"),
  photoBase64: z.string().max(10 * 1024 * 1024, "Foto muito grande (max 10MB)").optional().nullable(),
  photoFilename: z.string().max(255).trim().optional().nullable(),
  photoMimeType: z.string().max(50).trim().optional().nullable(),
  utm_source: z.string().max(500).trim().optional().nullable(),
  utm_medium: z.string().max(500).trim().optional().nullable(),
  utm_campaign: z.string().max(500).trim().optional().nullable(),
  utm_term: z.string().max(500).trim().optional().nullable(),
  utm_content: z.string().max(500).trim().optional().nullable()
});
var lyricsStringOrArray = z.union([
  z.string().min(10, "A letra deve ter pelo menos 10 caracteres").max(5e3, "Letra muito longa").trim(),
  z.array(z.string()).min(1, "A letra deve ter pelo menos uma linha").max(200, "Letra muito longa")
]);
var UpdateLyricsSchema = z.object({
  lyrics: lyricsStringOrArray,
  lyrics_snippet: z.string().max(500).trim().optional()
});
function validationErrorsArray(errors) {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}
function validateInput(schema, data) {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = {};
      error.issues.forEach((err) => {
        const path6 = err.path.join(".");
        errors[path6] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { general: "Erro de valida\xE7\xE3o desconhecido" } };
  }
}
var SubmitPaymentSchema = z.object({
  songRequestId: z.string().min(1, "ID do pedido requerido"),
  userEmail: z.string().email("Email inv\xE1lido").toLowerCase(),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, "Telefone inv\xE1lido").optional(),
  plan: z.enum(["standard", "express", "premium"]),
  amount: z.union([z.number(), z.string()]).transform((v) => {
    if (typeof v === "number") return v;
    const cleaned = v.replace(/[^\d.,]/g, "");
    if (cleaned.includes(",")) {
      return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return Number(cleaned.replace(/\./g, "")) || 0;
  }).refine((v) => !isNaN(v) && v > 0, "Montante inv\xE1lido"),
  proofBase64: z.string().max(14 * 1024 * 1024, "Comprovativo demasiado grande (max 10MB)").optional().nullable(),
  proofFilename: z.string().max(255).trim().optional().nullable(),
  proofMimeType: z.string().max(100).trim().optional().nullable(),
  voiceSampleBase64: z.string().max(5 * 1024 * 1024, "Amostra de voz demasiado grande (max 5MB)").optional().nullable(),
  voiceSampleFilename: z.string().max(255).trim().optional().nullable(),
  voiceSampleMimeType: z.enum(["audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm"]).optional().nullable(),
  voiceFreeSampleBase64: z.string().max(5 * 1024 * 1024, "Amostra de voz livre demasiado grande (max 5MB)").optional().nullable(),
  voiceFreeSampleFilename: z.string().max(255).trim().optional().nullable(),
  voiceFreeSampleMimeType: z.enum(["audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm"]).optional().nullable(),
  voiceValidationTaskId: z.string().trim().optional().nullable(),
  voiceValidationPhrase: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(["express", "reference"]).optional().nullable().default("reference"),
  eventIds: z.object({
    initiateCheckout: z.string().optional(),
    addPaymentInfo: z.string().optional(),
    submitApplication: z.string().optional()
  }).optional().nullable(),
  // Identificadores Meta capturados no browser (cookie _fbp / parâmetro fbclid).
  // Encaminhados para a CAPI sem hash — melhoram o match browser↔servidor.
  fbp: z.string().max(200).regex(/^fb\.\d\./, "fbp inv\xE1lido").optional().nullable(),
  fbc: z.string().max(300).regex(/^fb\.\d\./, "fbc inv\xE1lido").optional().nullable()
});
var VoiceValidationPhraseSchema = z.object({
  voiceSampleBase64: z.string().max(5 * 1024 * 1024, "Amostra de voz demasiado grande (max 5MB)"),
  voiceSampleMimeType: z.enum(["audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm"]).optional().nullable().default("audio/wav"),
  language: z.string().optional().nullable().default("portugu\xEAs")
});
var VideoUpsellPaymentSchema = z.object({
  songRequestId: z.string().min(1, "ID do pedido requerido"),
  userEmail: z.string().email("Email inv\xE1lido").toLowerCase(),
  proofBase64: z.string().max(14 * 1024 * 1024, "Comprovativo demasiado grande (max 10MB)").optional().nullable(),
  proofFilename: z.string().max(255).trim().optional().nullable(),
  proofMimeType: z.string().max(100).trim().optional().nullable(),
  paymentMethod: z.enum(["express", "reference"]).optional().nullable().default("reference")
});

// server/routes/public.ts
init_logger();
var dompurifyModule = null;
async function sanitize(str) {
  if (!dompurifyModule) dompurifyModule = await import("isomorphic-dompurify");
  return dompurifyModule.default.sanitize(str.trim().slice(0, 5e3));
}
var router2 = express2.Router();
router2.use(globalLimiter);
var paymentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  // 10MB max (proof)
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/", "audio/", "application/pdf"];
    if (allowed.some((p) => file.mimetype.startsWith(p))) cb(null, true);
    else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  }
}).fields([
  { name: "proof", maxCount: 1 },
  { name: "voiceSample", maxCount: 1 },
  { name: "voiceFreeSample", maxCount: 1 }
]);
function safeMessage2(err) {
  return publicErrorMessage(err);
}
function isSchemaCacheError(msg) {
  return /column.*schema cache|column.*proof_hash|column.*transaction_id|column.*ai_verified|column.*verification_result/i.test(msg);
}
function stripSchemaCacheFields(fields) {
  const { proof_hash: _ph, transaction_id: _ti, ai_verified: _av, verification_result: _vr, ...rest } = fields;
  return rest;
}
async function markRequestFailed(requestId, err) {
  try {
    await updateRequestStatus(requestId, "failed", err);
  } catch (statusErr) {
    logError("[API] Falha ao marcar pedido como failed.", statusErr instanceof Error ? statusErr : new Error(String(statusErr)), {
      requestId,
      error: safeMessage2(statusErr)
    });
  }
}
function decodeBase64Payload(base64) {
  return Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
}
function parseAngolanAmount(value) {
  const cleaned = value.replace(/[^\d.,]/g, "");
  if (cleaned.includes(",")) {
    return Number(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(cleaned.replace(/\./g, "")) || 0;
}
var DEDUPE_WINDOW_MS = 10 * 60 * 1e3;
async function lyricsRequestFingerprint(values) {
  const normalized = [
    values.recipientName || "Destinatario",
    values.recipientGender || null,
    values.recipientNick || null,
    values.recipientRelation || "Parceiro",
    values.hookPhrase || null,
    values.occasion || "Homenagem",
    values.musicStyle || "Kizomba",
    values.voiceType || "masculina",
    await sanitize(values.whatMakesSpecial || ""),
    await sanitize(values.unforgettableMemory || ""),
    await sanitize(values.messageFromTheHeart || ""),
    values.desiredEmotion || "Amor",
    values.language || "portugu\xEAs",
    values.referenceArtist || null,
    await sanitize(values.whyCreatedToday || ""),
    await sanitize(values.onlySheDoes || ""),
    await sanitize(values.whereItHappened || "")
  ];
  return JSON.stringify(normalized);
}
async function findExistingLyricsRequest(supabase, email, fingerprint) {
  const { data: existingRequests, error: existingError } = await supabase.from("song_requests").select("*").eq("email", email).eq("status", "lyrics_ready").gte("created_at", new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()).order("created_at", { ascending: false }).limit(5);
  if (existingError) {
    logError("[API] Falha ao procurar pedido existente para dedupe", existingError, { email });
    return null;
  }
  for (const req of existingRequests || []) {
    const storedFingerprint = await lyricsRequestFingerprint({
      recipientName: req.recipient_name || void 0,
      recipientGender: req.recipient_gender || void 0,
      recipientNick: req.recipient_nick || void 0,
      recipientRelation: req.relationship || void 0,
      hookPhrase: req.hook_phrase || void 0,
      occasion: req.occasion || void 0,
      musicStyle: req.music_style || void 0,
      voiceType: req.voice_type || void 0,
      whatMakesSpecial: req.special_traits || void 0,
      unforgettableMemory: req.memory || void 0,
      messageFromTheHeart: req.heart_message || void 0,
      desiredEmotion: req.desired_emotion || void 0,
      language: req.language || void 0,
      referenceArtist: req.reference_artist || void 0,
      whyCreatedToday: req.why_created_today || void 0,
      onlySheDoes: req.only_she_does || void 0,
      whereItHappened: req.where_it_happened || void 0
    });
    if (storedFingerprint !== fingerprint) continue;
    const { data: existingSong } = await supabase.from("songs").select("id, title, lyrics, lyrics_snippet, letter_text").eq("request_id", req.id).maybeSingle();
    if (existingSong?.id) {
      return { request: req, song: existingSong };
    }
  }
  return null;
}
async function dedupeLyricsRequest(req, res, next) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return next();
    const validation = validateInput(GenerateLyricsSchema, req.body);
    if (!validation.success) return next();
    const data = validation.data;
    if (!data.email) return next();
    const fingerprint = await lyricsRequestFingerprint({
      recipientName: data.recipientName || void 0,
      recipientGender: data.recipientGender || void 0,
      recipientNick: data.recipientNick || void 0,
      recipientRelation: data.recipientRelation || void 0,
      hookPhrase: data.hookPhrase || void 0,
      occasion: data.occasion || void 0,
      musicStyle: data.musicStyle || void 0,
      voiceType: data.voiceType || void 0,
      whatMakesSpecial: data.whatMakesSpecial || void 0,
      unforgettableMemory: data.unforgettableMemory || void 0,
      messageFromTheHeart: data.messageFromTheHeart || void 0,
      desiredEmotion: data.desiredEmotion || void 0,
      language: data.language || void 0,
      referenceArtist: data.referenceArtist || void 0,
      whyCreatedToday: data.whyCreatedToday || void 0,
      onlySheDoes: data.onlySheDoes || void 0,
      whereItHappened: data.whereItHappened || void 0
    });
    const existing = await findExistingLyricsRequest(supabase, data.email, fingerprint);
    if (!existing) return next();
    setProgress(existing.request.id, { status: "lyrics_ready", progress: 35, message: "Letra criada com sucesso!" });
    logInfo("Lyrics reutilizada (dedupe de retry)", {
      requestId: existing.request.id,
      songId: existing.song.id,
      email: data.email
    });
    res.json({
      success: true,
      dbSongId: existing.song.id,
      dbSongRequestId: existing.request.id,
      songTitle: existing.song.title,
      lyrics: existing.song.lyrics,
      lyricsSnippet: existing.song.lyrics_snippet,
      letterText: existing.song.letter_text,
      photoUrl: existing.request.photo_url,
      status: "lyrics_ready",
      message: "Letra criada com sucesso!"
    });
  } catch (err) {
    logError("[API] Falha no middleware de dedupe", err instanceof Error ? err : new Error(String(err)));
    next();
  }
}
async function ensureUserProfile(supabase, params) {
  const { data: existingUser, error: userLookupError } = await supabase.from("users").select("*").eq("email", params.email).maybeSingle();
  if (userLookupError) {
    logError("[API] Falha ao procurar utilizador", userLookupError);
    throw new Error("Nao foi possivel preparar o seu perfil.");
  }
  if (existingUser?.id) return existingUser;
  let userId = null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data: authData, error: authCreateError } = await supabase.auth.admin.createUser({
        email: params.email,
        password: `SeuBeat-${randomUUID2()}!`,
        email_confirm: true,
        user_metadata: { name: params.name, phone: params.phone || null, source: "seubeat_wizard" }
      });
      if (!authCreateError && authData?.user?.id) {
        userId = authData.user.id;
        const { data: triggerProfile } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
        if (triggerProfile?.id) return triggerProfile;
      } else {
        logError("[API] Auth createUser falhou, fallback para upsert direto", authCreateError);
      }
    } catch (authErr) {
      logError("[API] Excecao Auth createUser, fallback para upsert direto", authErr);
    }
  }
  if (!userId) {
    userId = randomUUID2();
  }
  const { data: newProfile, error: profileCreateError } = await supabase.from("users").upsert(
    { id: userId, name: params.name, email: params.email, phone: params.phone || null },
    { onConflict: "email" }
  ).select().single();
  if (profileCreateError || !newProfile?.id) {
    const { data: retryUser } = await supabase.from("users").select("*").eq("email", params.email).maybeSingle();
    if (retryUser?.id) return retryUser;
    logError("[API] Falha ao criar perfil", profileCreateError, {
      supabaseMessage: profileCreateError?.message,
      supabaseDetails: profileCreateError?.details,
      supabaseHint: profileCreateError?.hint,
      supabaseCode: profileCreateError?.code
    });
    throw new Error("Nao foi possivel criar o seu perfil.");
  }
  return newProfile;
}
router2.post("/suno-callback", async (req, res) => {
  logInfo("[Suno Callback] Recebido", {
    code: req.body?.code,
    msg: req.body?.msg,
    taskId: req.body?.data?.taskId || req.body?.taskId,
    callbackType: req.body?.data?.callbackType || req.body?.callbackType
  });
  res.json({ success: true });
});
router2.post("/generate-lyrics", dedupeLyricsRequest, generateLyricsLimiter, emailLimiter, async (req, res) => {
  const supabase = getAdminSupabase();
  let dbSongRequestId = null;
  let dbSongId = null;
  let photoStoragePath = null;
  try {
    const validation = validateInput(GenerateLyricsSchema, req.body);
    if ("errors" in validation) {
      logWarn("[API] /generate-lyrics dados inv\xE1lidos", {
        email: typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "unknown",
        errors: validation.errors
      });
      return res.status(400).json({
        success: false,
        error: "Dados inv\xE1lidos",
        validation_errors: validationErrorsArray(validation.errors)
      });
    }
    const {
      userNick,
      recipientName,
      recipientGender,
      recipientRelation,
      recipientNick,
      occasion,
      whyCreatedToday,
      musicStyle,
      referenceArtist,
      voiceType,
      photoBase64,
      photoFilename,
      photoMimeType,
      email,
      phone,
      unforgettableMemory,
      whatMakesSpecial,
      onlySheDoes,
      whereItHappened,
      messageFromTheHeart,
      hookPhrase,
      desiredEmotion,
      language,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content
    } = validation.data;
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Banco de dados indisponivel no momento." });
    }
    let photoUrl = null;
    if (photoBase64) {
      const buffer = decodeBase64Payload(photoBase64);
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error("A foto e demasiado grande (max 10MB). Comprima a imagem ou escolha outra.");
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
      if (photoMimeType && !allowedMimes.includes(photoMimeType)) {
        throw new Error("Formato de imagem nao suportado. Use JPG, PNG, WebP, HEIC ou GIF.");
      }
      const isHeicOrHeif = photoMimeType && ["image/heic", "image/heif"].includes(photoMimeType);
      const uploadContentType = isHeicOrHeif ? "image/jpeg" : photoMimeType || "image/jpeg";
      const filename = `photos/${Date.now()}_${String(photoFilename || "foto.jpg").replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      try {
        const photoUrlResult = await uploadFileToStorage("photos", filename, buffer, uploadContentType);
        photoUrl = photoUrlResult;
        photoStoragePath = `${filename}`;
      } catch (err) {
        logWarn("[API] Falha ao carregar foto no storage (continua sem foto)", {
          mime: photoMimeType,
          bytes: buffer.length,
          error: err instanceof Error ? err.message : String(err)
        });
        photoUrl = null;
      }
    }
    if (!email) {
      throw new Error("O email \xE9 obrigat\xF3rio para criar o pedido.");
    }
    const userEmail = email;
    const userData = await ensureUserProfile(supabase, {
      email: userEmail,
      name: userNick || "Autor",
      phone
    });
    if (!userData?.id) throw new Error("Perfil de utilizador invalido.");
    const [sanitizedWhy, sanitizedOnlyShe, sanitizedWhere, sanitizedSpecial, sanitizedMemory, sanitizedHeart] = await Promise.all([
      sanitize(whyCreatedToday || ""),
      sanitize(onlySheDoes || ""),
      sanitize(whereItHappened || ""),
      sanitize(whatMakesSpecial || ""),
      sanitize(unforgettableMemory || ""),
      sanitize(messageFromTheHeart || "")
    ]);
    const { data: requestData, error: requestError } = await supabase.from("song_requests").insert([{
      user_id: userData.id,
      recipient_name: recipientName || "Destinatario",
      recipient_gender: recipientGender || null,
      recipient_nick: recipientNick || null,
      relationship: recipientRelation || "Parceiro",
      hook_phrase: hookPhrase || null,
      reference_artist: referenceArtist || null,
      why_created_today: sanitizedWhy,
      only_she_does: sanitizedOnlyShe,
      where_it_happened: sanitizedWhere,
      occasion: occasion || "Homenagem",
      music_style: musicStyle || "Kizomba",
      voice_type: voiceType || "masculina",
      special_traits: sanitizedSpecial,
      memory: sanitizedMemory,
      heart_message: sanitizedHeart,
      desired_emotion: desiredEmotion || "Amor",
      language: language || "portugu\xEAs",
      email: userEmail,
      phone,
      status: "lyrics_generating",
      photo_url: photoUrl,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      utm_term: utm_term || null,
      utm_content: utm_content || null
    }]).select().single();
    if (requestError || !requestData?.id) {
      logError("[API] Falha ao criar song_request", requestError, {
        supabaseMessage: requestError?.message,
        supabaseDetails: requestError?.details,
        supabaseHint: requestError?.hint,
        supabaseCode: requestError?.code
      });
      throw new Error("Nao foi possivel registrar o seu pedido no banco de dados.");
    }
    dbSongRequestId = requestData.id;
    logInfo("Song request created", { requestId: requestData.id, email: userEmail });
    setProgress(dbSongRequestId, { status: "lyrics_generating", progress: 10, message: "A gerar letra personalizada com IA..." });
    const { result: parsedData } = await generateLyrics({
      userNick: userNick || "Autor",
      recipientName: recipientName || "Destinatario",
      recipientGender: recipientGender || "",
      recipientRelation: recipientRelation || "Parceiro",
      recipientNick: recipientNick || "",
      hookPhrase: hookPhrase || "",
      occasion: occasion || "Homenagem",
      whyCreatedToday: whyCreatedToday || "",
      musicStyle: musicStyle || "Kizomba",
      referenceArtist: referenceArtist || "",
      voiceType: voiceType || "Masculina",
      unforgettableMemory: unforgettableMemory || "",
      whatMakesSpecial: whatMakesSpecial || "",
      onlySheDoes: onlySheDoes || "",
      whereItHappened: whereItHappened || "",
      messageFromTheHeart: messageFromTheHeart || "",
      desiredEmotion: desiredEmotion || "Emocionante",
      language: language || "portugu\xEAs"
    }, { requestId: dbSongRequestId, email: userEmail });
    const { data: songData, error: songError } = await supabase.from("songs").insert([{
      request_id: requestData.id,
      title: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyrics_snippet: parsedData.lyricsSnippet,
      letter_text: parsedData.letterText,
      mureka_status: "not_started"
    }]).select().single();
    if (songError || !songData?.id) {
      logError("[API] Falha ao criar registro de musica", songError, { requestId: requestData.id });
      await markRequestFailed(requestData.id, songError || new Error("Sem musica retornada"));
      throw new Error("A letra foi gerada, mas nao conseguimos guarda-la. Tente novamente.");
    }
    dbSongId = songData.id;
    const { error: lyricsReadyError } = await supabase.from("song_requests").update({ status: "lyrics_ready" }).eq("id", requestData.id);
    if (lyricsReadyError) {
      logError("[API] Falha ao atualizar status lyrics_ready", lyricsReadyError, { requestId: requestData.id });
      await markRequestFailed(requestData.id, lyricsReadyError);
      throw new Error("A letra foi criada, mas nao conseguimos atualizar o estado do pedido.");
    }
    setProgress(requestData.id, { status: "lyrics_ready", progress: 35, message: "Letra criada com sucesso!" });
    logInfo("Lyrics created successfully", {
      requestId: requestData.id,
      songId: songData.id,
      style: musicStyle || req.body.musicStyle || "Kizomba"
    });
    res.json({
      success: true,
      dbSongId: songData.id,
      dbSongRequestId: requestData.id,
      ...parsedData,
      photoUrl,
      status: "lyrics_ready",
      message: "Letra criada com sucesso!"
    });
    const userFullNameLyrics = userNick || "";
    const namePartsLyrics = userFullNameLyrics.split(" ").filter(Boolean);
    const firstNameLyrics = namePartsLyrics[0] || void 0;
    const lastNameLyrics = namePartsLyrics.slice(-1)[0] || void 0;
    const genderMap = { masculino: "m", feminino: "f" };
    const genLyrics = recipientGender ? genderMap[recipientGender.toLowerCase()] : void 0;
    const eventIp = req.ip || req.socket.remoteAddress || void 0;
    const eventUa = req.headers["user-agent"];
    const leadFbp = typeof req.body?.fbp === "string" ? req.body.fbp : void 0;
    const leadFbc = typeof req.body?.fbc === "string" ? req.body.fbc : void 0;
    sendLeadEvent({
      eventId: generateServerEventId(requestData.id, "Lead"),
      email: email || "",
      phone: phone || void 0,
      contentName: "lyrics_generated",
      eventSourceUrl: req.headers.referer || void 0,
      clientIp: eventIp,
      clientUserAgent: eventUa,
      externalId: email || void 0,
      fbp: leadFbp,
      fbc: leadFbc,
      ln: lastNameLyrics
    }).catch(
      (err) => logError("[API] Meta CAPI Lead event failed", err, { requestId: requestData.id })
    );
    sendCompleteRegistrationEvent({
      eventId: generateServerEventId(requestData.id, "CompleteRegistration"),
      email: email || "",
      phone: phone || void 0,
      fn: firstNameLyrics,
      ln: lastNameLyrics,
      gen: genLyrics,
      country: "AO",
      eventSourceUrl: req.headers.referer || void 0,
      clientIp: eventIp,
      clientUserAgent: eventUa,
      externalId: email || void 0,
      fbp: leadFbp,
      fbc: leadFbc
    }).catch(
      (err) => logError("[API] Meta CAPI CompleteRegistration event failed", err, { requestId: requestData.id })
    );
    sendConfirmationEmail(email, recipientName, requestData.id).catch((emailErr) => {
      logError("[API] Falha ao enviar email de confirmacao", emailErr, { requestId: requestData.id, email });
    });
  } catch (err) {
    if (dbSongRequestId) {
      await markRequestFailed(dbSongRequestId, err);
      setProgress(dbSongRequestId, { status: "failed", progress: 100, message: "Erro ao gerar.", error: safeMessage2(err) });
    }
    if (dbSongId && supabase) {
      try {
        await supabase.from("songs").update({ mureka_status: "failed" }).eq("id", dbSongId);
      } catch (songUpdateErr) {
        logError("[API] Falha ao atualizar mureka_status no catch", songUpdateErr, { songId: dbSongId });
      }
    }
    if (photoStoragePath && !dbSongRequestId) {
      deleteStorageFile("photos", photoStoragePath).catch(() => {
      });
    }
    logError("[API] /generate-lyrics falhou", err, {
      requestId: dbSongRequestId,
      songId: dbSongId
    });
    if (!res.headersSent) {
      const providerFailures = err?.providerFailures;
      if (allFailuresTransient(providerFailures) && dbSongRequestId) {
        res.status(503).json({ success: false, error: LYRIC_GENERATION_QUEUED_MESSAGE });
      } else {
        res.status(500).json({ success: false, error: publicErrorMessage(err) });
      }
    }
  }
});
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
router2.get("/song/:id", getSongLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const publicSupabase = getAdminSupabase();
    if (!publicSupabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    logDebug("Fetching song", { songId: id });
    const { data: songsData, error } = await publicSupabase.from("songs").select("*, song_requests!inner(id, recipient_name, status, email, phone, photo_url, final_mixed_audio_url, elevenlabs_voice_id, music_style, memory, deliver_at, occasion, relationship, desired_emotion, voice_type, recipient_gender, users(name))").or(`id.eq.${id},request_id.eq.${id}`).limit(1);
    const songData = songsData && songsData.length > 0 ? songsData[0] : null;
    if (error || !songData) {
      logWarn("[API] Musica nao encontrada ou inacessivel", {
        songId: id,
        supabaseMessage: error?.message,
        supabaseCode: error?.code
      });
      return res.status(404).json({ success: false, error: "Musica nao encontrada." });
    }
    const sr = songData.song_requests;
    let requestStatus = sr?.status;
    const deliverAt = sr?.deliver_at;
    let audioUrl = songData.full_song_url || songData.audio_url || null;
    let audioUrlV2 = null;
    const adminSupabase = getAdminSupabase();
    if (requestStatus === "approved" && deliverAt && new Date(deliverAt) <= /* @__PURE__ */ new Date()) {
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
      if (!fullUrl) {
        logWarn("[API] Auto-delivery adiada \u2014 pedido aprovado sem \xE1udio", { songId: id, requestId: songData.request_id });
      } else if (adminSupabase) {
        const { error: deliveryError } = await adminSupabase.from("song_requests").update({ status: "delivered", deliver_at: null, delivered_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", songData.request_id).eq("status", "approved");
        if (!deliveryError) {
          requestStatus = "delivered";
          const userEmail = sr?.email;
          const slug = (sr?.recipient_name || "especial").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
          const personalizedUrl = `${getAppUrl(req)}/song/${slug}?id=${songData.id}`;
          if (userEmail) {
            sendPersonalizedEmail(userEmail, sr?.recipient_name, personalizedUrl, songData.letter_text || "Dedicat\xF3ria.").catch((err) => logError("[API] Falha ao enviar email de entrega", err, { songId: id }));
          }
          if (sr?.phone) {
            sendDeliveryWhatsApp({
              requestId: songData.request_id,
              phone: sr.phone,
              recipientName: sr?.recipient_name,
              songUrl: personalizedUrl
            }).catch((err) => logError("[API] Falha ao enviar WhatsApp de entrega", err, { songId: id }));
          }
          if (fullUrl) {
            const match = fullUrl.match(/full-audio\/(.+)/);
            if (match) {
              const signedUrl = await createSignedStorageUrl("full-audio", match[1], 604800);
              audioUrl = signedUrl || fullUrl;
            } else {
              audioUrl = fullUrl;
            }
          }
          const fullUrlV2 = songData.audio_url_v2 || songData.full_song_url_v2;
          if (fullUrlV2) {
            const matchV2 = fullUrlV2.match(/full-audio\/(.+)/);
            if (matchV2) {
              const signedUrlV2 = await createSignedStorageUrl("full-audio", matchV2[1], 604800);
              audioUrlV2 = signedUrlV2 || fullUrlV2;
            } else {
              audioUrlV2 = fullUrlV2;
            }
          }
        }
      }
    }
    if (requestStatus === "delivered" || requestStatus === "approved") {
      const fullUrl = sr?.final_mixed_audio_url || songData.full_song_url || songData.audio_url;
      if (fullUrl && fullUrl !== audioUrl) {
        const match = fullUrl.match(/full-audio\/(.+)/);
        if (match) {
          const signedUrl = await createSignedStorageUrl("full-audio", match[1], 604800);
          audioUrl = signedUrl || fullUrl;
        } else {
          audioUrl = fullUrl;
        }
      }
      if (!audioUrlV2) {
        const fullUrlV2 = songData.audio_url_v2 || songData.full_song_url_v2;
        if (fullUrlV2) {
          const matchV2 = fullUrlV2.match(/full-audio\/(.+)/);
          if (matchV2) {
            const signedUrlV2 = await createSignedStorageUrl("full-audio", matchV2[1], 604800);
            audioUrlV2 = signedUrlV2 || fullUrlV2;
          } else {
            audioUrlV2 = fullUrlV2;
          }
        }
      }
    }
    const song_requests = songData.song_requests;
    let lyricsArray = [];
    const rawLyrics = songData.lyrics;
    if (Array.isArray(rawLyrics)) {
      lyricsArray = rawLyrics;
    } else if (typeof rawLyrics === "string" && rawLyrics.trim().startsWith("[")) {
      try {
        lyricsArray = JSON.parse(rawLyrics);
      } catch {
        lyricsArray = rawLyrics.split("\n").filter((l) => l.trim());
      }
    } else if (typeof rawLyrics === "string" && rawLyrics.length > 0) {
      lyricsArray = rawLyrics.split("\n").filter((l) => l.trim());
    }
    const publicData = {
      id: songData.id,
      request_id: songData.request_id,
      title: songData.title,
      lyrics: lyricsArray,
      lyrics_snippet: songData.lyrics_snippet,
      regeneration_count: songData.regeneration_count,
      letter_text: songData.letter_text,
      duration: songData.duration,
      created_at: songData.created_at,
      updated_at: songData.updated_at,
      mureka_status: songData.mureka_status,
      preview_url: songData.preview_url,
      audio_url: audioUrl,
      audio_url_v2: audioUrlV2,
      recipient_name: song_requests?.recipient_name,
      photo_url: song_requests?.photo_url,
      user_name: song_requests?.users?.name,
      music_style: song_requests?.music_style,
      memory: song_requests?.memory,
      occasion: song_requests?.occasion,
      relationship: song_requests?.relationship,
      desired_emotion: song_requests?.desired_emotion,
      voice_type: song_requests?.voice_type,
      recipient_gender: song_requests?.recipient_gender,
      elevenlabs_voice_id: song_requests?.elevenlabs_voice_id,
      status: requestStatus
    };
    return res.json({ success: true, data: toCamelCase(publicData) });
  } catch (err) {
    logError("[API] Falha ao consultar musica publica", err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: "Nao foi possivel consultar a musica." });
  }
});
router2.put("/song/:id/lyrics", globalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const { email } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ success: false, error: "Email requerido." });
    const validation = validateInput(UpdateLyricsSchema, req.body);
    if ("errors" in validation) {
      logWarn("[API] PUT /song/:id/lyrics dados inv\xE1lidos", {
        songId: id,
        errors: validation.errors
      });
      return res.status(400).json({ success: false, error: "Dados inv\xE1lidos", validation_errors: validationErrorsArray(validation.errors) });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const { data: existing } = await supabase.from("songs").select("id, request_id, song_requests(user_email)").eq("id", id).maybeSingle();
    if (!existing) return res.status(404).json({ success: false, error: "M\xFAsica n\xE3o encontrada." });
    const srEmail = existing.song_requests?.user_email;
    if (srEmail && srEmail.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ success: false, error: "N\xE3o autorizado." });
    }
    const rawLyrics = validation.data.lyrics;
    const lyricsArray = Array.isArray(rawLyrics) ? rawLyrics : rawLyrics.split("\n").filter((l) => l.trim().length > 0);
    const sanitizedSnippet = validation.data.lyrics_snippet ? await sanitize(validation.data.lyrics_snippet) : null;
    const { error: updateError } = await supabase.from("songs").update({
      lyrics: lyricsArray,
      lyrics_snippet: sanitizedSnippet,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    if (updateError) throw updateError;
    logInfo("[API] Letra editada manualmente", { songId: id });
    res.json({ success: true, message: "Letra atualizada com sucesso." });
  } catch (err) {
    logError("[API] Falha ao editar letra", err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});
router2.post("/song/:id/regenerate-lyrics", generateLyricsLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const { data: songData, error: songError } = await supabase.from("songs").select("*, song_requests!inner(*)").eq("id", id).single();
    if (songError || !songData) {
      return res.status(404).json({ success: false, error: "M\xFAsica n\xE3o encontrada." });
    }
    const sr = songData.song_requests;
    const currentCount = songData.regeneration_count || 0;
    if (currentCount >= 2) {
      return res.status(429).json({ success: false, error: "Limite de regenera\xE7\xF5es atingido (m\xE1x. 2). Edite manualmente a letra." });
    }
    const userData = await supabase.from("users").select("name, email").eq("id", sr.user_id).single();
    const userName = userData.data?.name || "Autor";
    const userEmail = userData.data?.email || void 0;
    const bodyHint = typeof req.body === "object" && req.body !== null ? req.body : {};
    const preferBody = (key, fallback) => {
      const val = bodyHint[key];
      return typeof val === "string" && val.trim() ? val : fallback;
    };
    const { result: parsedData } = await generateLyrics({
      userNick: userName,
      recipientName: sr.recipient_name || "Destinatario",
      recipientGender: sr.recipient_gender || "Masculino",
      recipientRelation: sr.relationship || "Parceiro",
      recipientNick: sr.recipient_nick || "",
      occasion: sr.occasion || "Homenagem",
      whyCreatedToday: preferBody("whyCreatedToday", sr.why_created_today || ""),
      musicStyle: sr.music_style || "Kizomba",
      referenceArtist: preferBody("referenceArtist", sr.reference_artist || ""),
      voiceType: sr.voice_type || "Masculina",
      unforgettableMemory: sr.memory || "",
      whatMakesSpecial: sr.special_traits || "",
      onlySheDoes: preferBody("onlySheDoes", sr.only_she_does || ""),
      whereItHappened: preferBody("whereItHappened", sr.where_it_happened || ""),
      messageFromTheHeart: sr.heart_message || "",
      hookPhrase: sr.hook_phrase || "",
      desiredEmotion: sr.desired_emotion || "Emocionante",
      language: sr.language || "portugu\xEAs"
    }, { requestId: id, email: userEmail });
    const newCount = currentCount + 1;
    const { error: updateError } = await supabase.from("songs").update({
      title: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyrics_snippet: parsedData.lyricsSnippet,
      letter_text: parsedData.letterText,
      regeneration_count: newCount,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id);
    if (updateError) throw updateError;
    logInfo("[API] Letra regenerada com IA", { songId: id, regenerationCount: newCount });
    res.json({
      success: true,
      songTitle: parsedData.songTitle,
      lyrics: parsedData.lyrics,
      lyricsSnippet: parsedData.lyricsSnippet,
      letterText: parsedData.letterText,
      regeneration_count: newCount,
      regenerations_remaining: 2 - newCount,
      message: newCount >= 2 ? "\xDAltima regenera\xE7\xE3o utilizada." : `Letra regenerada (${newCount}/2).`
    });
  } catch (err) {
    logError("[API] Falha ao regenerar letra", err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});
router2.post("/song/:id/rebuild-audio", globalLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    const { email } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ success: false, error: "Email requerido." });
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indispon\xEDvel." });
    const { data: songsData } = await supabase.from("songs").select("*, song_requests!inner(*)").or(`id.eq.${id},request_id.eq.${id}`).limit(1);
    const song = songsData && songsData.length > 0 ? songsData[0] : null;
    if (!song) return res.status(404).json({ success: false, error: "M\xFAsica n\xE3o encontrada." });
    const sr = song.song_requests;
    if (sr.user_email && sr.user_email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ success: false, error: "N\xE3o autorizado." });
    }
    const requestId = song.request_id;
    const songId = song.id;
    await supabase.from("songs").update({
      mureka_task_id: null,
      audio_url: null,
      preview_url: null,
      full_song_url: null,
      mureka_status: "generating",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", songId);
    await supabase.from("song_requests").update({
      status: "music_processing",
      final_mixed_audio_url: null
    }).eq("id", requestId);
    runBackgroundSunoWorkflow(
      requestId,
      songId,
      sr.music_style || "Kizomba",
      song.title || "M\xFAsica SeuBeat",
      song.lyrics || [],
      { voiceType: sr.voice_type || void 0, desiredEmotion: sr.desired_emotion || void 0 }
    ).catch((err) => logError("[API] Rebuild audio background workflow failed", err, { songId, requestId }));
    res.json({ success: true, message: "Regenera\xE7\xE3o de \xE1udio iniciada no Suno com as letras atuais.", songId, requestId });
  } catch (err) {
    logError("[API] Falha ao solicitar regenera\xE7\xE3o de \xE1udio", err instanceof Error ? err : new Error(String(err)), { songId: req.params.id });
    res.status(500).json({ success: false, error: publicErrorMessage(err) });
  }
});
var todayCountCache = null;
var TODAY_COUNT_TTL_MS = 6e4;
router2.get("/stats/today-count", async (_req, res) => {
  try {
    if (todayCountCache && Date.now() - todayCountCache.at < TODAY_COUNT_TTL_MS) {
      return res.json({ count: todayCountCache.count });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.json({ count: 847 });
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const { count, error } = await supabase.from("songs").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
    if (error) {
      logWarn("[API] Falha ao contar m\xFAsicas de hoje", error);
      return res.json({ count: 847 });
    }
    const result = count || 0;
    todayCountCache = { count: result, at: Date.now() };
    res.json({ count: result });
  } catch {
    res.json({ count: 847 });
  }
});
router2.post("/submit-payment", paymentLimiter, (req, res, next) => {
  if (req.is("multipart/form-data")) {
    paymentUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ success: false, error: "Ficheiro demasiado grande. M\xE1x. 10MB." });
          }
          return res.status(400).json({ success: false, error: `Erro no upload: ${err.message}` });
        }
        return res.status(500).json({ success: false, error: "Erro ao processar o upload." });
      }
      next();
    });
  } else {
    next();
  }
}, async (req, res) => {
  try {
    const files = req.files;
    const proofFileMulter = files?.proof?.[0];
    const voiceFileMulter = files?.voiceSample?.[0];
    const voiceFreeFileMulter = files?.voiceFreeSample?.[0];
    const isMultipart = !!(proofFileMulter || voiceFileMulter || voiceFreeFileMulter) || req.is("multipart/form-data");
    if (isMultipart && !req.body?.songRequestId) {
      logWarn("[API] submit-payment: multipart recebido mas body vazio \u2014 multer pode ter falhado", {
        hasFiles: !!files,
        contentType: req.headers["content-type"]
      });
      return res.status(400).json({ success: false, error: "Dados de pagamento inv\xE1lidos. Envie novamente o comprovativo." });
    }
    const bodyForValidation = isMultipart ? {
      songRequestId: req.body.songRequestId,
      userEmail: req.body.userEmail,
      phone: req.body.phone || void 0,
      plan: req.body.plan,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod || "reference",
      voiceValidationTaskId: req.body.voiceValidationTaskId || null,
      voiceValidationPhrase: req.body.voiceValidationPhrase || null,
      eventIds: (() => {
        try {
          return req.body.eventIds ? JSON.parse(req.body.eventIds) : null;
        } catch {
          return null;
        }
      })(),
      fbp: req.body.fbp || null,
      fbc: req.body.fbc || null,
      // Campos base64 opcionais — para multipart não existem
      proofBase64: null,
      voiceSampleBase64: null,
      voiceFreeSampleBase64: null
    } : req.body;
    const validation = validateInput(SubmitPaymentSchema, bodyForValidation);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Dados de pagamento inv\xE1lidos", validation_errors: validationErrorsArray(validation.errors) });
    }
    const {
      songRequestId,
      userEmail,
      phone,
      plan,
      amount,
      proofBase64,
      proofFilename,
      proofMimeType,
      voiceSampleBase64,
      voiceSampleFilename,
      voiceSampleMimeType,
      voiceFreeSampleBase64,
      voiceFreeSampleFilename,
      voiceFreeSampleMimeType,
      voiceValidationTaskId,
      voiceValidationPhrase,
      paymentMethod,
      eventIds,
      fbp,
      fbc
    } = validation.data;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const resolvedPaymentMethod = paymentMethod || "reference";
    const rawAmount = typeof amount === "number" && !isNaN(amount) ? amount : typeof amount === "string" ? parseAngolanAmount(amount) : 0;
    const parsedAmount = sanitizePaymentAmount(rawAmount, plan);
    const [pendingResult, approvedResult, requestResult] = await Promise.all([
      supabase.from("payments").select("id, status").eq("request_id", songRequestId).eq("status", "pending_verification").maybeSingle(),
      supabase.from("payments").select("id").eq("request_id", songRequestId).eq("status", "approved").maybeSingle(),
      supabase.from("song_requests").select("status").eq("id", songRequestId).maybeSingle()
    ]);
    const existingPayment = pendingResult.data;
    const approvedPayment = approvedResult.data;
    const requestGuard = requestResult.data;
    if (!requestGuard) {
      return res.status(400).json({ success: false, error: "Pedido n\xE3o encontrado. Verifique o link e tente novamente." });
    }
    if (existingPayment) {
      return res.status(409).json({ success: false, error: "J\xE1 existe um comprovativo pendente para este pedido." });
    }
    if (approvedPayment || requestGuard && (requestGuard.status === "approved" || requestGuard.status === "delivered")) {
      return res.status(409).json({
        success: false,
        error: "Este pedido j\xE1 tem um pagamento aprovado. A tua m\xFAsica est\xE1 pronta!"
      });
    }
    const { data: existingPaymentRecord } = await supabase.from("payments").select("id, proof_path").eq("request_id", songRequestId).in("status", ["rejected", "failed"]).maybeSingle();
    let proofPath = null;
    let proofUrl = null;
    let proofVerification = null;
    if (isMultipart && !proofFileMulter && !voiceFileMulter && !voiceFreeFileMulter) {
      logWarn("[API] submit-payment: multipart sem ficheiro \u2014 multer pode ter falhado", { songRequestId });
      return res.status(400).json({ success: false, error: "Envie um comprovativo de pagamento (imagem ou PDF)." });
    }
    let proofBufferForVerification = null;
    let proofMimeForVerification = "image/jpeg";
    if (proofFileMulter) {
      proofBufferForVerification = proofFileMulter.buffer;
      proofMimeForVerification = proofFileMulter.mimetype || "image/jpeg";
    } else if (proofBase64) {
      proofBufferForVerification = decodeBase64Payload(proofBase64);
      proofMimeForVerification = proofMimeType || "image/jpeg";
    }
    let proofHash = null;
    if (proofBufferForVerification && proofBufferForVerification.length > 0) {
      proofHash = createHash("sha256").update(proofBufferForVerification).digest("hex");
    }
    if (proofHash) {
      try {
        const [hashDupeResult, pendingDupeResult] = await Promise.all([
          supabase.from("payments").select("id, request_id, status, user_email").eq("proof_hash", proofHash).neq("request_id", songRequestId).in("status", ["approved", "pending_verification", "delivered"]).maybeSingle(),
          // Also check for same transactionId once extracted (checked post-verification below)
          Promise.resolve(null)
        ]);
        if (hashDupeResult.data) {
          logWarn("[API] Comprovativo duplicado detetado \u2014 mesmo hash SHA-256", {
            songRequestId,
            duplicateOf: hashDupeResult.data.request_id,
            duplicatePaymentId: hashDupeResult.data.id,
            proofHash
          });
          return res.status(409).json({
            success: false,
            error: "Este comprovativo de pagamento j\xE1 foi utilizado noutro pedido. Envia o comprovativo correto."
          });
        }
      } catch (dedupErr) {
        logWarn("[API] Dedup check falhou (schema cache?) \u2014 a ignorar dedup", { songRequestId, error: dedupErr instanceof Error ? dedupErr.message : String(dedupErr) });
      }
    }
    const verificationPromise = proofBufferForVerification && proofBufferForVerification.length > 0 ? verifyPaymentProof(proofBufferForVerification, proofMimeForVerification, plan, resolvedPaymentMethod).catch((err) => {
      logError("[API] AI verification falhou \u2014 fallback para manual", err, { songRequestId });
      return null;
    }) : Promise.resolve(null);
    if (proofFileMulter) {
      const proofBuffer = proofFileMulter.buffer;
      if (proofBuffer.length > 10 * 1024 * 1024) throw new Error("Comprovativo demasiado grande. M\xE1x. 10MB.");
      const resolvedMime = proofFileMulter.mimetype || "application/octet-stream";
      const sanitizedProofFilename = String(proofFileMulter.originalname || "proof.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `proofs/${Date.now()}_${sanitizedProofFilename}`;
      try {
        const uploadedUrl = await uploadFileToStorage("payment-proofs", filename, proofBuffer, resolvedMime);
        proofPath = filename;
        proofUrl = uploadedUrl;
        logInfo("[API] Comprovativo enviado (multipart)", { bucket: "payment-proofs", filename, url: proofUrl, size: proofBuffer.length });
      } catch (err) {
        logError("[API] Falha no upload do comprovativo (multipart)", err, { filename });
        throw new Error(`Upload do comprovativo falhou: ${err instanceof Error ? err.message : "sem dados"}`);
      }
    } else if (proofBase64) {
      const resolvedMime = proofMimeType || "application/octet-stream";
      const proofBuffer = decodeBase64Payload(proofBase64);
      if (proofBuffer.length > 10 * 1024 * 1024) throw new Error("Comprovativo demasiado grande. M\xE1x. 10MB.");
      const sanitizedProofFilename = String(proofFilename || "proof.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `proofs/${Date.now()}_${sanitizedProofFilename}`;
      try {
        const uploadedUrl = await uploadFileToStorage("payment-proofs", filename, proofBuffer, resolvedMime);
        proofPath = filename;
        proofUrl = uploadedUrl;
        logInfo("[API] Comprovativo enviado (base64)", { bucket: "payment-proofs", filename, url: proofUrl, size: proofBuffer.length });
      } catch (err) {
        logError("[API] Falha no upload do comprovativo (base64)", err, { filename });
        throw new Error(`Upload do comprovativo falhou: ${err instanceof Error ? err.message : "sem dados"}`);
      }
    }
    let voiceSampleUrl = null;
    const ALLOWED_VOICE_MIMES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm"];
    if (voiceFileMulter) {
      const resolvedVoiceMime = voiceFileMulter.mimetype || "audio/wav";
      if (!ALLOWED_VOICE_MIMES.includes(resolvedVoiceMime)) {
        return res.status(400).json({ success: false, error: "Formato de \xE1udio inv\xE1lido. Apenas WAV, MP3, MP4 ou OGG." });
      }
      const voiceBuffer = voiceFileMulter.buffer;
      if (voiceBuffer.length > 5 * 1024 * 1024) throw new Error("Amostra de voz demasiado grande. M\xE1x. 5MB.");
      if (voiceBuffer.length < 1024) throw new Error("Amostra de voz demasiado pequena. Grava pelo menos 3 segundos.");
      const sanitizedVoiceFilename = String(voiceFileMulter.originalname || "sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
      try {
        await uploadFileToStorage("voice-samples", filename, voiceBuffer, resolvedVoiceMime);
        voiceSampleUrl = `${filename}`;
      } catch (err) {
        throw new Error(`Upload da amostra de voz falhou: ${err instanceof Error ? err.message : "sem dados"}`);
      }
    } else if (voiceSampleBase64) {
      const resolvedVoiceMime = voiceSampleMimeType || "audio/wav";
      if (!ALLOWED_VOICE_MIMES.includes(resolvedVoiceMime)) {
        return res.status(400).json({ success: false, error: "Formato de \xE1udio inv\xE1lido. Apenas WAV, MP3, MP4 ou OGG." });
      }
      const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
      if (voiceBuffer.length > 5 * 1024 * 1024) throw new Error("Amostra de voz demasiado grande. M\xE1x. 5MB.");
      if (voiceBuffer.length < 1024) throw new Error("Amostra de voz demasiado pequena. Grava pelo menos 3 segundos.");
      const sanitizedVoiceFilename = String(voiceSampleFilename || "sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
      try {
        await uploadFileToStorage("voice-samples", filename, voiceBuffer, resolvedVoiceMime);
        voiceSampleUrl = `${filename}`;
      } catch (err) {
        throw new Error(`Upload da amostra de voz falhou: ${err instanceof Error ? err.message : "sem dados"}`);
      }
    }
    let voiceFreeSampleUrl = null;
    if (voiceFreeFileMulter) {
      const resolvedFreeMime = voiceFreeFileMulter.mimetype || "audio/wav";
      if (!ALLOWED_VOICE_MIMES.includes(resolvedFreeMime)) {
        return res.status(400).json({ success: false, error: "Formato de \xE1udio livre inv\xE1lido." });
      }
      const freeBuffer = voiceFreeFileMulter.buffer;
      if (freeBuffer.length > 5 * 1024 * 1024) throw new Error("Amostra de voz livre demasiado grande. M\xE1x. 5MB.");
      if (freeBuffer.length >= 1024) {
        const sanitizedFreeFilename = String(voiceFreeFileMulter.originalname || "free_sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
        const freeFilename = `voices/${Date.now()}_free_${sanitizedFreeFilename}`;
        try {
          await uploadFileToStorage("voice-samples", freeFilename, freeBuffer, resolvedFreeMime);
          voiceFreeSampleUrl = `${freeFilename}`;
        } catch (err) {
          logError("[API] Upload da amostra de voz livre falhou", err, { freeFilename });
        }
      }
    } else if (voiceFreeSampleBase64) {
      const resolvedFreeMime = voiceFreeSampleMimeType || "audio/wav";
      if (!ALLOWED_VOICE_MIMES.includes(resolvedFreeMime)) {
        return res.status(400).json({ success: false, error: "Formato de \xE1udio livre inv\xE1lido." });
      }
      const freeBuffer = decodeBase64Payload(voiceFreeSampleBase64);
      if (freeBuffer.length > 5 * 1024 * 1024) throw new Error("Amostra de voz livre demasiado grande. M\xE1x. 5MB.");
      if (freeBuffer.length >= 1024) {
        const sanitizedFreeFilename = String(voiceFreeSampleFilename || "free_sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
        const freeFilename = `voices/${Date.now()}_free_${sanitizedFreeFilename}`;
        try {
          await uploadFileToStorage("voice-samples", freeFilename, freeBuffer, resolvedFreeMime);
          voiceFreeSampleUrl = `${freeFilename}`;
        } catch (err) {
          logError("[API] Upload da amostra de voz livre falhou", err, { freeFilename });
        }
      }
    }
    proofVerification = await verificationPromise;
    if (proofVerification && proofVerification.decision === "auto_approve" && !isTxIdAcceptable(proofVerification.extracted?.transactionId)) {
      proofVerification.decision = "manual_review";
      logWarn("[API] Auto-approve bloqueado \u2014 transaction_id n\xE3o lido", { songRequestId });
    }
    let paymentStatus = "pending_verification";
    let approvedAt = null;
    let deliverAt = null;
    if (proofVerification) {
      if (proofVerification.decision === "auto_approve") {
        paymentStatus = "approved";
        approvedAt = (/* @__PURE__ */ new Date()).toISOString();
        deliverAt = plan === "standard" ? new Date(Date.now() + 24 * 60 * 60 * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        logInfo("[API] Pagamento AUTO-APROVADO pela AI", {
          songRequestId,
          plan,
          confidence: proofVerification.confidence,
          provider: proofVerification.provider
        });
      } else if (proofVerification.decision === "auto_reject") {
        paymentStatus = "rejected";
        logInfo("[API] Pagamento AUTO-REJEITADO pela AI", {
          songRequestId,
          plan,
          confidence: proofVerification.confidence,
          provider: proofVerification.provider,
          reasons: proofVerification.checks.filter((c) => !c.passed).map((c) => c.name)
        });
      } else {
        logInfo("[API] Pagamento encaminhado para review manual pela AI", {
          songRequestId,
          plan,
          confidence: proofVerification.confidence,
          provider: proofVerification.provider
        });
      }
    }
    let rejectionNotes = null;
    if (paymentStatus === "rejected" && proofVerification) {
      const failed = proofVerification.checks.filter((c) => !c.passed).map((c) => `${c.name}: esperado ${c.expected}, encontrado ${c.actual}`);
      rejectionNotes = failed.length ? `Comprovativo n\xE3o aprovado pela verifica\xE7\xE3o autom\xE1tica. Motivos: ${failed.join("; ")}. Envia um novo comprovativo v\xE1lido pelo wizard para continuares.` : "Comprovativo n\xE3o aprovado pela verifica\xE7\xE3o autom\xE1tica. Envia um novo comprovativo v\xE1lido pelo wizard para continuares.";
    }
    const updateData = { status: "payment_submitted" };
    if (voiceSampleUrl) updateData.voice_sample_url = voiceSampleUrl;
    if (voiceFreeSampleUrl) updateData.voice_free_sample_url = voiceFreeSampleUrl;
    if (voiceSampleUrl && voiceValidationTaskId && typeof voiceValidationTaskId === "string" && voiceValidationTaskId.trim()) {
      const voiceMeta = { validation_task_id: voiceValidationTaskId.trim() };
      if (typeof voiceValidationPhrase === "string" && voiceValidationPhrase.trim()) {
        voiceMeta.phrase = voiceValidationPhrase.trim();
      }
      updateData.elevenlabs_voice_id = JSON.stringify(voiceMeta);
    }
    const { error: requestUpdateError } = await supabase.from("song_requests").update(updateData).eq("id", songRequestId);
    if (requestUpdateError) throw requestUpdateError;
    const previousStatus = requestGuard?.status || "lyrics_ready";
    const paymentFields = {
      request_id: songRequestId,
      user_email: userEmail,
      plan,
      plan_type: plan,
      amount: parsedAmount,
      amount_kz: parsedAmount,
      payment_method: resolvedPaymentMethod,
      proof_url: proofUrl || (proofPath ? `storage:${proofPath}` : null),
      proof_path: proofPath,
      proof_filename: (isMultipart && proofFileMulter ? proofFileMulter.originalname : proofFilename) || proofPath?.split("/").pop() || null,
      proof_hash: proofHash,
      status: paymentStatus,
      notes: rejectionNotes,
      approved_at: approvedAt,
      expires_at: paymentStatus === "pending_verification" ? new Date(Date.now() + 15 * 60 * 1e3).toISOString() : null,
      ai_verified: proofVerification ? proofVerification.decision === "auto_approve" : false,
      verification_result: proofVerification ? JSON.stringify({
        confidence: proofVerification.confidence,
        decision: proofVerification.decision,
        extracted: proofVerification.extracted,
        checks: proofVerification.checks,
        provider: proofVerification.provider,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }) : null,
      transaction_id: proofVerification?.extracted?.transactionId || null
    };
    let paymentRecord = null;
    let paymentError = null;
    if (existingPaymentRecord) {
      const updatePayload = { ...paymentFields };
      if (paymentStatus !== "approved") {
        updatePayload.approved_at = null;
      }
      const { data: updatedPayment, error: updateErr } = await supabase.from("payments").update(updatePayload).eq("id", existingPaymentRecord.id).select("id").single();
      if (updateErr || !updatedPayment) {
        const updateMsg = String(updateErr?.message || updateErr);
        if (isSchemaCacheError(updateMsg)) {
          logWarn("[API] UPDATE falhou por schema cache \u2014 retry sem novas colunas", { songRequestId });
          const fallbackPayload = stripSchemaCacheFields(updatePayload);
          const { data: retryPayment, error: retryErr } = await supabase.from("payments").update(fallbackPayload).eq("id", existingPaymentRecord.id).select("id").single();
          if (retryErr || !retryPayment) {
            paymentError = retryErr || new Error("Failed to update payment (schema cache fallback)");
          } else {
            paymentRecord = { id: existingPaymentRecord.id };
            if (existingPaymentRecord.proof_path && proofPath && existingPaymentRecord.proof_path !== proofPath) {
              deleteStorageFile("payment-proofs", existingPaymentRecord.proof_path).catch(() => {
              });
            }
          }
        } else {
          paymentError = updateErr || new Error("Failed to update existing payment");
        }
      } else {
        paymentRecord = { id: existingPaymentRecord.id };
        if (existingPaymentRecord.proof_path && proofPath && existingPaymentRecord.proof_path !== proofPath) {
          deleteStorageFile("payment-proofs", existingPaymentRecord.proof_path).catch(() => {
          });
        }
      }
    } else {
      const { data: newPayment, error: insertErr } = await supabase.from("payments").insert(paymentFields).select("id").single();
      if (insertErr || !newPayment) {
        const insertMsg = String(insertErr?.message || insertErr);
        if (isSchemaCacheError(insertMsg)) {
          logWarn("[API] INSERT falhou por schema cache \u2014 retry sem novas colunas", { songRequestId });
          const fallbackFields = stripSchemaCacheFields(paymentFields);
          const { data: retryPayment, error: retryErr } = await supabase.from("payments").insert(fallbackFields).select("id").single();
          if (retryErr || !retryPayment) {
            paymentError = retryErr || new Error("Failed to insert payment (fallback)");
          } else {
            paymentRecord = { id: retryPayment.id };
          }
        } else {
          paymentError = insertErr || new Error("Failed to insert payment");
        }
      } else {
        paymentRecord = { id: newPayment.id };
      }
    }
    if (paymentError) {
      const errMsg = String(paymentError?.message || paymentError);
      if (/unique.*constraint|duplicate key/i.test(errMsg)) {
        logWarn("[API] UNIQUE constraint violation \u2014 payment j\xE1 existe para este pedido", { songRequestId });
        try {
          await supabase.from("song_requests").update({ status: previousStatus }).eq("id", songRequestId);
        } catch {
        }
        return res.status(409).json({ success: false, error: "Este pagamento j\xE1 foi registado." });
      }
      logError("[API] Falha ao gravar pagamento \u2014 a reverter estado do pedido", paymentError, {
        songRequestId,
        userEmail,
        plan,
        previousStatus,
        proofPath
      });
      try {
        await supabase.from("song_requests").update({ status: previousStatus }).eq("id", songRequestId);
      } catch (rollbackErr) {
        logError("[API] Falha ao reverter estado do pedido ap\xF3s erro de pagamento", rollbackErr, { songRequestId, previousStatus });
      }
      throw paymentError;
    }
    if (paymentRecord?.id && proofVerification) {
      const extractedTxId = proofVerification.extracted?.transactionId || null;
      if (extractedTxId && paymentStatus !== "rejected") {
        Promise.resolve(
          supabase.from("payments").select("id, request_id, status, user_email").eq("transaction_id", extractedTxId).neq("request_id", songRequestId).in("status", ["approved", "pending_verification", "delivered"]).maybeSingle()
        ).then(({ data: txDupe }) => {
          if (txDupe) {
            logWarn("[API] Transaction ID duplicado detetado \u2014 rejeitando pagamento", {
              paymentId: paymentRecord.id,
              transactionId: extractedTxId,
              duplicateOf: txDupe.request_id
            });
            supabase.from("payments").update({ status: "rejected", notes: `Rejeitado: transaction ID ${extractedTxId} j\xE1 utilizado no pedido ${txDupe.request_id}` }).eq("id", paymentRecord.id).then(() => {
              sendAdminNotification(
                "Pagamento rejeitado: transa\xE7\xE3o duplicada",
                `Payment ID: ${paymentRecord.id}
Transaction ID: ${extractedTxId}
Duplicado do pedido: ${txDupe.request_id}
Email: ${txDupe.user_email}

Verificar: ${getAppUrl(req)}/admin?tab=payments`
              ).catch(() => {
              });
            });
          }
        }).catch(() => {
        });
      }
    }
    if (paymentStatus === "approved" && paymentRecord?.id) {
      try {
        let autoReq = null;
        let autoSong = null;
        try {
          const { data: autoReqRow } = await supabase.from("song_requests").select("*, songs(id, title, lyrics, audio_url, full_song_url, mureka_status, mureka_task_id)").eq("id", songRequestId).maybeSingle();
          autoReq = autoReqRow ?? null;
          const songsRel = autoReq?.songs;
          autoSong = (Array.isArray(songsRel) ? songsRel[0] : songsRel) ?? null;
        } catch (fetchErr) {
          logError("[API] Auto-approve: falha ao ler pedido/m\xFAsica \u2014 a seguir para aprova\xE7\xE3o simples", fetchErr, { songRequestId });
        }
        const hasGeneratedAudio = !!(autoSong?.full_song_url || autoSong?.audio_url);
        const isProcessing = !!autoSong && (["generating", "processing", "voice_processing", "completed"].includes(String(autoSong.mureka_status)) || !!autoSong.mureka_task_id && !hasGeneratedAudio);
        const nextStatus = autoSong && !hasGeneratedAudio ? "music_processing" : "approved";
        const startGeneration = !!autoSong && !hasGeneratedAudio && !isProcessing;
        await supabase.from("song_requests").update({ status: nextStatus, deliver_at: deliverAt }).eq("id", songRequestId);
        if (startGeneration) {
          const genSongId = String(autoSong.id);
          const rawDelay = process.env.AUTO_APPROVE_GEN_DELAY_MS;
          const genDelayMs = rawDelay !== void 0 && rawDelay !== "" && Number.isFinite(Number(rawDelay)) && Number(rawDelay) >= 0 ? Number(rawDelay) : 9e4;
          logInfo("[API] Auto-approve: gera\xE7\xE3o Suno adiada", {
            songRequestId,
            songId: genSongId,
            plan,
            delayMs: genDelayMs
          });
          if (genDelayMs > 0) {
            try {
              await supabase.from("songs").update({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", genSongId);
            } catch (touchErr) {
              logWarn("[API] Auto-approve: falha ao refrescar updated_at da m\xFAsica", {
                songRequestId,
                error: touchErr instanceof Error ? touchErr.message : String(touchErr)
              });
            }
          }
          const startDeferredGeneration = async () => {
            try {
              const { data: freshRow } = await supabase.from("song_requests").select("*, songs(id, title, lyrics, audio_url, full_song_url, mureka_status, mureka_task_id)").eq("id", songRequestId).maybeSingle();
              const freshReq = freshRow ?? null;
              if (!freshReq || freshReq.deleted_at) {
                logWarn("[API] Auto-approve: pedido desapareceu antes da gera\xE7\xE3o adiada", { songRequestId });
                return;
              }
              const freshStatus = String(freshReq.status || "");
              if (["failed", "payment_rejected"].includes(freshStatus)) {
                logInfo("[API] Auto-approve: estado do pedido mudou durante o delay \u2014 gera\xE7\xE3o adiada cancelada", {
                  songRequestId,
                  status: freshStatus
                });
                return;
              }
              const freshSongsRel = freshReq.songs;
              const freshSong = (Array.isArray(freshSongsRel) ? freshSongsRel[0] : freshSongsRel) ?? null;
              if (!freshSong) {
                logWarn("[API] Auto-approve: linha de m\xFAsica em falta na gera\xE7\xE3o adiada", { songRequestId });
                return;
              }
              if (freshSong.audio_url || freshSong.full_song_url || freshSong.mureka_task_id || ["generating", "processing", "completed"].includes(String(freshSong.mureka_status))) {
                logInfo("[API] Auto-approve: m\xFAsica j\xE1 em curso \u2014 gera\xE7\xE3o adiada cancelada", { songRequestId });
                return;
              }
              logInfo("[API] Auto-approve: a iniciar gera\xE7\xE3o Suno (adiada, letra relida da BD)", {
                songRequestId,
                songId: String(freshSong.id),
                plan
              });
              runBackgroundSunoWorkflow(
                songRequestId,
                String(freshSong.id),
                String(freshReq.music_style || "Kizomba"),
                String(freshSong.title || "M\xFAsica SeuBeat"),
                freshSong.lyrics || [],
                {
                  voiceType: String(freshReq.voice_type || "") || void 0,
                  desiredEmotion: String(freshReq.desired_emotion || "") || void 0
                }
              ).catch((err) => logError("[API] Auto-approve: workflow Suno falhou", err, { songRequestId }));
            } catch (deferredErr) {
              logError("[API] Auto-approve: falha na gera\xE7\xE3o adiada", deferredErr, { songRequestId });
            }
          };
          if (genDelayMs > 0) {
            const timer = setTimeout(() => {
              void startDeferredGeneration();
            }, genDelayMs);
            if (timer && typeof timer.unref === "function") {
              timer.unref();
            }
          } else {
            await startDeferredGeneration();
          }
        } else if (!autoSong) {
          logWarn("[API] Auto-approve: linha de m\xFAsica em falta \u2014 aprova\xE7\xE3o sem gera\xE7\xE3o", { songRequestId });
        }
        sendConfirmationEmail(userEmail, String(autoReq?.recipient_name || userEmail), songRequestId).catch(
          (err) => logError("[API] Falha ao enviar email de confirma\xE7\xE3o (auto-approve)", err, { songRequestId })
        );
        sendAdminNotification(
          "Pagamento AUTO-APROVADO pela AI",
          `Cliente: ${userEmail}
Plano: ${plan} (${parsedAmount} Kz)
Confian\xE7a: ${(proofVerification.confidence * 100).toFixed(0)}%
Provider: ${proofVerification.provider}
Pedido: ${songRequestId}
Pagamento: ${paymentRecord.id}

Verificar: ${getAppUrl(req)}/admin?tab=payments`
        ).catch(
          (err) => logError("[API] Falha ao notificar admin (auto-approve)", err, { paymentId: paymentRecord?.id })
        );
      } catch (autoErr) {
        logError("[API] Falha no auto-approve \u2014 pagamento fica pendente", autoErr, { songRequestId, paymentId: paymentRecord?.id });
        await supabase.from("payments").update({ status: "pending_verification" }).eq("id", paymentRecord.id);
        paymentStatus = "pending_verification";
      }
    }
    if (paymentStatus === "rejected" && proofVerification) {
      const failedChecks = proofVerification.checks.filter((c) => !c.passed).map((c) => `\u2022 ${c.name}: esperado ${c.expected}, encontrado ${c.actual}`).join("\n");
      const rejectReason = rejectionNotes || "Comprovativo n\xE3o aprovado pela verifica\xE7\xE3o autom\xE1tica.";
      try {
        await supabase.from("song_requests").update({ status: "payment_rejected" }).eq("id", songRequestId).in("status", ["payment_submitted", "approved"]);
      } catch (srErr) {
        logError("[API] Auto-reject: falha ao marcar pedido como payment_rejected", srErr, { songRequestId });
      }
      sendPaymentRejectionEmail(userEmail, rejectReason).catch(
        (err) => logError("[API] Falha ao enviar email de rejei\xE7\xE3o (auto-reject)", err, { songRequestId })
      );
      try {
        const { data: rejectReqRow } = await supabase.from("song_requests").select("recipient_name, users(phone)").eq("id", songRequestId).maybeSingle();
        const usersRel = rejectReqRow?.users;
        const dbPhone = (Array.isArray(usersRel) ? usersRel[0] : usersRel)?.phone || "";
        const recipientName = String(rejectReqRow?.recipient_name || "");
        const rejectPhone = dbPhone || phone || "";
        if (rejectPhone) {
          sendPaymentRejectedWhatsApp({ requestId: songRequestId, phone: rejectPhone, recipientName, reason: rejectReason }).catch(
            (err) => logError("[API] Falha ao enviar WhatsApp de rejei\xE7\xE3o (auto-reject)", err, { songRequestId })
          );
        }
      } catch (waErr) {
        logError("[API] Auto-reject: falha ao preparar WhatsApp de rejei\xE7\xE3o", waErr, { songRequestId });
      }
      sendAdminNotification(
        "Pagamento AUTO-REJEITADO pela AI",
        `Cliente: ${userEmail}
Plano: ${plan} (${parsedAmount} Kz)
Confian\xE7a: ${(proofVerification.confidence * 100).toFixed(0)}%
Raz\xF5es:
${failedChecks}

Verificar: ${getAppUrl(req)}/admin?tab=payments`
      ).catch(
        (err) => logError("[API] Falha ao notificar admin (auto-reject)", err, { paymentId: paymentRecord?.id })
      );
      if (paymentRecord?.id) {
        const { data: rejectPaymentRow } = await supabase.from("payments").select("meta_purchase_sent_at").eq("id", paymentRecord.id).maybeSingle();
        if (rejectPaymentRow?.meta_purchase_sent_at) {
          const { sendRefundEvent: sendRefundEvent2 } = await Promise.resolve().then(() => (init_metaPixelCapi(), metaPixelCapi_exports));
          sendRefundEvent2({
            eventId: generateServerEventId(paymentRecord.id, "Refund"),
            email: userEmail,
            phone: phone || void 0,
            value: parsedAmount,
            currency: "AOA",
            contentName: plan,
            orderId: paymentRecord.id,
            fbp: fbp || void 0,
            fbc: fbc || void 0,
            eventSourceUrl: req.headers.referer || void 0,
            clientIp: req.ip || req.socket.remoteAddress || void 0,
            clientUserAgent: req.headers["user-agent"],
            externalId: userEmail
          }).catch(
            (err) => logError("[API] Meta CAPI Refund event failed", err, { paymentId: paymentRecord?.id })
          );
        }
      }
    }
    if (paymentStatus === "approved" && paymentRecord?.id) {
      const { sendPurchaseEvent: sendPurchaseEvent2 } = await Promise.resolve().then(() => (init_metaPixelCapi(), metaPixelCapi_exports));
      const purchasePaymentId = paymentRecord.id;
      sendPurchaseEvent2({
        eventId: generateServerEventId(songRequestId, "Purchase"),
        email: userEmail,
        phone: phone || void 0,
        value: parsedAmount,
        currency: "AOA",
        contentName: plan,
        orderId: purchasePaymentId,
        fbp: fbp || void 0,
        fbc: fbc || void 0,
        eventSourceUrl: req.headers.referer || void 0,
        clientIp: req.ip || req.socket.remoteAddress || void 0,
        clientUserAgent: req.headers["user-agent"],
        externalId: userEmail
      }).then((ok) => {
        if (ok) {
          return supabase.from("payments").update({ meta_purchase_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", purchasePaymentId);
        }
        return void 0;
      }).catch(
        (err) => logError("[API] Meta CAPI Purchase event failed", err, { paymentId: paymentRecord?.id, paymentStatus })
      );
    }
    sendInitiateCheckoutEvent({
      eventId: eventIds?.initiateCheckout || generateServerEventId(songRequestId, "InitiateCheckout"),
      email: userEmail,
      phone: phone || void 0,
      value: parsedAmount,
      currency: "AOA",
      contentName: plan,
      orderId: paymentRecord?.id,
      fbp: fbp || void 0,
      fbc: fbc || void 0,
      eventSourceUrl: req.headers.referer || void 0,
      clientIp: req.ip || req.socket.remoteAddress || void 0,
      clientUserAgent: req.headers["user-agent"],
      externalId: userEmail
    }).catch(
      (err) => logError("[API] Meta CAPI InitiateCheckout event failed", err, { paymentId: paymentRecord?.id })
    );
    sendAddPaymentInfoEvent({
      eventId: eventIds?.addPaymentInfo || generateServerEventId(songRequestId, "AddPaymentInfo"),
      email: userEmail,
      phone: phone || void 0,
      value: parsedAmount,
      currency: "AOA",
      contentName: plan,
      orderId: paymentRecord?.id,
      fbp: fbp || void 0,
      fbc: fbc || void 0,
      eventSourceUrl: req.headers.referer || void 0,
      clientIp: req.ip || req.socket.remoteAddress || void 0,
      clientUserAgent: req.headers["user-agent"],
      externalId: userEmail
    }).catch(
      (err) => logError("[API] Meta CAPI AddPaymentInfo event failed", err, { paymentId: paymentRecord?.id })
    );
    sendSubmitApplicationEvent({
      eventId: eventIds?.submitApplication || generateServerEventId(songRequestId, "SubmitApplication"),
      email: userEmail,
      phone: phone || void 0,
      value: parsedAmount,
      currency: "AOA",
      contentName: plan,
      orderId: paymentRecord?.id,
      fbp: fbp || void 0,
      fbc: fbc || void 0,
      eventSourceUrl: req.headers.referer || void 0,
      clientIp: req.ip || req.socket.remoteAddress || void 0,
      clientUserAgent: req.headers["user-agent"],
      externalId: userEmail
    }).catch(
      (err) => logError("[API] Meta CAPI SubmitApplication event failed", err, { paymentId: paymentRecord?.id })
    );
    if (paymentStatus === "pending_verification") {
      sendAdminNotification(
        "Novo comprovativo pendente",
        `Cliente: ${userEmail}
Plano: ${plan} (${parsedAmount} Kz)
Pedido: ${songRequestId}
Pagamento: ${paymentRecord?.id}

Ver no painel: ${getAppUrl(req)}/admin?tab=payments`
      ).catch(
        (err) => logError("[API] Falha ao notificar admin", err, { paymentId: paymentRecord?.id })
      );
    }
    res.json({
      success: true,
      paymentId: paymentRecord?.id,
      paymentStatus,
      verification: proofVerification ? {
        decision: proofVerification.decision,
        confidence: proofVerification.confidence
      } : null
    });
  } catch (err) {
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : void 0;
    logRouteError(req, err, {
      songRequestId: req.body?.songRequestId,
      userEmail: req.body?.userEmail,
      plan: req.body?.plan,
      errType,
      errMsg: errMsg.slice(0, 500),
      errStack: errStack?.slice(0, 1e3)
    });
    res.status(500).json({ success: false, error: safeMessage2(err) });
  }
});
router2.post("/song/:id/video-upsell-payment", paymentLimiter, async (req, res) => {
  try {
    const { id: requestId } = req.params;
    const validation = validateInput(VideoUpsellPaymentSchema, { ...req.body, songRequestId: requestId });
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Dados de pagamento inv\xE1lidos", validation_errors: validationErrorsArray(validation.errors) });
    }
    const { userEmail, proofBase64, proofFilename, proofMimeType, paymentMethod } = validation.data;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const { data: songRequest } = await supabase.from("song_requests").select("id, status, recipient_name, video_upsell_paid").eq("id", requestId).single();
    if (!songRequest) {
      return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado." });
    }
    if (songRequest.video_upsell_paid) {
      return res.status(409).json({ success: false, error: "O videoclipe j\xE1 foi pago." });
    }
    let proofPath = null;
    let proofUrl = null;
    let proofHash = null;
    if (proofBase64) {
      const resolvedMime = proofMimeType || "application/octet-stream";
      const proofBuffer = decodeBase64Payload(proofBase64);
      if (proofBuffer.length > 10 * 1024 * 1024) throw new Error("Comprovativo demasiado grande. M\xE1x. 10MB.");
      proofHash = createHash("sha256").update(proofBuffer).digest("hex");
      try {
        const { data: hashDupe } = await supabase.from("payments").select("id, request_id, status").eq("proof_hash", proofHash).in("status", ["approved", "pending_verification", "delivered"]).maybeSingle();
        if (hashDupe) {
          logWarn("[API] Video upsell: comprovativo duplicado detetado", { requestId, duplicateOf: hashDupe.request_id, proofHash });
          return res.status(409).json({ success: false, error: "Este comprovativo de pagamento j\xE1 foi utilizado. Envia o comprovativo correto." });
        }
      } catch (dedupErr) {
        logWarn("[API] Video upsell dedup check falhou (schema cache?) \u2014 a ignorar", { requestId, error: dedupErr instanceof Error ? dedupErr.message : String(dedupErr) });
      }
      const sanitizedProofFilename = String(proofFilename || "proof.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `proofs/video_${Date.now()}_${sanitizedProofFilename}`;
      try {
        const uploadedUrl = await uploadFileToStorage("payment-proofs", filename, proofBuffer, resolvedMime);
        proofPath = filename;
        proofUrl = uploadedUrl;
      } catch (err) {
        throw new Error(`Upload do comprovativo falhou: ${err instanceof Error ? err.message : "sem dados"}`);
      }
    }
    const paymentFields = {
      request_id: requestId,
      user_email: userEmail,
      plan: "video_upsell",
      plan_type: "video_upsell",
      amount: 2900,
      amount_kz: 2900,
      payment_method: paymentMethod || "reference",
      proof_url: proofUrl || (proofPath ? `storage:${proofPath}` : null),
      proof_path: proofPath,
      proof_filename: proofFilename || proofPath?.split("/").pop() || null,
      proof_hash: proofHash,
      status: "pending_verification",
      video_upsell: true,
      expires_at: new Date(Date.now() + 15 * 60 * 1e3).toISOString()
    };
    const { data: existingVideoPayment } = await supabase.from("payments").select("id, proof_path").eq("request_id", requestId).maybeSingle();
    let videoPaymentId = null;
    if (existingVideoPayment) {
      const { error: updateErr } = await supabase.from("payments").update({ ...paymentFields, notes: null }).eq("id", existingVideoPayment.id);
      if (updateErr) throw updateErr;
      videoPaymentId = existingVideoPayment.id;
      if (existingVideoPayment.proof_path && proofPath && existingVideoPayment.proof_path !== proofPath) {
        deleteStorageFile("payment-proofs", existingVideoPayment.proof_path).catch(() => {
        });
      }
    } else {
      const { data: newPayment, error: insertErr } = await supabase.from("payments").insert(paymentFields).select("id").single();
      if (insertErr || !newPayment) {
        const insertMsg = String(insertErr?.message || insertErr);
        if (isSchemaCacheError(insertMsg)) {
          logWarn("[API] Video upsell INSERT falhou por schema cache \u2014 retry sem novas colunas", { requestId });
          const fallbackFields = stripSchemaCacheFields(paymentFields);
          const { data: retryPayment, error: retryErr } = await supabase.from("payments").insert(fallbackFields).select("id").single();
          if (retryErr || !retryPayment) throw retryErr || new Error("Failed to insert video upsell payment (fallback)");
          videoPaymentId = retryPayment.id;
        } else {
          throw insertErr || new Error("Failed to insert video upsell payment");
        }
      } else {
        videoPaymentId = newPayment.id;
      }
    }
    const paymentRecord = { id: videoPaymentId };
    sendAdminNotification(
      "Novo pagamento de videoclipe pendente \u{1F3AC}",
      `Cliente: ${userEmail}
Videoclipe: 2.900 Kz
Pedido: ${requestId}
Pagamento: ${paymentRecord.id}

Ver no painel: ${getAppUrl(req)}/admin?tab=payments`
    ).catch(
      (err) => logError("[API] Falha ao notificar admin (video upsell)", err, { paymentId: paymentRecord.id })
    );
    res.json({ success: true, paymentId: paymentRecord?.id });
  } catch (err) {
    logRouteError(req, err, { songRequestId: req.params?.id, userEmail: req.body?.userEmail });
    res.status(500).json({ success: false, error: safeMessage2(err) });
  }
});
function voiceLangFor(language) {
  const langMap = {
    "ingl\xEAs": "en",
    "portugu\xEAs": "pt",
    "kikongo": "kg",
    "lingala": "ln",
    "kimbundu": "pt",
    "umbundu": "pt"
  };
  return langMap[String(language || "portugu\xEAs").trim().toLowerCase()] || "pt";
}
router2.post("/song/voice/validation-phrase", voiceValidationLimiter, async (req, res) => {
  const tempFiles = [];
  try {
    const validation = validateInput(VoiceValidationPhraseSchema, req.body);
    if (!validation.success) {
      return res.status(400).json({ success: false, error: "Dados de valida\xE7\xE3o de voz inv\xE1lidos", validation_errors: validationErrorsArray(validation.errors) });
    }
    const { voiceSampleBase64, voiceSampleMimeType, language } = validation.data;
    const resolvedMime = voiceSampleMimeType || "audio/wav";
    const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
    if (voiceBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: "Amostra de voz demasiado grande. M\xE1x. 5MB." });
    }
    if (voiceBuffer.length < 1024) {
      return res.status(400).json({ success: false, error: "Amostra de voz demasiado pequena. Grava pelo menos 3 segundos." });
    }
    const token = randomUUID2();
    const tempSamplePath = path5.join(os3.tmpdir(), `${token}_sample`);
    const tempWavPath = path5.join(os3.tmpdir(), `${token}_converted.wav`);
    tempFiles.push(tempSamplePath, tempWavPath);
    fs8.writeFileSync(tempSamplePath, voiceBuffer);
    await convertToWav(tempSamplePath, tempWavPath);
    const publicFilename = `sunovoice/phrase_${token}.wav`;
    const publicVoiceUrl = await uploadFileToStorage("preview", publicFilename, tempWavPath, "audio/wav");
    if (!publicVoiceUrl) {
      throw new Error("Falha ao publicar a amostra de voz para valida\xE7\xE3o.");
    }
    logInfo("[Suno Voice] Gerando frase de valida\xE7\xE3o", {
      mime: resolvedMime,
      bytes: voiceBuffer.length,
      language
    });
    const { taskId, phrase } = await getValidationPhrase(publicVoiceUrl, voiceLangFor(language));
    res.json({ success: true, data: { phrase, validationTaskId: taskId } });
  } catch (err) {
    logRouteError(req, err, { language: req.body?.language });
    res.status(500).json({
      success: false,
      error: err instanceof Error && /Suno Voice/.test(err.message) ? "N\xE3o foi poss\xEDvel gerar a frase de valida\xE7\xE3o neste momento. Tenta novamente." : safeMessage2(err)
    });
  } finally {
    for (const f of tempFiles) {
      try {
        fs8.unlinkSync(f);
      } catch {
      }
    }
  }
});
router2.get("/payment-status", paymentStatusLimiter, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const { email, requestId } = req.query;
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Email inv\xE1lido." });
    }
    if (requestId && typeof requestId === "string" && !UUID_REGEX.test(requestId)) {
      return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    }
    let query;
    if (requestId && typeof requestId === "string") {
      query = supabase.from("payments").select("status, created_at, notes, expires_at").eq("request_id", requestId).eq("user_email", email).limit(1).maybeSingle();
    } else {
      query = supabase.from("payments").select("status, created_at, notes, expires_at").eq("user_email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json(data ? { status: data.status, notes: data.notes || null, expires_at: data.expires_at || null } : { status: "not_found" });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage2(err) });
  }
});
router2.get("/latest-song", getSongLimiter, async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indisponivel." });
    const { email } = req.query;
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Email inv\xE1lido." });
    }
    const { data: requestData, error: requestError } = await supabase.from("song_requests").select("*").eq("email", email).eq("status", "lyrics_ready").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (requestError) throw requestError;
    if (!requestData?.id) {
      return res.json({ success: true, found: false });
    }
    const { data: songData, error: songError } = await supabase.from("songs").select("id, title, lyrics, lyrics_snippet, letter_text").eq("request_id", requestData.id).maybeSingle();
    if (songError) throw songError;
    if (!songData?.id) {
      return res.json({ success: true, found: false });
    }
    let lyricsArray = [];
    const rawLyrics = songData.lyrics;
    if (Array.isArray(rawLyrics)) {
      lyricsArray = rawLyrics;
    } else if (typeof rawLyrics === "string" && rawLyrics.trim().startsWith("[")) {
      try {
        lyricsArray = JSON.parse(rawLyrics);
      } catch {
        lyricsArray = rawLyrics.split("\n").filter((l) => l.trim());
      }
    } else if (typeof rawLyrics === "string" && rawLyrics.length > 0) {
      lyricsArray = rawLyrics.split("\n").filter((l) => l.trim());
    }
    res.json({
      success: true,
      found: true,
      dbSongId: songData.id,
      dbSongRequestId: requestData.id,
      songTitle: songData.title,
      lyrics: lyricsArray,
      lyricsSnippet: songData.lyrics_snippet,
      letterText: songData.letter_text,
      photoUrl: requestData.photo_url,
      status: "lyrics_ready"
    });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage2(err) });
  }
});
var socialProofCache = null;
var socialProofCacheAt = 0;
var SOCIAL_PROOF_TTL_MS = 3e4;
function formatFirstName(name) {
  if (!name) return null;
  const first = name.split(" ").filter(Boolean)[0];
  return first || null;
}
async function lookupFirstNameByEmail(supabase, email) {
  if (!email) return null;
  const { data } = await supabase.from("users").select("name").eq("email", email).maybeSingle();
  return formatFirstName(data?.name);
}
function minutesAgo(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 6e4));
}
var EMPTY_SOCIAL_PROOF = {
  createdToday: 0,
  paidToday: 0,
  paidTotal: 0,
  deliveredTotal: 0,
  expressTotal: 0,
  lastPayment: null,
  lastActivity: null
};
router2.get("/social-proof", async (_req, res) => {
  const now = Date.now();
  if (socialProofCache && now - socialProofCacheAt < SOCIAL_PROOF_TTL_MS) {
    return res.json(socialProofCache);
  }
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.json(EMPTY_SOCIAL_PROOF);
    }
    const startOfDay = /* @__PURE__ */ new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayISO = startOfDay.toISOString();
    const [{ count: createdToday }, { count: paidToday }, { count: paidTotal }, { count: deliveredTotal }, { count: expressTotal }] = await Promise.all([
      supabase.from("songs").select("*", { count: "exact", head: true }).gte("created_at", startOfDayISO),
      supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "approved").gte("approved_at", startOfDayISO),
      supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("song_requests").select("*", { count: "exact", head: true }).eq("status", "delivered"),
      supabase.from("payments").select("*", { count: "exact", head: true }).eq("status", "approved").eq("plan", "express")
    ]);
    const { data: lastPaymentRow } = await supabase.from("payments").select("user_email, approved_at, request_id").eq("status", "approved").order("approved_at", { ascending: false }).limit(1).maybeSingle();
    let lastPayment = null;
    if (lastPaymentRow?.approved_at) {
      let style = null;
      if (lastPaymentRow.request_id) {
        const { data: sr } = await supabase.from("song_requests").select("music_style").eq("id", lastPaymentRow.request_id).maybeSingle();
        style = sr?.music_style ?? null;
      }
      lastPayment = {
        firstName: await lookupFirstNameByEmail(supabase, lastPaymentRow.user_email),
        minutesAgo: minutesAgo(lastPaymentRow.approved_at),
        style
      };
    }
    const { data: lastActivityRow } = await supabase.from("song_requests").select("created_at, music_style, users(name)").order("created_at", { ascending: false }).limit(1).maybeSingle();
    let lastActivity = null;
    if (lastActivityRow?.created_at) {
      lastActivity = {
        firstName: formatFirstName(lastActivityRow.users?.name),
        minutesAgo: minutesAgo(lastActivityRow.created_at),
        style: lastActivityRow.music_style ?? null
      };
    }
    const data = {
      createdToday: createdToday || 0,
      paidToday: paidToday || 0,
      paidTotal: paidTotal || 0,
      deliveredTotal: deliveredTotal || 0,
      expressTotal: expressTotal || 0,
      lastPayment,
      lastActivity
    };
    socialProofCache = data;
    socialProofCacheAt = now;
    res.json(data);
  } catch (err) {
    logWarn("[API] Falha ao gerar social proof", err);
    res.json(EMPTY_SOCIAL_PROOF);
  }
});
router2.get("/payment-details", (_req, res) => {
  const referencia = process.env.MULTICAIXA_REFERENCIA || "929423278";
  res.json({
    entidade: process.env.MULTICAIXA_ENTIDADE || "10116",
    referencia,
    expressPhone: process.env.MULTICAIXA_EXPRESS_PHONE || referencia
  });
});
router2.post("/log-error", (req, res) => {
  const { message: m, stack: s, componentStack, url: u, userAgent } = req.body;
  logError(`[ClientError] message="${m}" stack="${(s || "").slice(0, 500)}" componentStack="${(componentStack || "").slice(0, 500)}" url="${u}" ua="${userAgent}"`);
  res.json({ ok: true });
});
router2.get("/song/:id/resume-link", async (req, res) => {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: "Servi\xE7o indispon\xEDvel" });
    }
    const { id } = req.params;
    const { data: request, error } = await supabase.from("song_requests").select("id, email, status, recipient_name").eq("id", id).maybeSingle();
    if (error || !request) {
      return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado" });
    }
    const allowedStatuses = ["lyrics_ready", "payment_submitted", "payment_rejected"];
    if (!allowedStatuses.includes(request.status)) {
      return res.status(400).json({ success: false, error: "Este pedido n\xE3o pode ser retomado no pagamento" });
    }
    const appUrl = getAppUrl(req);
    const resumeUrl = `${appUrl}/wizard?resume=${id}&step=payment`;
    res.json({
      success: true,
      resumeUrl,
      expiresIn: 3600,
      requestId: request.id,
      recipientName: request.recipient_name
    });
  } catch (err) {
    logError("[API] Falha ao gerar resume-link", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});
router2.get("/song/resume-data/:requestId", resumeDataLimiter, async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!UUID_REGEX.test(requestId)) {
      return res.status(400).json({ success: false, error: "ID inv\xE1lido." });
    }
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: "Servi\xE7o indispon\xEDvel" });
    }
    const { data: requestData, error } = await supabase.from("song_requests").select("*, songs(id, title, lyrics, lyrics_snippet, letter_text), users(name)").eq("id", requestId).maybeSingle();
    if (error || !requestData) {
      return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado" });
    }
    const allowedStatuses = ["lyrics_ready", "payment_submitted", "payment_rejected"];
    if (!allowedStatuses.includes(requestData.status)) {
      return res.status(400).json({ success: false, error: "Este pedido j\xE1 n\xE3o pode ser retomado." });
    }
    const song = Array.isArray(requestData.songs) ? requestData.songs[0] : requestData.songs;
    const lyrics = Array.isArray(song?.lyrics) ? song.lyrics : [];
    const resumeData = {
      formData: {
        userNick: requestData.users?.name || "",
        recipientName: requestData.recipient_name || "",
        recipientGender: requestData.recipient_gender || "Masculino",
        recipientRelation: requestData.relationship || "",
        recipientNick: requestData.recipient_nick || "",
        occasion: requestData.occasion || "",
        whyCreatedToday: requestData.why_created_today || "",
        musicStyle: requestData.music_style || "",
        referenceArtist: requestData.reference_artist || "",
        voiceType: requestData.voice_type || "",
        whatMakesSpecial: requestData.special_traits || "",
        onlySheDoes: requestData.only_she_does || "",
        unforgettableMemory: requestData.memory || "",
        whereItHappened: requestData.where_it_happened || "",
        messageFromTheHeart: requestData.heart_message || "",
        desiredEmotion: requestData.desired_emotion || "",
        hookPhrase: requestData.hook_phrase || "",
        photoUrl: requestData.photo_url || "",
        email: requestData.email || "",
        phone: requestData.phone || "",
        language: requestData.language || "portugu\xEAs"
      },
      aiSongTitle: song?.title || "",
      aiLyrics: lyrics,
      aiLyricsSnippet: song?.lyrics_snippet || "",
      aiLetterText: song?.letter_text || "",
      dbSongId: song?.id || "",
      dbSongRequestId: requestData.id,
      status: requestData.status
    };
    logInfo("[API] Resume data fetched", { requestId, status: requestData.status, hasPhoto: !!resumeData.formData.photoUrl });
    res.json({ success: true, data: resumeData });
  } catch (err) {
    logError("[API] Falha ao obter resume data", err, { requestId: req.params.requestId });
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});
router2.post("/song/recover-by-email", recoverByEmailLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ success: false, error: "Email inv\xE1lido." });
    }
    const supabase = getAdminSupabase();
    if (!supabase) {
      return res.status(503).json({ success: false, error: "Servi\xE7o indispon\xEDvel" });
    }
    const { data, error } = await supabase.from("song_requests").select("id, email, status, recipient_name, created_at").eq("email", email).in("status", ["lyrics_ready", "lyrics_generating", "payment_rejected"]).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) {
      return res.status(404).json({ success: false, error: "N\xE3o encontr\xE1mos nenhuma m\xFAsica para esse email." });
    }
    if (data.status === "lyrics_generating") {
      return res.json({
        success: true,
        status: data.status,
        message: "A tua m\xFAsica ainda est\xE1 a ser gerada. Volta mais tarde e tenta de novo."
      });
    }
    const appUrl = getAppUrl(req);
    const resumeUrl = `${appUrl}/wizard?resume=${data.id}&step=payment`;
    logInfo("[API] Recover-by-email ok", { email, status: data.status, requestId: data.id });
    res.json({
      success: true,
      status: data.status,
      resumeUrl,
      requestId: data.id,
      recipientName: data.recipient_name || ""
    });
  } catch (err) {
    logError("[API] Falha no recover-by-email", err);
    res.status(500).json({ success: false, error: "Erro interno" });
  }
});
router2.post("/song/:id/voice-sample", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: "ID de pedido inv\xE1lido." });
    }
    const { voiceSampleBase64, voiceSampleFilename, voiceSampleMimeType, voiceFreeSampleBase64, voiceFreeSampleFilename, voiceFreeSampleMimeType, email } = req.body;
    if (!voiceSampleBase64 || typeof voiceSampleBase64 !== "string") {
      return res.status(400).json({ success: false, error: "Amostra de voz em falta." });
    }
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: "Banco de dados indispon\xEDvel." });
    const { data: requestData, error: reqError } = await supabase.from("song_requests").select("id, status, email, voice_sample_url").eq("id", id).single();
    if (reqError || !requestData) {
      return res.status(404).json({ success: false, error: "Pedido n\xE3o encontrado." });
    }
    if (email && requestData.email && email.toLowerCase() !== requestData.email.toLowerCase()) {
      return res.status(403).json({ success: false, error: "Email n\xE3o corresponde ao pedido." });
    }
    if (requestData.voice_sample_url) {
      return res.status(409).json({ success: false, error: "J\xE1 existe uma amostra de voz registada. Contacte o suporte para substituir." });
    }
    const ALLOWED_VOICE_MIMES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/ogg", "audio/x-wav", "audio/webm"];
    const resolvedVoiceMime = voiceSampleMimeType || "audio/wav";
    if (!ALLOWED_VOICE_MIMES.includes(resolvedVoiceMime)) {
      return res.status(400).json({ success: false, error: "Formato de \xE1udio inv\xE1lido. Apenas WAV, MP3, MP4 ou OGG." });
    }
    const voiceBuffer = decodeBase64Payload(voiceSampleBase64);
    if (voiceBuffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: "Amostra de voz demasiado grande. M\xE1x. 5MB." });
    }
    if (voiceBuffer.length < 1024) {
      return res.status(400).json({ success: false, error: "Amostra de voz demasiado pequena. Grava pelo menos 3 segundos." });
    }
    const sanitizedVoiceFilename = String(voiceSampleFilename || "sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `voices/${Date.now()}_${sanitizedVoiceFilename}`;
    await uploadFileToStorage("voice-samples", filename, voiceBuffer, resolvedVoiceMime);
    let freeFilename = null;
    if (voiceFreeSampleBase64 && typeof voiceFreeSampleBase64 === "string") {
      const resolvedFreeMime = voiceFreeSampleMimeType || "audio/wav";
      if (ALLOWED_VOICE_MIMES.includes(resolvedFreeMime)) {
        const freeBuffer = decodeBase64Payload(voiceFreeSampleBase64);
        if (freeBuffer.length <= 5 * 1024 * 1024 && freeBuffer.length >= 1024) {
          const sanitizedFreeFilename = String(voiceFreeSampleFilename || "free_sample.wav").replace(/[^a-zA-Z0-9._-]/g, "_");
          freeFilename = `voices/${Date.now()}_free_${sanitizedFreeFilename}`;
          try {
            await uploadFileToStorage("voice-samples", freeFilename, freeBuffer, resolvedFreeMime);
          } catch (err) {
            logError("[API] Upload da amostra de voz livre falhou (post-payment)", err, { freeFilename });
            freeFilename = null;
          }
        }
      }
    }
    const voiceUpdates = { voice_sample_url: filename };
    if (freeFilename) voiceUpdates.voice_free_sample_url = freeFilename;
    const { error: updateError } = await supabase.from("song_requests").update(voiceUpdates).eq("id", id);
    if (updateError) throw updateError;
    logInfo("[API] Voice sample received post-payment", { requestId: id, mime: resolvedVoiceMime, bytes: voiceBuffer.length });
    res.json({ success: true, message: "Amostra de voz recebida com sucesso. A clonagem ser\xE1 processada na aprova\xE7\xE3o do pagamento." });
  } catch (err) {
    logRouteError(req, err);
    res.status(500).json({ success: false, error: safeMessage2(err) });
  }
});
router2.get("/config", (_req, res) => {
  res.set("Cache-Control", "public, max-age=3600, must-revalidate");
  res.json({
    success: true,
    features: {
      lyricsTeaser: process.env.VITE_ENABLE_LYRICS_TEASER === "true"
    }
  });
});
var public_default = router2;

// server/routes/webhook.ts
init_supabase();
init_logger();
import express3 from "express";
import { timingSafeEqual as timingSafeEqual2 } from "crypto";
var router3 = express3.Router();
var CRITICAL_EVENTS = ["hardBounce", "blocked", "spam", "invalid"];
router3.post("/webhooks/brevo", async (req, res) => {
  res.status(200).json({ received: true });
  const payload = req.body;
  const event = payload.event;
  const email = payload.email;
  if (!event || !email) {
    logWarn("[Brevo Webhook] Payload sem event ou email", { payload });
    return;
  }
  const messageId = payload["message-id"] || payload.messageId || null;
  logInfo("[Brevo Webhook] Evento recebido", { event, email, messageId });
  const supabase = getAdminSupabase();
  if (!supabase) {
    logError("[Brevo Webhook] Supabase n\xE3o dispon\xEDvel");
    return;
  }
  const { error: insertError } = await supabase.from("email_events").insert({
    event,
    recipient_email: email,
    message_id: messageId,
    reason: payload.reason || null,
    subject: payload.subject || null,
    raw_payload: payload
  }).maybeSingle();
  if (insertError) {
    logError("[Brevo Webhook] Erro ao inserir evento", insertError, { event, email });
  }
  if (CRITICAL_EVENTS.includes(event)) {
    logWarn("[Brevo Webhook] Evento cr\xEDtico", { event, email, reason: payload.reason, messageId });
  }
});
var WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
router3.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && typeof token === "string" && typeof WHATSAPP_WEBHOOK_VERIFY_TOKEN === "string" && WHATSAPP_WEBHOOK_VERIFY_TOKEN.length > 0 && token.length === WHATSAPP_WEBHOOK_VERIFY_TOKEN.length && timingSafeEqual2(Buffer.from(token), Buffer.from(WHATSAPP_WEBHOOK_VERIFY_TOKEN)) && typeof challenge === "string") {
    logInfo("[WhatsApp Webhook] Verifica\xE7\xE3o aceite");
    res.status(200).send(challenge);
  } else {
    logWarn("[WhatsApp Webhook] Verifica\xE7\xE3o falhada");
    res.status(403).send("Verification failed");
  }
});
router3.post("/webhooks/whatsapp", async (req, res) => {
  res.status(200).json({ received: true });
  try {
    const wa = await Promise.resolve().then(() => (init_whatsapp(), whatsapp_exports));
    await wa.handleDeliveryWebhook(req.body);
  } catch (err) {
    logError("[WhatsApp Webhook] Erro ao processar payload", err instanceof Error ? err : new Error(String(err)));
  }
});
var webhook_default = router3;

// server/config/app.ts
init_deepseekConfig();

// server/services/aiHealth.ts
init_deepseekConfig();
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 5 * 60 * 1e3;
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}
function fmtError(err) {
  return err instanceof Error ? err.message : String(err);
}
async function checkDeepSeekCredits(now = /* @__PURE__ */ new Date()) {
  return cached("deepseek-credits", async () => {
    const apiKey = getDeepSeekApiKey();
    if (!apiKey) {
      return { ok: false, error: "chave em falta", lastCheck: now.toISOString() };
    }
    try {
      const res = await fetch("https://api.deepseek.com/user/balance", {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      const data = await res.json();
      const balanceInfos = Array.isArray(data?.balance_infos) ? data.balance_infos : [];
      const usd = balanceInfos.find((b) => String(b.currency || "").toUpperCase() === "USD") || balanceInfos[0];
      const totalBalance = Number(usd?.total_balance ?? usd?.granted_balance ?? 0);
      return {
        ok: true,
        currency: usd?.currency || "USD",
        total_balance: totalBalance,
        low: totalBalance < 1,
        lastCheck: now.toISOString()
      };
    } catch (err) {
      return { ok: false, error: fmtError(err), lastCheck: now.toISOString() };
    }
  });
}
async function checkGeminiCredits(now = /* @__PURE__ */ new Date()) {
  return cached("gemini-credits", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "chave em falta", lastCheck: now.toISOString() };
    }
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(5e3)
      });
      if (res.status === 429 || res.status === 403) {
        return { ok: true, quota_exceeded: true, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      if (!res.ok) {
        return { ok: false, error: `HTTP ${res.status}`, lastCheck: now.toISOString() };
      }
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const found = models.some((m) => String(m?.name || "").includes(model.split("-")[0]));
      return {
        ok: true,
        model,
        available: found,
        lastCheck: now.toISOString()
      };
    } catch (err) {
      return { ok: false, error: fmtError(err), lastCheck: now.toISOString() };
    }
  });
}

// server/services/deliveryScheduler.ts
init_supabase();
init_email();
init_helpers();
init_logger();
init_whatsapp();
var INTERVAL_MS = 10 * 60 * 1e3;
var FEEDBACK_INTERVAL_MS = 60 * 60 * 1e3;

// server/services/abandonedRecoveryScheduler.ts
init_supabase();
init_email();
init_whatsapp();
init_whatsappTemplates();
init_abandonedMessages();
init_logger();
init_helpers();
var INTERVAL_MS2 = 10 * 60 * 1e3;
var REJECTED_REMINDER_DELAY_MS = 24 * 60 * 60 * 1e3;

// server/services/followUpScheduler.ts
init_supabase();
init_email();
init_helpers();
init_logger();
var INTERVAL_MS3 = 10 * 60 * 1e3;

// server/services/failedLyricsRecoveryScheduler.ts
init_supabase();
init_ai();
init_email();
init_logger();
var INTERVAL_MS4 = 10 * 60 * 1e3;
var RECOVERY_WINDOW_MS = 48 * 60 * 60 * 1e3;

// server/services/stuckMusicRecoveryScheduler.ts
init_supabase();
init_logger();
var INTERVAL_MS5 = 5 * 60 * 1e3;
var STALE_THRESHOLD_MS = Number(process.env.STUCK_RECOVERY_THRESHOLD_MS || 15 * 60 * 1e3);

// server/config/app.ts
var sentryDsn = getEnv("SENTRY_DSN");
async function createApp() {
  validateEnv();
  const app = express4();
  app.set("trust proxy", 1);
  const isVercel2 = !!process.env.VERCEL;
  if (!isVercel2) {
    app.use(express4.json({ limit: "1mb" }));
    app.use(express4.urlencoded({ extended: false, limit: "1mb" }));
  }
  app.use(requestIdMiddleware);
  app.use(corsMiddleware);
  app.use(helmetMiddleware());
  app.use(permissionsPolicyMiddleware);
  app.use(csrfProtection);
  app.use(httpLogger);
  app.get("/health", async (_req, res) => {
    const checks = {};
    const startTime = Date.now();
    try {
      const supabase = getAdminSupabase();
      if (supabase) {
        const { error } = await supabase.from("song_requests").select("id").limit(1).maybeSingle();
        checks.supabase = error ? `erro: ${error.message}` : "ok";
      } else {
        checks.supabase = "n\xE3o configurado";
      }
    } catch (e) {
      checks.supabase = `erro: ${e instanceof Error ? e.message : "desconhecido"}`;
    }
    checks.storage = `${getEnv("STORAGE_PROVIDER", "r2")} (bucket: ${getEnv("R2_BUCKET_NAME", "?")})`;
    checks.r2Vars = [
      getEnv("R2_ACCOUNT_ID") ? "account" : null,
      getEnv("R2_ACCESS_KEY_ID") ? "access" : null,
      getEnv("R2_SECRET_ACCESS_KEY") ? "secret" : null,
      getEnv("R2_BUCKET_NAME") ? "bucket" : null,
      getEnv("R2_PUBLIC_DOMAIN") ? "domain" : null
    ].filter(Boolean).join(",") || "nenhuma";
    const [deepseek, gemini] = await Promise.all([
      checkDeepSeekCredits(),
      checkGeminiCredits()
    ]);
    checks.deepseek = deepseek.ok ? "ok" : `erro: ${String(deepseek.error || "desconhecido")}`;
    checks.gemini = gemini.quota_exceeded ? "quota excedida (429/403)" : gemini.ok ? "ok" : `erro: ${String(gemini.error || "desconhecido")}`;
    const mem = process.memoryUsage();
    const isCi = process.env.CI === "true";
    const allOk = checks.supabase === "ok" || isCi;
    res.status(200).json({
      status: allOk ? "ok" : "degradado",
      uptime: process.uptime(),
      responseTime: `${Date.now() - startTime}ms`,
      ci: isCi || void 0,
      checks,
      ai: { deepseek, gemini },
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`
      },
      env: {
        node: process.version,
        platform: process.platform,
        sentry: !!getEnv("SENTRY_DSN"),
        suno: !!getEnv("SUNO_API_KEY"),
        anthropic: !!getEnv("ANTHROPIC_API_KEY"),
        openai: !!getEnv("OPENAI_API_KEY"),
        gemini: !!getEnv("GEMINI_API_KEY"),
        deepseek: hasDeepSeekApiKey(),
        supabase: !!getEnv("SUPABASE_URL"),
        brevo: !!getEnv("BREVO_API_KEY"),
        adminPassword: !!getEnv("ADMIN_PASSWORD"),
        jwtSecret: !!getEnv("JWT_SECRET"),
        multicaixa: !!getEnv("MULTICAIXA_ENTIDADE") && !!getEnv("MULTICAIXA_REFERENCIA"),
        whatsapp: !!getEnv("WHATSAPP_API_TOKEN") && !!getEnv("WHATSAPP_PHONE_NUMBER_ID")
      }
    });
  });
  app.use("/api/admin", adminIpRestriction, admin_default);
  app.use("/api", public_default);
  app.use("/api", webhook_default);
  if (sentryDsn) {
    const { setupExpressErrorHandler } = await import("@sentry/node");
    setupExpressErrorHandler(app);
  }
  app.use(errorHandler);
  return app;
}

// api/vercel-entry.ts
if (process.env.SENTRY_DSN) {
  (async () => {
    try {
      const { init } = await import("@sentry/node");
      init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "production",
        tracesSampleRate: 0.1
      });
    } catch (err) {
      console.warn("[WARN] Erro ao inicializar Sentry (ignorando para manter o servidor ativo):", err);
    }
  })();
}
console.log("[Vercel] Starting serverless function...");
console.log("[Vercel] Environment:", process.env.NODE_ENV);
console.log("[Vercel] VERCEL:", process.env.VERCEL);
var appPromise = createApp().catch((err) => {
  console.error("[Vercel] Failed to create app:", err);
  throw err;
});
var vercel_entry_default = async (req, res) => {
  console.log("[Vercel] Request received:", req.method, req.url);
  try {
    const app = await appPromise;
    console.log("[Vercel] App ready, handling request");
    return app(req, res);
  } catch (err) {
    console.error("[Vercel] Error in serverless function:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
export {
  vercel_entry_default as default
};
//# sourceMappingURL=index.js.map
