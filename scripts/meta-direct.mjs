/**
 * Meta Ads — utilitário direto (Graph API v23.0).
 *
 * Ações:
 *   node scripts/meta-direct.mjs create-retargeting           # dry-run (imprime payloads)
 *   node scripts/meta-direct.mjs create-retargeting --live    # cria audiências + campanha + adset (PAUSED)
 *   node scripts/meta-direct.mjs verify [dias]                # insights cold + CPA por ad (default 3)
 *   node scripts/meta-direct.mjs pause <ad_id|adset_id>       # pausa ad/adset
 *   node scripts/meta-direct.mjs attribution                  # mostra attribution_spec do adset cold
 *   node scripts/meta-direct.mjs exclude-buyers               # dry-run: mostra o targeting novo
 *   node scripts/meta-direct.mjs exclude-buyers --live        # aplica "EXCL - Compradores 180d" ao adset RT e ao cold (deixa RT PAUSED)
 *
 * Env: META_ACCESS_TOKEN (e META_PIXEL_ID opcional) em .env
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const fileEnv = loadEnv(path.join(ROOT, ".env"));
const token = process.env.META_ACCESS_TOKEN || fileEnv.META_ACCESS_TOKEN;
const PIXEL_ID =
  process.env.META_PIXEL_ID || fileEnv.META_PIXEL_ID || "1928777041139855";

if (!token) {
  console.error("META_ACCESS_TOKEN em falta (.env ou env)");
  process.exit(1);
}

const API_VERSION = "v23.0";
// Campo `targeting.excluded_custom_audiences` só existe a partir da v22 — a
// escrita foi verificada (POST + read-back) em v25.0, por isso usa-se aqui.
const EXCLUSION_API_VERSION = "v25.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const AD_ACCOUNT = "act_3968691273389952";
const PAGE_ID = "1186144217916410"; // SeuBeat
const COLD_CAMPAIGN_ID = "120248973060170708";
const COLD_ADSET_ID = "120248973060180708";

const CAMPAIGN_NAME = "SeuBeat_Retargeting";
const ADSET_NAME = "rt_checkout_14d";
const RT_CAMPAIGN_ID = "120250568225420708";
const RT_ADSET_ID = "120250568232860708";
const BUYERS_EXCL_AUD_ID = "120250568225030708";
const BUYERS_EXCL_NAME = "EXCL - Compradores 180d";
const DAILY_BUDGET_CENTS = 200; // $2.00

const ATTRIBUTION = [
  { event_type: "CLICK_THROUGH", window_days: 7 },
  { event_type: "VIEW_THROUGH", window_days: 1 },
  { event_type: "ENGAGED_VIDEO_VIEW", window_days: 1 },
];

const LIVE = process.argv.includes("--live");
const action = process.argv[2];

async function api(endpoint, method = "GET", body, version = API_VERSION) {
  const base = GRAPH.replace(API_VERSION, version);
  const doFetch = async () => {
    const opts = {
      method,
      headers: { Authorization: `Bearer ${token}` },
    };
    if (body) {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(body)) {
        if (v === undefined || v === null) continue;
        p.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
      opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
      opts.body = p.toString();
    }
    const res = await fetch(`${base}/${endpoint}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      const errData =
        data?.error?.error_user_msg || data?.error?.error_user_title || "";
      const err = new Error(
        `${method} ${endpoint} -> HTTP ${res.status}: ${msg}${errData ? ` | ${errData}` : ""} | body=${JSON.stringify(body || {}).slice(0, 800)} | resp=${JSON.stringify(data).slice(0, 800)}`
      );
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  };
  // retry rate-limit (613/17) com espera
  for (let i = 0; i < 4; i++) {
    try {
      return await doFetch();
    } catch (e) {
      const code = e?.data?.error?.code;
      const isRate = code === 613 || code === 17 || code === 4 || code === 80004;
      if (!isRate || i === 3) throw e;
      const wait = 31000 * (i + 1);
      console.log(`  [rate-limit ${code}] aguardo ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

// ── Website Custom Audience rules ──────────────────────────────────────────

function eventRule(events, retentionDays) {
  const retention = retentionDays * 24 * 60 * 60;
  const src = [{ type: "pixel", id: Number(PIXEL_ID) }];
  return {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: src,
          retention_seconds: retention,
          filter: {
            operator: "or",
            filters: events.map((e) => ({
              field: "event",
              operator: "eq",
              value: e,
            })),
          },
          template: "ALL_VISITORS",
        },
      ],
    },
  };
}

function allVisitorsRule(retentionDays) {
  const retention = retentionDays * 24 * 60 * 60;
  return {
    inclusions: {
      operator: "or",
      rules: [
        {
          event_sources: [{ type: "pixel", id: Number(PIXEL_ID) }],
          retention_seconds: retention,
          filter: {
            operator: "and",
            filters: [{ field: "url", operator: "i_contains", value: "" }],
          },
          template: "ALL_VISITORS",
        },
      ],
    },
  };
}

const AUDIENCES = [
  {
    key: "checkout14",
    name: "RT - Checkout 14d",
    subtype: "WEBSITE",
    build: () => eventRule(["InitiateCheckout"], 14),
  },
  {
    key: "leads30",
    name: "RT - LeadWizard 30d",
    subtype: "WEBSITE",
    build: () => eventRule(["Lead", "CompleteRegistration"], 30),
  },
  {
    key: "buyers180",
    name: "EXCL - Compradores 180d",
    subtype: "WEBSITE",
    build: () => eventRule(["Purchase"], 180),
  },
  {
    key: "visitors30",
    name: "RT - Visitantes 30d",
    subtype: "WEBSITE",
    build: () => allVisitorsRule(30),
  },
];

async function listOrThrow(endpoint) {
  // não engole erros de rate-limit — senão cria duplicados
  return api(endpoint);
}

async function findAudienceByName(name) {
  try {
    const r = await listOrThrow(
      `${AD_ACCOUNT}/customaudiences?fields=id,name,subtype&limit=100`
    );
    return (r.data || []).find((a) => a.name === name) || null;
  } catch (e) {
    if (e.status === 400 || String(e.message).includes("limit")) throw e;
    return null;
  }
}

async function ensureAudience(spec) {
  const existing = await findAudienceByName(spec.name);
  if (existing) {
    console.log(`  [reuse] ${spec.name} → ${existing.id}`);
    return existing.id;
  }
  const rule = spec.build();
  if (!LIVE) {
    console.log(`  [dry-run] criaria audiência "${spec.name}"`);
    console.log(JSON.stringify(rule, null, 2));
    return `dry_${spec.key}`;
  }
  try {
    const r = await api(`${AD_ACCOUNT}/customaudiences`, "POST", {
      name: spec.name,
      subtype: spec.subtype,
      rule: rule,
      description: "SeuBeat RT auto-created",
    });
    console.log(`  [create] ${spec.name} → ${r.id}`);
    return r.id;
  } catch (e) {
    // fallback 1: sem subtype (API v23 pode rejeitar o campo)
    try {
      const r = await api(`${AD_ACCOUNT}/customaudiences`, "POST", {
        name: spec.name,
        rule: rule,
        description: "SeuBeat RT auto-created",
      });
      console.log(`  [create-no-subtype] ${spec.name} → ${r.id}`);
      return r.id;
    } catch (e2) {
      // fallback 2: rule no formato antigo (operator no topo)
      try {
        const r = await api(`${AD_ACCOUNT}/customaudiences`, "POST", {
          name: spec.name,
          subtype: spec.subtype,
          rule: rule.inclusions,
          operator: "OR",
        });
        console.log(`  [create-fallback] ${spec.name} → ${r.id}`);
        return r.id;
      } catch (e3) {
        console.error(`  [FAIL] ${spec.name}: ${e.message}`);
        console.error(`         no-subtype: ${e2.message}`);
        console.error(`         legacy: ${e3.message}`);
        return null;
      }
    }
  }
}

async function findCampaignByName(name) {
  try {
    const r = await listOrThrow(
      `${AD_ACCOUNT}/campaigns?fields=id,name,status,daily_budget&limit=100`
    );
    return (r.data || []).find((c) => c.name === name) || null;
  } catch (e) {
    if (String(e.message).includes("limit") || e.status === 613) throw e;
    return null;
  }
}

async function findAdsetByName(name) {
  try {
    const r = await listOrThrow(
      `${AD_ACCOUNT}/adsets?fields=id,name,status,daily_budget&limit=100`
    );
    return (r.data || []).find((a) => a.name === name) || null;
  } catch (e) {
    if (String(e.message).includes("limit") || e.status === 613) throw e;
    return null;
  }
}

async function ensureCampaign() {
  const existing = await findCampaignByName(CAMPAIGN_NAME);
  if (existing) {
    console.log(`  [reuse] campanha → ${existing.id} status=${existing.status}`);
    return existing.id;
  }
  const payload = {
    name: CAMPAIGN_NAME,
    status: "PAUSED",
    objective: "OUTCOME_SALES",
    buying_type: "AUCTION",
    special_ad_categories: [],
    daily_budget: DAILY_BUDGET_CENTS,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
  };
  if (!LIVE) {
    console.log("  [dry-run] criaria campanha:");
    console.log(JSON.stringify(payload, null, 2));
    return "dry_campaign";
  }
  const r = await api(`${AD_ACCOUNT}/campaigns`, "POST", payload);
  console.log(`  [create] campanha → ${r.id}`);
  return r.id;
}

async function ensureAdset(campaignId, includeAudienceId, excludeAudienceId) {
  const existing = await findAdsetByName(ADSET_NAME);
  if (existing) {
    console.log(`  [reuse] adset → ${existing.id} status=${existing.status}`);
    return existing.id;
  }
  const targeting = {
    geo_locations: {
      countries: ["AO"],
      location_types: ["home", "recent"],
    },
    age_min: 22,
    age_max: 65,
    brand_safety_content_filter_levels: [
      "FACEBOOK_RELAXED",
      "AN_RELAXED",
    ],
  };
  if (includeAudienceId && !String(includeAudienceId).startsWith("dry_")) {
    targeting.custom_audiences = [{ id: includeAudienceId }];
  }
  if (excludeAudienceId && !String(excludeAudienceId).startsWith("dry_")) {
    // v22+ removeu `exclusions.custom_audiences` (erro #1487916/#1870221)
    targeting.excluded_custom_audiences = [excludeAudienceId];
  }

  const payload = {
    name: ADSET_NAME,
    campaign_id: campaignId,
    status: "PAUSED",
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    attribution_spec: ATTRIBUTION,
    promoted_object: {
      pixel_id: PIXEL_ID,
      custom_event_type: "PURCHASE",
      smart_pse_enabled: false,
    },
    targeting,
  };

  if (!LIVE) {
    console.log("  [dry-run] criaria adset:");
    console.log(JSON.stringify(payload, null, 2));
    return "dry_adset";
  }
  try {
    const r = await api(`${AD_ACCOUNT}/adsets`, "POST", payload);
    console.log(`  [create] adset → ${r.id}`);
    return r.id;
  } catch (e) {
    console.warn(`  [retry 1] sem custom_audiences… (${e.message.slice(0, 120)})`);
    const t2 = { ...targeting };
    delete t2.custom_audiences;
    try {
      const r = await api(`${AD_ACCOUNT}/adsets`, "POST", {
        ...payload,
        targeting: t2,
      });
      console.log(
        `  [create] adset (sem incl. audience — anexar na UI) → ${r.id}`
      );
      console.warn(
        `  ATENÇÃO: anexar audiência "RT - Checkout 14d" no Ads Manager.`
      );
      return r.id;
    } catch (e2) {
      console.warn(`  [retry 2] sem exclusions também… (${e2.message.slice(0, 120)})`);
      const t3 = { ...t2 };
      delete t3.excluded_custom_audiences;
      try {
        const r = await api(`${AD_ACCOUNT}/adsets`, "POST", {
          ...payload,
          targeting: t3,
        });
        console.log(
          `  [create] adset mínimo → ${r.id} — anexar inclusão+exclusão na UI`
        );
        return r.id;
      } catch (e3) {
        console.error(`  [FAIL] adset: ${e3.message}`);
        throw e3;
      }
    }
  }
}

async function createRetargeting() {
  console.log(
    `\n=== create-retargeting (${LIVE ? "LIVE" : "DRY-RUN"}) ===`
  );
  console.log(
    `conta=${AD_ACCOUNT} pixel=${PIXEL_ID} budget=$${DAILY_BUDGET_CENTS / 100}/dia\n`
  );

  const cold = await api(
    `${COLD_CAMPAIGN_ID}?fields=id,name,status,daily_budget`
  ).catch(() => null);
  if (cold)
    console.log(
      `cold intact: ${cold.name} status=${cold.status} budget=${cold.daily_budget}\n`
    );

  console.log("1) Audiências:");
  const ids = {};
  for (const spec of AUDIENCES) {
    ids[spec.key] = await ensureAudience(spec);
  }

  console.log("\n2) Campanha:");
  const campaignId = await ensureCampaign();

  console.log("\n3) Adset:");
  const adsetId = await ensureAdset(
    campaignId,
    ids.checkout14,
    ids.buyers180
  );

  console.log("\n=== RESUMO ===");
  console.log(
    JSON.stringify(
      {
        live: LIVE,
        campaign: {
          name: CAMPAIGN_NAME,
          id: campaignId,
          status: "PAUSED",
          daily_budget_usd: 2,
        },
        adset: {
          name: ADSET_NAME,
          id: adsetId,
          status: "PAUSED",
          attribution: "7d click / 1d view",
        },
        audiences: ids,
        next_steps: [
          "Abrir Ads Manager → campanha SeuBeat_Retargeting",
          "No adset rt_checkout_14d → criar ANÚNCIO com criativo (vídeo/foto)",
          "Copy: 'A tua música está quase pronta — falta só o pagamento. Continua onde paraste.'",
          "CTA → https://seubeat.onrender.com/wizard",
          "Só publicar (toggle ACTIVE) quando o criativo estiver ok",
          "Regra: CPA 7d > $6.50 com >$10 gastos → pausar",
        ],
      },
      null,
      2
    )
  );
}

// ── verify: insights cold N dias ───────────────────────────────────────────

async function verify(daysArg) {
  const days = Number(daysArg) || 3;
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);
  console.log(
    `\n=== verify cold SeuBeat_teste — ${since} → ${until} (${days}d) ===`
  );

  const camp = await api(
    `${COLD_CAMPAIGN_ID}?fields=id,name,status,daily_budget`
  );
  console.log(
    `campanha: ${camp.name} status=${camp.status} budget=$${Number(camp.daily_budget) / 100}/dia`
  );

  const level = process.argv[4] || "ad";
  const fields =
    "ad_name,adset_name,spend,impressions,clicks,actions,cost_per_action_type,ctr,cpc,cpm,inline_link_clicks";
  const insights = await api(
    `${COLD_CAMPAIGN_ID}/insights?date_preset=last_${days}d&level=${level}&limit=50&fields=${fields}`
  ).catch(async (e) => {
    console.warn(
      `insights campaign level=${level} falhou (${e.message}); retry adset`
    );
    return api(
      `${COLD_ADSET_ID}/insights?date_preset=last_${days}d&level=${level}&limit=50&fields=${fields}`
    );
  });

  const rows = insights.data || [];
  console.log(`\nlevel=${level} rows=${rows.length}`);
  console.log(
    "name".padEnd(36) +
      "spend".padStart(9) +
      "impr".padStart(9) +
      "pur".padStart(5) +
      "CPA".padStart(8) +
      "CTR".padStart(8)
  );
  let totalSpend = 0;
  let totalPur = 0;
  for (const r of rows) {
    const spend = Number(r.spend || 0);
    const pur =
      (r.actions || []).find(
        (a) => a.action_type === "offsite_conversion.fb_pixel_purchase"
      )?.value || 0;
    const cpa = pur > 0 ? spend / Number(pur) : null;
    const name = (r.ad_name || r.adset_name || "-").slice(0, 34);
    totalSpend += spend;
    totalPur += Number(pur);
    console.log(
      name.padEnd(36) +
        spend.toFixed(2).padStart(9) +
        String(r.impressions || 0).padStart(9) +
        String(pur).padStart(5) +
        (cpa ? `$${cpa.toFixed(2)}` : "—").padStart(8) +
        (r.ctr ? `${Number(r.ctr).toFixed(2)}%` : "—").padStart(8)
    );
  }
  const gcpa = totalPur > 0 ? totalSpend / totalPur : null;
  console.log(
    "TOTAL".padEnd(36) +
      totalSpend.toFixed(2).padStart(9) +
      "".padStart(9) +
      String(totalPur).padStart(5) +
      (gcpa ? `$${gcpa.toFixed(2)}` : "—").padStart(8)
  );
  console.log(
    `\nregra freio: pausar ad se CPA > $6.50 e spend > $15 · break-even ~$7.29`
  );
}

// ── pause ──────────────────────────────────────────────────────────────────

async function pauseTarget(id) {
  if (!id || id.startsWith("-")) {
    console.error("Uso: node scripts/meta-direct.mjs pause <ad_id|adset_id>");
    process.exit(1);
  }
  const info = await api(
    `${id}?fields=id,name,status,object_story_spec,adset_id`
  ).catch(() => null);
  console.log(
    `antes: ${info?.name || id} status=${info?.status || "?"} object=${info?.object_story_spec ? "ad" : "unknown"}`
  );
  const r = await api(id, "POST", { status: "PAUSED" });
  console.log(`→ PAUSED ok (id=${r.success ? id : JSON.stringify(r)})`);
}

// ── attribution ────────────────────────────────────────────────────────────

async function showAttribution() {
  const adset = await api(
    `${COLD_ADSET_ID}?fields=id,name,status,attribution_spec,daily_budget,optimization_goal`
  );
  console.log(JSON.stringify(adset, null, 2));
  console.log(
    `\n(alterar: node scripts/meta-direct.mjs attribution --live  — mantém 7d click/1d view por defeito)`
  );
  if (LIVE) {
    const r = await api(COLD_ADSET_ID, "POST", {
      attribution_spec: ATTRIBUTION,
    });
    console.log("attribution atualizado:", r);
  }
}

// ── exclude-buyers: EXCL - Compradores 180d como exclusão ──────────────────
// Meta (v22+, jan/2025) REMOVEU `targeting.exclusions.custom_audiences` —
// daí o erro #1487916 "públicos duplicados" / #1870221. O campo atual é
// `targeting.excluded_custom_audiences` (docs: Advanced Targeting).
// A escrita é confirmada pela leitura de `targeting.excluded_custom_audiences`.

const EXCLUDE_TARGETS = [
  { label: "RT rt_checkout_14d", id: RT_ADSET_ID, version: EXCLUSION_API_VERSION },
  { label: "COLD seubeat_conj", id: COLD_ADSET_ID, version: EXCLUSION_API_VERSION },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readTargeting(t) {
  return api(
    `${t.id}?fields=id,name,status,targeting`,
    "GET",
    undefined,
    t.version
  );
}

async function excludeBuyers() {
  console.log(`\n=== exclude-buyers (${LIVE ? "LIVE" : "DRY-RUN"}) ===`);

  let postsDone = 0;
  for (const t of EXCLUDE_TARGETS) {
    const adset = await readTargeting(t);
    const cur = { ...(adset.targeting || {}) };
    const existingExcl = (cur.excluded_custom_audiences || []).map((a) => a.id);
    const already = existingExcl.includes(BUYERS_EXCL_AUD_ID);

    // ecoa TODO o targeting atual (o POST substitui o objeto inteiro) e só
    // acrescenta a exclusão — nada é apagado por engano.
    const targeting = { ...cur };
    delete targeting.age_range; // escrita-protegida (#100)
    delete targeting.targeting_relaxation_types; // só-leitura
    delete targeting.user_age_unknown; // só-leitura
    targeting.excluded_custom_audiences = already
      ? existingExcl
      : [...existingExcl, BUYERS_EXCL_AUD_ID];

    console.log(
      `\n${t.label}: status=${adset.status} · já exclui=${already ? "sim" : "não"} · inclusão=${(cur.custom_audiences || []).map((a) => a.name).join(", ") || "(nenhuma)"}`
    );

    if (!LIVE) {
      console.log("  [dry-run] POST targeting:");
      console.log(JSON.stringify(targeting, null, 2).replace(/\n/g, "\n  "));
      continue;
    }
    if (already) {
      console.log("  [skip] exclusão já aplicada");
      continue;
    }

    // endpoint de adset aceita ~1 POST / 30s (error_subcode 4841018)
    const variants = [targeting];
    if ("targeting_automation" in targeting) {
      const noAuto = { ...targeting };
      delete noAuto.targeting_automation;
      variants.push(noAuto);
    }

    let written = false;
    for (const v of variants) {
      if (postsDone > 0) {
        console.log("  [rate-limit] aguardo 35s antes do próximo POST…");
        await sleep(35000);
      }
      postsDone++;
      try {
        await api(t.id, "POST", { targeting: v }, t.version);
        written = true;
        break;
      } catch (e) {
        console.warn(`  [tentativa falhou] ${e.message.slice(0, 300)}`);
      }
    }
    if (!written) {
      console.error("  [FAIL] exclusão não aplicada neste adset");
      continue;
    }

    const after = await readTargeting(t);
    const a = after.targeting || {};
    const excl = (a.excluded_custom_audiences || []).map((x) => x.name || x.id);
    const ok = excl.some((x) => x === BUYERS_EXCL_NAME || x === BUYERS_EXCL_AUD_ID);
    // confirma que o resto do targeting não foi apagado pelo POST
    const damaged = Object.keys(cur).filter(
      (k) =>
        ![
          "excluded_custom_audiences",
          "targeting_relaxation_types",
          "user_age_unknown",
          "age_range",
        ].includes(k) &&
        JSON.stringify(cur[k]) !== JSON.stringify(a[k])
    );
    console.log(ok ? "  [OK] verificado na leitura:" : "  [FAIL] não aparece:");
    console.log(
      JSON.stringify(
        { status: after.status, exclusoes: excl, campos_alterados: damaged },
        null,
        2
      ).replace(/\n/g, "\n  ")
    );

    // Nunca deixa nada ligado por engano (RT fica à espera de criativos)
    if (t.id === RT_ADSET_ID && after.status !== "PAUSED") {
      await api(`${RT_ADSET_ID}`, "POST", { status: "PAUSED" }, t.version);
      console.log("  [guarda] adset RT reposto em PAUSED");
    }
  }

  console.log(
    "\nPróximo: o RT continua PAUSED até haver criativos (0 anúncios no adset)."
  );
}

// ── dispatcher ─────────────────────────────────────────────────────────────

async function main() {
  switch (action) {
    case "create-retargeting":
      await createRetargeting();
      break;
    case "verify":
      await verify(process.argv[3]);
      break;
    case "pause":
      await pauseTarget(process.argv[3]);
      break;
    case "attribution":
      await showAttribution();
      break;
    case "exclude-buyers":
      await excludeBuyers();
      break;
    default:
      console.log(`Uso:
  node scripts/meta-direct.mjs create-retargeting [--live]
  node scripts/meta-direct.mjs verify [dias]
  node scripts/meta-direct.mjs pause <id>
  node scripts/meta-direct.mjs attribution [--live]
  node scripts/meta-direct.mjs exclude-buyers [--live]`);
      process.exit(action ? 1 : 0);
  }
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
