// SPEC 036: rehidratacion de sesion/workspace. Con Supabase "configurado"
// (mockeado), el arranque restaura el usuario desde la sesion ANTES de decidir
// pantalla: nunca muestra Login en `booting`. Sin sesion -> Login; con perfil
// valido -> selector de workspaces (el store en memoria no tiene workspaces para
// ese usuario); perfil deleted/blocked -> no rehidrata (Login).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AuthProfile } from '../src/auth/authService.js';

let mockProfile: AuthProfile | null = null;
let mockProfileThrows = false;

vi.mock('../src/auth/supabaseClient.js', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
  }),
}));

vi.mock('../src/auth/authService.js', async (importActual) => {
  const actual = await importActual<typeof import('../src/auth/authService.js')>();
  return {
    ...actual,
    getCurrentProfile: async () => {
      if (mockProfileThrows) throw new Error('profile-unavailable');
      return mockProfile;
    },
    logout: async () => undefined,
  };
});

import { StoreProvider } from '../src/store/StoreContext.js';
import { App } from '../src/App.js';

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

const validProfile: AuthProfile = {
  id: 'rehydrated-user-1',
  email: 'real@user.dev',
  name: 'Real User',
  role: 'admin',
  status: 'active',
};

beforeEach(() => {
  localStorage.clear();
  mockProfile = null;
  mockProfileThrows = false;
});

describe('SPEC 036 - rehidratacion de sesion', () => {
  it('sin sesion -> muestra Login (no se queda en blanco)', async () => {
    mockProfile = null;
    renderApp();
    // El formulario de login (modo configurado): campo Email + boton Entrar.
    expect(await screen.findByText('Email')).toBeInTheDocument();
  });

  it('con sesion valida -> restaura el usuario y pasa al selector de workspaces, nunca Login', async () => {
    mockProfile = validProfile;
    renderApp();
    // El store en memoria no tiene workspaces para este usuario -> gate "Mis espacios".
    expect(await screen.findByText('Mis espacios')).toBeInTheDocument();
    // No debe mostrarse el formulario de login.
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('perfil deleted/blocked -> no rehidrata (Login)', async () => {
    mockProfile = { ...validProfile, status: 'deleted' };
    renderApp();
    expect(await screen.findByText('Email')).toBeInTheDocument();
    expect(screen.queryByText('Mis espacios')).toBeNull();
  });

  it('perfil ausente/ilegible -> estado de error claro (no student silencioso)', async () => {
    mockProfileThrows = true;
    renderApp();
    expect(await screen.findByText(/No se pudo cargar tu sesión/i)).toBeInTheDocument();
    // No se inventa un usuario student: nunca aparece el shell ni el selector.
    expect(screen.queryByText('Mis espacios')).toBeNull();
  });
});
