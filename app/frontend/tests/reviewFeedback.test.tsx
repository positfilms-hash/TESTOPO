// SPEC 040: la revision humana de una candidata exige motivo estructurado +
// severidad para RECHAZAR. Ninguna accion valida automaticamente. Solo gestion.

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

describe('SPEC 040 - feedback de revision', () => {
  it('rechazar exige al menos un motivo + severidad; el boton se habilita al marcarlo', async () => {
    renderApp();
    await enterAdmin();
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Preguntas'),
    );
    // Abre la primera pregunta pendiente.
    const revisar = (await screen.findAllByText('Revisar'))[0];
    fireEvent.click(revisar);
    expect(await screen.findByText('Revision de pregunta')).toBeInTheDocument();

    // Severidad obligatoria visible y Rechazar deshabilitado sin motivo.
    expect(screen.getByText('Severidad (obligatoria al rechazar)')).toBeInTheDocument();
    const rejectDisabled = screen.getByRole('button', { name: 'Rechazar' });
    expect(rejectDisabled).toBeDisabled();

    // Al marcar un motivo, Rechazar se habilita.
    fireEvent.click(screen.getByText('Ambigua'));
    expect(screen.getByRole('button', { name: 'Rechazar' })).not.toBeDisabled();
  });

  it('muestra metricas basicas de fiabilidad del banco', async () => {
    renderApp();
    await enterAdmin();
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Preguntas'),
    );
    expect(await screen.findByText(/Fiabilidad · Banco:/)).toBeInTheDocument();
  });
});
