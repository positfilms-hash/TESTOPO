// SPEC 038/039: estados de los paneles de estudio/generacion segun study_status
// (persistente) y disponibilidad de material estudiado. Se mockea useStore para
// renderizar los paneles aislados (sin el gate de carga del StoreProvider real).

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Material } from '@backend';

vi.mock('../src/store/StoreContext.js', () => ({
  useStore: () => ({
    store: {},
    version: 0,
    refresh: () => {},
    currentUser: null,
    currentOpposition: null,
  }),
  StoreProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { StudyMaterialPanel } from '../src/pages/StudyMaterialPanel.js';
import { GenerateFromStudiedMaterialPanel } from '../src/pages/GenerateFromStudiedMaterialPanel.js';

function material(over: Partial<Material> = {}): Material {
  return {
    id: 'm-1',
    title: 'Apuntes de estudio',
    opposition_id: 'op-1',
    status: 'active',
    extraction_status: 'completed',
    study_status: 'studied',
    ...over,
  } as unknown as Material;
}

describe('SPEC 038 - StudyMaterialPanel: estado persistente', () => {
  it('muestra "Material estudiado" (verde) cuando study_status=studied', () => {
    render(<StudyMaterialPanel materials={[material()]} />);
    expect(screen.getByText('✓ Material estudiado')).toBeInTheDocument();
    expect(screen.getByText(/documento\(s\) estudiado\(s\)/)).toBeInTheDocument();
  });

  it('studied_with_warnings tambien cuenta como estudiado', () => {
    render(<StudyMaterialPanel materials={[material({ study_status: 'studied_with_warnings' })]} />);
    expect(screen.getByText('✓ Material estudiado')).toBeInTheDocument();
  });

  it('sin study_status persistido vuelve a "Estudiar material"', () => {
    render(<StudyMaterialPanel materials={[material({ study_status: null })]} />);
    expect(screen.getByRole('button', { name: 'Estudiar material' })).toBeInTheDocument();
  });
});

describe('SPEC 039 - GenerateFromStudiedMaterialPanel', () => {
  it('con material estudiado ofrece generar y NO redirige a estudiar', () => {
    render(<GenerateFromStudiedMaterialPanel materials={[material()]} />);
    expect(screen.getByRole('button', { name: 'Generar preguntas' })).toBeInTheDocument();
    expect(screen.getByText('Todo el material estudiado')).toBeInTheDocument();
    // NO debe pedir estudiar primero cuando study_status ya es studied (era el bug
    // del mapper: la UI no veia study_status y redirigia a estudiar).
    expect(screen.queryByText('Primero estudia el material.')).toBeNull();
  });

  it('sin material estudiado muestra bloqueo claro "Primero estudia el material"', () => {
    render(<GenerateFromStudiedMaterialPanel materials={[material({ study_status: null })]} />);
    expect(screen.getByText('Primero estudia el material.')).toBeInTheDocument();
  });
});
