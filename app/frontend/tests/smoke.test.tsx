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

// Entra como admin o estudiante, elige el workspace y la oposicion sembrados.
function enter(role: 'admin' | 'student') {
  fireEvent.click(
    screen.getByText(role === 'admin' ? 'Entrar como Admin' : 'Entrar como Estudiante'),
  );
  // "Mis espacios": entrar en el Workspace MVP.
  fireEvent.click(screen.getByText('Entrar'));
  // "Mis oposiciones": entrar en la Oposicion MVP.
  fireEvent.click(screen.getByText('Entrar'));
}

function goTo(section: string) {
  const sidebar = screen.getByLabelText('Navegacion principal');
  fireEvent.click(within(sidebar).getByText(section));
}

describe('MVP frontend - smoke (SPEC 010)', () => {
  it('muestra el login al arrancar', () => {
    renderApp();
    expect(screen.getByText('Entrar como Admin')).toBeInTheDocument();
    expect(screen.getByText('Entrar como Estudiante')).toBeInTheDocument();
  });

  it('admin: entra, ve oposicion y navegacion completa', () => {
    renderApp();
    enter('admin');
    const sidebar = screen.getByLabelText('Navegacion principal');
    for (const label of ['Inicio', 'Material', 'Temario', 'Preguntas', 'Tests']) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Prepara tus oposiciones')).toBeInTheDocument();
  });

  it('admin: ve la lista de materiales (seed) de la oposicion', () => {
    renderApp();
    enter('admin');
    goTo('Material');
    expect(screen.getByText('Tema 1 - Constitucion (ficticio)')).toBeInTheDocument();
  });

  it('admin: ve preguntas pendientes de revision', () => {
    renderApp();
    enter('admin');
    goTo('Preguntas');
    expect(screen.getByText('Pendientes de revision')).toBeInTheDocument();
    expect(screen.getAllByText('Revisar').length).toBeGreaterThan(0);
  });

  it('estudiante: navegacion reducida (sin Temario ni Preguntas)', () => {
    renderApp();
    enter('student');
    const sidebar = screen.getByLabelText('Navegacion principal');
    expect(within(sidebar).getByText('Material')).toBeInTheDocument();
    expect(within(sidebar).getByText('Tests')).toBeInTheDocument();
    expect(within(sidebar).queryByText('Temario')).toBeNull();
    expect(within(sidebar).queryByText('Preguntas')).toBeNull();
  });

  it('estudiante: estado vacio en Tests cuando no hay tests creados', () => {
    renderApp();
    enter('student');
    goTo('Tests');
    expect(screen.getByText('Todavia no has creado ningun test.')).toBeInTheDocument();
  });
});
