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
// Todo es asincrono (SPEC 018.3): seed + cargas de datos via Promise.
async function enter(role: 'admin' | 'student') {
  fireEvent.click(
    await screen.findByText(
      role === 'admin' ? 'Entrar como Admin' : 'Entrar como Estudiante',
    ),
  );
  // "Mis espacios": espera el workspace sembrado y entra.
  await screen.findByText('Workspace MVP');
  fireEvent.click(screen.getByText('Entrar'));
  // "Mis oposiciones": espera la oposicion sembrada y entra.
  await screen.findByText('Oposicion MVP');
  fireEvent.click(screen.getByText('Entrar'));
  // Espera a que monte el layout con la navegacion.
  await screen.findByLabelText('Navegacion principal');
}

describe('MVP frontend - smoke (SPEC 010/018.3)', () => {
  it('muestra el login al arrancar', async () => {
    renderApp();
    expect(await screen.findByText('Entrar como Admin')).toBeInTheDocument();
    expect(
      await screen.findByText('Entrar como Estudiante'),
    ).toBeInTheDocument();
  });

  it('admin: entra en zona administracion con navegacion de gestion', async () => {
    renderApp();
    await enter('admin');
    const sidebar = screen.getByLabelText('Navegacion principal');
    for (const label of [
      'Resumen',
      'Material',
      'Temario',
      'Preguntas',
      'Tests',
      'Alumnos',
    ]) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    }
    expect(within(sidebar).getByText('Administracion')).toBeInTheDocument();
    expect(await screen.findByText('Prepara tus oposiciones')).toBeInTheDocument();
  });

  it('admin: ve la lista de materiales (seed) de la oposicion', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Material'),
    );
    expect(
      await screen.findByText('Tema 1 - Constitucion (ficticio)'),
    ).toBeInTheDocument();
  });

  it('admin: Material usa un unico CTA "Subir material" (SPEC 022)', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Material'),
    );
    // Un unico boton principal; ya no hay "Subir PDF"/"Anadir material" sueltos.
    expect(
      await screen.findByRole('button', { name: 'Subir material' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anadir material' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Subir PDF' })).toBeNull();
    // El flujo unico permite tanto subir PDF como pegar texto.
    fireEvent.click(screen.getByRole('button', { name: 'Subir material' }));
    expect(
      await screen.findByRole('button', { name: 'Subir PDF' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pegar texto' }),
    ).toBeInTheDocument();
    // Y se puede completar una subida PDF desde ese flujo.
    fireEvent.click(screen.getByRole('button', { name: 'Subir PDF' }));
    expect(
      await screen.findByText('Sube un temario, ley o examen en PDF.'),
    ).toBeInTheDocument();
  });

  it('admin: Temario unificado muestra material y acciones al elegir tema (SPEC 017)', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Temario'),
    );
    expect(await screen.findByText('Temas')).toBeInTheDocument();
    expect(screen.getByText('Anadir tema')).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: /Tema 1 - Constitucion/ }),
    );
    expect(await screen.findByText('Subir material')).toBeInTheDocument();
    expect(screen.getByText('Importar ZIP')).toBeInTheDocument();
  });

  it('admin: ve preguntas pendientes de revision', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Preguntas'),
    );
    expect(await screen.findByText('Pendientes de revision')).toBeInTheDocument();
    expect((await screen.findAllByText('Revisar')).length).toBeGreaterThan(0);
  });

  it('estudiante: zona estudio sin secciones de administracion', async () => {
    renderApp();
    await enter('student');
    const sidebar = screen.getByLabelText('Navegacion principal');
    expect(within(sidebar).getByText('Material')).toBeInTheDocument();
    expect(within(sidebar).getByText('Crear test')).toBeInTheDocument();
    expect(within(sidebar).getByText('Mis resultados')).toBeInTheDocument();
    expect(within(sidebar).getByText('Estudio')).toBeInTheDocument();
    expect(within(sidebar).queryByText('Temario')).toBeNull();
    expect(within(sidebar).queryByText('Preguntas')).toBeNull();
    expect(within(sidebar).queryByText('Alumnos')).toBeNull();
  });

  it('estudiante: redireccion a estudio, inicio muestra la oposicion y Crear test', async () => {
    renderApp();
    await enter('student');
    expect(await screen.findByText('Oposicion MVP')).toBeInTheDocument();
    expect((await screen.findAllByText('Crear test')).length).toBeGreaterThan(0);
  });

  it('estudiante: estado vacio en Crear test cuando no hay tests creados', async () => {
    renderApp();
    await enter('student');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Crear test'),
    );
    expect(
      await screen.findByText('Todavia no has creado ningun test.'),
    ).toBeInTheDocument();
  });

  it('estudiante: Mis resultados vacio al empezar', async () => {
    renderApp();
    await enter('student');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText(
        'Mis resultados',
      ),
    );
    expect(
      await screen.findByText(
        "Todavia no has enviado ningun test. Crea uno en 'Crear test'.",
      ),
    ).toBeInTheDocument();
  });
});
