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
    for (const label of ['Material', 'Temario', 'Preguntas', 'Tests', 'Alumnos']) {
      expect(within(sidebar).getByText(label)).toBeInTheDocument();
    }
    // SPEC 029: el admin no tiene `Resumen` y entra por `Material`.
    expect(within(sidebar).queryByText('Resumen')).toBeNull();
    expect(within(sidebar).getByText('Administracion')).toBeInTheDocument();
    expect(
      await screen.findByText('Tema 1 - Constitucion (ficticio)'),
    ).toBeInTheDocument();
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

  it('admin: "Subir material" abre un menu unico (PDF/ZIP/carpeta), sin categoria ni pegar texto (SPEC 029)', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Material'),
    );
    // Una unica orden visible "Subir material" que abre un menu compacto.
    fireEvent.click(
      await screen.findByRole('button', { name: 'Subir material' }),
    );
    expect(await screen.findByText('Archivos PDF')).toBeInTheDocument();
    expect(screen.getByText('Archivo ZIP')).toBeInTheDocument();
    // SPEC 029: sin radios de categoria, sin checkbox de clasificacion, sin pegar texto.
    expect(screen.queryByText('Material de la oposicion')).toBeNull();
    expect(screen.queryByText('Clasificar documentos despues de importar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pegar texto' })).toBeNull();
  });

  it('admin: Temario aplicado muestra el arbol y permite regenerar/anadir (SPEC 032)', async () => {
    renderApp();
    await enter('admin');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Temario'),
    );
    // Con temario ya aplicado (demo), el Topic Map es el contenido principal.
    expect(await screen.findByText('Temas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Añadir tema' })).toBeInTheDocument();
    // SPEC 032: regenerar el temario desde el material es la accion principal.
    expect(
      screen.getByRole('button', { name: 'Regenerar temario' }),
    ).toBeInTheDocument();
    // El arbol muestra los temas aplicados; ya no hay subida/importacion por-tema.
    expect(screen.getByText(/Tema 1 - Constitucion/)).toBeInTheDocument();
    expect(screen.queryByText('Importar ZIP')).toBeNull();
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

  it('estudiante: crear test y pulsar "Empezar" abre "Realizar test" (BUG-002)', async () => {
    renderApp();
    await enter('student');
    fireEvent.click(
      within(screen.getByLabelText('Navegacion principal')).getByText('Crear test'),
    );
    const main = document.querySelector('main.main') as HTMLElement;
    fireEvent.click(
      await within(main).findByRole('button', { name: 'Crear test' }),
    );
    fireEvent.click(await within(main).findByRole('button', { name: 'Empezar' }));
    expect(await screen.findByText('Realizar test')).toBeInTheDocument();
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

  // --- SPEC 029: navegacion y destino por defecto ---

  it('estudiante: conserva "Inicio" en la navegacion (SPEC 029)', async () => {
    renderApp();
    await enter('student');
    const sidebar = screen.getByLabelText('Navegacion principal');
    expect(within(sidebar).getByText('Inicio')).toBeInTheDocument();
  });

  it('navegacion: re-entrar en la seccion activa la reinicia a su vista raiz (SPEC 029)', async () => {
    renderApp();
    await enter('admin');
    const sidebar = screen.getByLabelText('Navegacion principal');
    fireEvent.click(within(sidebar).getByText('Preguntas'));
    expect(await screen.findByText('Pendientes de revision')).toBeInTheDocument();
    // Entra en una subvista (formulario de generacion desde fragmento).
    fireEvent.click(await screen.findByText('Generar desde fragmento'));
    expect(
      await screen.findByText('Generar desde un fragmento'),
    ).toBeInTheDocument();
    // Re-pulsar la seccion ya activa vuelve a la lista (remonta, no reload).
    fireEvent.click(within(sidebar).getByText('Preguntas'));
    expect(await screen.findByText('Pendientes de revision')).toBeInTheDocument();
  });
});
