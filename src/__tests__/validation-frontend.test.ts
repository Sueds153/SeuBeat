import { describe, it, expect } from 'vitest';
import { validateStep, Step1Schema, Step9Schema, formatPhoneNumber } from '../lib/validation';

describe('Step1Schema (Relation)', () => {
  it('passes with valid data', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: 'esposa',
      recipientName: 'Maria',
      recipientGender: 'Feminino',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(true);
  });

  it('fails when recipientRelation is empty', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: '',
      recipientName: 'Maria',
      recipientGender: 'Feminino',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(false);
  });

  it('fails when recipientName is too short', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: 'esposa',
      recipientName: 'A',
      recipientGender: 'Feminino',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(false);
  });
});

describe('Step9Schema (Email + Phone)', () => {
  it('passes with valid email and phone', () => {
    const result = Step9Schema.safeParse({ email: 'teste@exemplo.com', phone: '+244 922 000 000' });
    expect(result.success).toBe(true);
  });

  it('passes with email containing dots and plus', () => {
    const result = Step9Schema.safeParse({ email: 'test.name+tag@dominio.co.ao', phone: '922000000' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email', () => {
    const result = Step9Schema.safeParse({ email: 'invalido', phone: '+244 922 000 000' });
    expect(result.success).toBe(false);
  });

  it('fails with empty email', () => {
    const result = Step9Schema.safeParse({ email: '', phone: '+244 922 000 000' });
    expect(result.success).toBe(false);
  });

  it('fails with empty phone', () => {
    const result = Step9Schema.safeParse({ email: 'teste@exemplo.com', phone: '' });
    expect(result.success).toBe(false);
  });

  it('fails with phone too short', () => {
    const result = Step9Schema.safeParse({ email: 'teste@exemplo.com', phone: '123' });
    expect(result.success).toBe(false);
  });

  it('fails without phone', () => {
    const result = Step9Schema.safeParse({ email: 'teste@exemplo.com' });
    expect(result.success).toBe(false);
  });
});

describe('formatPhoneNumber', () => {
  it('formats 9-digit local number', () => {
    expect(formatPhoneNumber('922000000')).toBe('+244 922 000 000');
  });

  it('formats 12-digit number without +', () => {
    expect(formatPhoneNumber('244922000000')).toBe('+244 922 000 000');
  });

  it('strips non-digit characters', () => {
    expect(formatPhoneNumber('(244) 922-000-000')).toBe('+244 922 000 000');
  });

  it('returns value unchanged if cannot format', () => {
    expect(formatPhoneNumber('abc')).toBe('abc');
  });

  it('returns empty string unchanged', () => {
    expect(formatPhoneNumber('')).toBe('');
  });
});

describe('validateStep helper', () => {
  it('returns empty errors for valid step 1', () => {
    const errors = validateStep(1, {
      recipientRelation: 'mãe',
      recipientName: 'Maria',
      recipientGender: 'Feminino',
      userNick: 'Filho',
      recipientNick: 'Mamã',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns errors for invalid step 1', () => {
    const errors = validateStep(1, {
      recipientRelation: '',
      recipientName: 'Maria',
      recipientGender: 'Feminino',
      userNick: 'Filho',
      recipientNick: 'Mamã',
    });
    expect(errors.recipientRelation).toBeTruthy();
  });

  it('returns empty object for unknown step', () => {
    const errors = validateStep(99, {});
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns errors for invalid step 9', () => {
    const errors = validateStep(9, { email: 'bad', phone: '+244 922 000 000' });
    expect(errors.email).toBeTruthy();
  });

  it('returns errors for step 9 without phone', () => {
    const errors = validateStep(9, { email: 'teste@exemplo.com', phone: '' });
    expect(errors.phone).toBeTruthy();
  });
});
