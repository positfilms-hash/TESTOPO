// SPEC 038/039: en Preguntas, el CTA PRINCIPAL del MVP es "Generar preguntas desde
// material estudiado" (sin tema, sin topic_id, sin indice visible). El flujo por
// tema queda como generador legacy/secundario.

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../src/store/StoreContext.js';
import { App } from '../src/App.js';

function renderApp() {
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

async function enterAdmin() {
  fireEvent.click(await screen.findByText('Entrar como Admin'));
  await screen.findByLabelText('Navegacion principal');
}

async function gotoPreguntas() {
  fireEvent.click(within(screen.getByLabelText('Navegacion principal')).getByText('Preguntas'));
  await screen.findByText('Pendientes de revision');
}

describe('SPEC 039 - Preguntas: CTA principal = material estudiado', () => {
  it('el CTA principal es "Generar preguntas desde material estudiado"; el tema es legacy', async () => {
    renderApp();
    await enterAdmin();
    await gotoPreguntas();

    expect(
      screen.getByRole('button', { name: 'Generar preguntas desde material estudiado' }),
    ).toBeInTheDocument();
    // El flujo viejo "Generar desde tema" ya NO es el CTA principal: queda en el
    // desplegable de generadores avanzados (legacy).
    expect(screen.getByText('Otros generadores (avanzado)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar desde tema' })).toBeNull();
  });

  it('sin material estudiado, el CTA principal lleva a "Primero estudia el material"', async () => {
    renderApp();
    await enterAdmin();
    await gotoPreguntas();
    fireEvent.click(
      screen.getByRole('button', { name: 'Generar preguntas desde material estudiado' }),
    );
    expect(await screen.findByText('Primero estudia el material.')).toBeInTheDocument();
  });
});
