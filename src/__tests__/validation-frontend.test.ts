import { describe, it, expect } from 'vitest';
import { validateStep, Step1Schema, Step9Schema } from '../lib/validation';

describe('Step1Schema (Relation)', () => {
  it('passes with valid data', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: 'esposa',
      recipientName: 'Maria',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(true);
  });

  it('fails when recipientRelation is empty', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: '',
      recipientName: 'Maria',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(false);
  });

  it('fails when recipientName is too short', () => {
    const result = Step1Schema.safeParse({
      recipientRelation: 'esposa',
      recipientName: 'A',
      userNick: 'Amor',
      recipientNick: 'Princesa',
    });
    expect(result.success).toBe(false);
  });
});

describe('Step9Schema (Email)', () => {
  it('passes with valid email', () => {
    const result = Step9Schema.safeParse({ email: 'teste@exemplo.com' });
    expect(result.success).toBe(true);
  });

  it('passes with email containing dots and plus', () => {
    const result = Step9Schema.safeParse({ email: 'test.name+tag@dominio.co.ao' });
    expect(result.success).toBe(true);
  });

  it('fails with invalid email', () => {
    const result = Step9Schema.safeParse({ email: 'invalido' });
    expect(result.success).toBe(false);
  });

  it('fails with empty email', () => {
    const result = Step9Schema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });
});

describe('validateStep helper', () => {
  it('returns empty errors for valid step 1', () => {
    const errors = validateStep(1, {
      recipientRelation: 'mãe',
      recipientName: 'Maria',
      userNick: 'Filho',
      recipientNick: 'Mamã',
    });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('returns errors for invalid step 1', () => {
    const errors = validateStep(1, {
      recipientRelation: '',
      recipientName: 'Maria',
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
    const errors = validateStep(9, { email: 'bad' });
    expect(errors.email).toBeTruthy();
  });
});
