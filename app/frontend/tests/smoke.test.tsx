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

function goTo(section: string) {
  const sidebar = screen.getByLabelText('Navegacion principal');
  fireEvent.click(within(sidebar).getByText(section));
}

describe('MVP frontend - smoke', () => {
  it('renderiza la navegacion principal y la pantalla de inicio', () => {
    renderApp();
    const sidebar = screen.getByLabelText('Navegacion principal');
    for (const label of ['Inicio', 'Material', 'Temario', 'Preguntas', 'Tests']) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Prepara tus oposiciones')).toBeInTheDocument();
  });

  it('muestra la lista de materiales (seed)', () => {
    renderApp();
    goTo('Material');
    expect(screen.getByText('Tema 1 - Constitucion (ficticio)')).toBeInTheDocument();
  });

  it('muestra el temario', () => {
    renderApp();
    goTo('Temario');
    expect(screen.getByText(/Tema 2 - Procedimiento administrativo/)).toBeInTheDocument();
  });

  it('muestra preguntas pendientes de revision', () => {
    renderApp();
    goTo('Preguntas');
    expect(screen.getByText('Pendientes de revision')).toBeInTheDocument();
    // Hay preguntas sembradas en pending_review.
    expect(screen.getAllByText('Revisar').length).toBeGreaterThan(0);
  });

  it('muestra estado vacio en Tests cuando no hay tests creados', () => {
    renderApp();
    goTo('Tests');
    expect(screen.getByText('Todavia no has creado ningun test.')).toBeInTheDocument();
  });
});
