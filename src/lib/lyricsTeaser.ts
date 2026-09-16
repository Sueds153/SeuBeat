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
  let bestSection = sections[0];

  for (const type of emotionalPriority) {
    const found = sections.find(s => s.type === type);
    if (found && found.lines.length > 0) {
      bestSection = found;
      break;
    }
  }

  // Mostrar só a secção emocional (máx 8 linhas para não ser demasiado)
  const visibleLines = bestSection.lines.slice(0, 8);

  const visibleSections: LyricSection[] = [{
    ...bestSection,
    lines: visibleLines,
    isVisible: true,
    isEditable: false,
  }];

  const hiddenSections = sections
    .filter(s => s !== bestSection)
    .map(s => ({ ...s, isVisible: false, isEditable: false }));

  return {
    visibleSections,
    hiddenSections,
    totalLines,
    visibleLines: visibleLines.length,
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

let teaserEnabledCache: boolean | null = null;

export async function isTeaserEnabled(): Promise<boolean> {
  if (teaserEnabledCache !== null) return teaserEnabledCache;
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      teaserEnabledCache = data.features?.lyricsTeaser === true;
      return teaserEnabledCache;
    }
  } catch {
    // ignore
  }
  teaserEnabledCache = false;
  return false;
}

export function resetTeaserEnabledCache(): void {
  teaserEnabledCache = null;
}