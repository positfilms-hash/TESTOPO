// SPEC 036: pistas de seleccion persistidas (no autoritativas). Verifica el
// namespacing por usuario, get/set/clear y que solo se guardan IDs.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getWorkspaceHint,
  setWorkspaceHint,
  clearWorkspaceHint,
  getOppositionHint,
  setOppositionHint,
  clearOppositionHint,
  clearSelectionHints,
} from '../src/store/sessionHints.js';

beforeEach(() => {
  localStorage.clear();
});

describe('sessionHints (SPEC 036)', () => {
  it('guarda y lee la pista por usuario con clave namespaced', () => {
    setWorkspaceHint('u1', 'ws-1');
    setOppositionHint('u1', 'op-1');
    expect(getWorkspaceHint('u1')).toBe('ws-1');
    expect(getOppositionHint('u1')).toBe('op-1');
    // Clave exacta esperada (no autoritativa, solo ID).
    expect(localStorage.getItem('testopo:last_workspace_id:u1')).toBe('ws-1');
    expect(localStorage.getItem('testopo:last_opposition_id:u1')).toBe('op-1');
  });

  it('aisla las pistas entre usuarios distintos', () => {
    setWorkspaceHint('u1', 'ws-1');
    expect(getWorkspaceHint('u2')).toBeNull();
  });

  it('clear elimina cada pista; clearSelectionHints elimina ambas', () => {
    setWorkspaceHint('u1', 'ws-1');
    setOppositionHint('u1', 'op-1');
    clearWorkspaceHint('u1');
    expect(getWorkspaceHint('u1')).toBeNull();
    expect(getOppositionHint('u1')).toBe('op-1');
    clearOppositionHint('u1');
    expect(getOppositionHint('u1')).toBeNull();

    setWorkspaceHint('u1', 'ws-1');
    setOppositionHint('u1', 'op-1');
    clearSelectionHints('u1');
    expect(getWorkspaceHint('u1')).toBeNull();
    expect(getOppositionHint('u1')).toBeNull();
  });

  it('devuelve null con userId vacio o valor ausente', () => {
    expect(getWorkspaceHint('')).toBeNull();
    expect(getWorkspaceHint('nadie')).toBeNull();
  });
});
