import { describe, it, expect } from 'vitest';
import { abandonedTeaserHtml } from '../services/email';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeStr(val: string | undefined | null, fallback = ''): string {
  return escapeHtml(val || fallback);
}

describe('escapeHtml', () => {
  it('escapes &', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes <', () => {
    expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;');
  });

  it('escapes >', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('preserves safe strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes all special chars simultaneously', () => {
    expect(escapeHtml('<a href="test" onclick=\'alert(1)\'>&</a>'))
      .toBe('&lt;a href=&quot;test&quot; onclick=&#039;alert(1)&#039;&gt;&amp;&lt;/a&gt;');
  });
});

describe('safeStr', () => {
  it('returns escaped value for valid string', () => {
    expect(safeStr('hello <world>')).toBe('hello &lt;world&gt;');
  });

  it('returns fallback for null', () => {
    expect(safeStr(null, 'fallback')).toBe('fallback');
  });

  it('returns fallback for undefined', () => {
    expect(safeStr(undefined, 'padrão')).toBe('padrão');
  });

  it('returns empty string when no fallback', () => {
    expect(safeStr(null)).toBe('');
  });

  it('handles undefined with default fallback', () => {
    expect(safeStr(undefined)).toBe('');
  });

  it('preserves already safe strings', () => {
    expect(safeStr('normal text')).toBe('normal text');
  });

  it('does not double-escape fallback', () => {
    expect(safeStr(null, 'safe <text>')).toBe('safe &lt;text&gt;');
  });
});

describe('abandonedTeaserHtml', () => {
  it('devolve HTML vazio quando não há snippet', () => {
    expect(abandonedTeaserHtml('Rui', 'Minha Canção', '')).toBe('');
    expect(abandonedTeaserHtml('Rui', '', '   ')).toBe('');
    expect(abandonedTeaserHtml('Rui', undefined, undefined)).toBe('');
  });

  it('inclui o título e o primeiro nome do destinatário', () => {
    const html = abandonedTeaserHtml('Rui Manuel', 'Canção para Ti', 'Verso um, verso dois');
    expect(html).toContain('Canção para Ti — a letra que criaste para Rui');
    expect(html).toContain('"Verso um, verso dois…"');
  });

  it('usa o recipiente do primeiro nome mesmo com nome completo', () => {
    const html = abandonedTeaserHtml('Maria José Fernandes', 'Para Ela', 'Ela vai ouvir');
    expect(html).toContain('para Maria');
    expect(html).not.toContain('para Maria José Fernandes');
  });

  it('escapa HTML do título e do snippet (anti-XSS)', () => {
    const html = abandonedTeaserHtml('Rui', '<script>', 'fecha a tag </div>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    // O snippet do utilizador é escapado (não injeta `</div>` nem abre tags)
    expect(html).toContain('"fecha a tag &lt;/div&gt;…"');
    expect(html).not.toContain('"fecha a tag </div>…"');
    // O único `</div>` presente é o fecho legítimo do cartão (1 ocorrência extra além das tags estruturais)
    const userSnippetInjected = html.match(/"fecha a tag<\/div>/);
    expect(userSnippetInjected).toBeNull();
  });

  it('sem título usa apenas "A letra que criaste para <nome>"', () => {
    const html = abandonedTeaserHtml('Rui', '', 'Verso');
    expect(html).toContain('A letra que criaste para Rui');
  });
});
