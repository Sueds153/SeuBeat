export interface LyricSection {
  type: 'verse' | 'chorus' | 'bridge' | 'intro' | 'outro' | 'pre-chorus' | 'post-chorus';
  label: string;
  lines: string[];
  isVisible: boolean;
  isEditable: boolean;
}

export interface LyricsTeaser {
  visibleSections: LyricSection[];
  hiddenSections: LyricSection[];
  totalLines: number;
  visibleLines: number;
}

function parseLyricsStructure(lyrics: string): LyricSection[] {
  const lines = lyrics.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  const sections: LyricSection[] = [];
  let currentSection: LyricSection | null = null;
  let sectionCounter = 0;

  const sectionKeywords: Record<string, { type: LyricSection['type']; label: string }> = {
    'verso': { type: 'verse', label: 'Verso' },
    'verse': { type: 'verse', label: 'Verso' },
    'refrão': { type: 'chorus', label: 'Refrão' },
    'chorus': { type: 'chorus', label: 'Refrão' },
    'pré-refrão': { type: 'pre-chorus', label: 'Pré-Refrão' },
    'pre-chorus': { type: 'pre-chorus', label: 'Pré-Refrão' },
    'pós-refrão': { type: 'post-chorus', label: 'Pós-Refrão' },
    'post-chorus': { type: 'post-chorus', label: 'Pós-Refrão' },
    'ponte': { type: 'bridge', label: 'Ponte' },
    'bridge': { type: 'bridge', label: 'Ponte' },
    'intro': { type: 'intro', label: 'Intro' },
    'início': { type: 'intro', label: 'Intro' },
    'outro': { type: 'outro', label: 'Outro' },
    'final': { type: 'outro', label: 'Outro' },
  };

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    let matchedSection: { type: LyricSection['type']; label: string } | null = null;

    for (const [keyword, info] of Object.entries(sectionKeywords)) {
      if (lowerLine.startsWith(keyword) || lowerLine.includes(`[${keyword}]`) || lowerLine.includes(`(${keyword})`)) {
        matchedSection = info;
        break;
      }
    }

    if (matchedSection) {
      if (currentSection) {
        sections.push(currentSection);
      }
      sectionCounter++;
      currentSection = {
        type: matchedSection.type,
        label: `${matchedSection.label} ${sectionCounter}`,
        lines: [],
        isVisible: false,
        isEditable: false,
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      sectionCounter++;
      currentSection = {
        type: 'verse',
        label: `Verso ${sectionCounter}`,
        lines: [line],
        isVisible: false,
        isEditable: false,
      };
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  if (sections.length === 0 && lines.length > 0) {
    return [{
      type: 'verse',
      label: 'Verso 1',
      lines,
      isVisible: false,
      isEditable: false,
    }];
  }

  return sections;
}

export function buildTeaser(lyrics: string): LyricsTeaser {
  const sections = parseLyricsStructure(lyrics);

  if (sections.length === 0) {
    return { visibleSections: [], hiddenSections: [], totalLines: 0, visibleLines: 0 };
  }

  const totalLines = sections.reduce((sum, s) => sum + s.lines.length, 0);

  // Seleccao emocional: ponte > refrão > pré-refrão > primeira secção
  const emotionalPriority: LyricSection['type'][] = ['bridge', 'chorus', 'pre-chorus'];
  let primarySection = sections[0];

  for (const type of emotionalPriority) {
    const found = sections.find(s => s.type === type);
    if (found && found.lines.length > 0) {
      primarySection = found;
      break;
    }
  }

  // Segunda secção: verso adjacente ao primary (anterior ou seguinte)
  const primaryIndex = sections.indexOf(primarySection);
  let secondarySection: LyricSection | null = null;
  if (primaryIndex > 0) {
    secondarySection = sections[primaryIndex - 1];
  } else if (sections.length > 1) {
    secondarySection = sections[1];
  }

  // Mostrar 2 secções — primary (máx 8 linhas) + secondary (máx 4 linhas como sneak peek)
  const primaryLines = primarySection.lines.slice(0, 8);
  const secondaryLines = secondarySection ? secondarySection.lines.slice(0, 4) : [];

  const visibleSections: LyricSection[] = [
    { ...primarySection, lines: primaryLines, isVisible: true, isEditable: false },
    ...(secondarySection
      ? [{ ...secondarySection, lines: secondaryLines, isVisible: true, isEditable: false }]
      : []),
  ];

  const visibleSet = new Set(visibleSections.map(s => s.label));
  const hiddenSections = sections
    .filter(s => !visibleSet.has(s.label))
    .map(s => ({ ...s, isVisible: false, isEditable: false }));

  return {
    visibleSections,
    hiddenSections,
    totalLines,
    visibleLines: primaryLines.length + secondaryLines.length,
  };
}

export function mergeTeaserEdits(
  originalLyrics: string,
  teaserEdits: Record<string, string[]>
): string {
  const sections = parseLyricsStructure(originalLyrics);
  const editedSections: LyricSection[] = [];

  for (const section of sections) {
    // saveTeaserEdits guarda com section.label directamente (ex: "Verso 1")
    if (teaserEdits[section.label]) {
      editedSections.push({ ...section, lines: teaserEdits[section.label] });
    } else {
      editedSections.push(section);
    }
  }

  return editedSections.map(s => s.lines.join('\n')).join('\n\n');
}

export function getTeaserStorageKey(requestId: string): string {
  return `seubeat_teaser_edits_${requestId}`;
}

export function saveTeaserEdits(requestId: string, edits: Record<string, string[]>): void {
  try {
    localStorage.setItem(getTeaserStorageKey(requestId), JSON.stringify(edits));
  } catch {
    // ignore storage errors
  }
}

export function loadTeaserEdits(requestId: string): Record<string, string[]> {
  try {
    const data = localStorage.getItem(getTeaserStorageKey(requestId));
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return {};
}

export function clearTeaserEdits(requestId: string): void {
  try {
    localStorage.removeItem(getTeaserStorageKey(requestId));
  } catch {
    // ignore
  }
}

const TEASER_CACHE_KEY = 'seubeat_teaser_enabled';
let teaserEnabledCache: boolean | null = null;

export async function isTeaserEnabled(): Promise<boolean> {
  // Se já temos cache em memória, usar
  if (teaserEnabledCache !== null) return teaserEnabledCache;

  // Tentar ler do localStorage como fallback imediato (evita flash)
  try {
    const stored = localStorage.getItem(TEASER_CACHE_KEY);
    if (stored !== null) {
      teaserEnabledCache = stored === 'true';
      // Ir buscar ao servidor em background para atualizar
      fetchConfigSilently();
      return teaserEnabledCache;
    }
  } catch {}

  // Primera visita: ir buscar ao servidor
  const result = await fetchConfig();
  return result;
}

function fetchConfigSilently(): void {
  fetch('/api/config')
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        const enabled = data.features?.lyricsTeaser === true;
        teaserEnabledCache = enabled;
        try { localStorage.setItem(TEASER_CACHE_KEY, String(enabled)); } catch {}
      }
    })
    .catch(() => {
      // Ignorar — manter cache anterior
    });
}

async function fetchConfig(): Promise<boolean> {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      const enabled = data.features?.lyricsTeaser === true;
      teaserEnabledCache = enabled;
      try { localStorage.setItem(TEASER_CACHE_KEY, String(enabled)); } catch {}
      return enabled;
    }
  } catch {}
  // Em caso de falha, NÃO cacheamos false permanentemente
  // Devolver o último valor conhecido via localStorage ou false
  try {
    const stored = localStorage.getItem(TEASER_CACHE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {}
  return false;
}

export function resetTeaserEnabledCache(): void {
  teaserEnabledCache = null;
  try { localStorage.removeItem(TEASER_CACHE_KEY); } catch {}
}