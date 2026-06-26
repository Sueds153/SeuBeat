import { describe, it, expect } from 'vitest';

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
