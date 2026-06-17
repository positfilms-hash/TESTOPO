import { useStore } from '../store/StoreContext.js';
import { Button, PageHeader } from '../components/ui.js';

// Eleccion de zona (SPEC 014, 13): solo se muestra cuando el usuario puede
// gestionar Y estudiar en el workspace actual. Si solo puede una cosa, la app
// entra directamente en esa zona sin pasar por aqui.
export function ZoneChooser() {
  const { selectZone, currentWorkspace, clearWorkspace } = useStore();
  return (
    <div style={{ maxWidth: 640, margin: '60px auto' }}>
      <PageHeader
        title="¿Que quieres hacer?"
        subtitle={`Espacio: ${currentWorkspace?.name ?? ''}`}
        action={
          <Button variant="secondary" onClick={clearWorkspace}>
            Cambiar espacio
          </Button>
        }
      />
      <div className="card-grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Gestionar oposiciones</h3>
          <p className="muted">
            Sube material, genera y revisa preguntas, gestiona alumnos.
          </p>
          <Button onClick={() => selectZone('admin')}>Ir a administracion</Button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Estudiar mis oposiciones</h3>
          <p className="muted">Consulta material, crea tests y practica.</p>
          <Button onClick={() => selectZone('student')}>Ir a estudio</Button>
        </div>
      </div>
    </div>
  );
}
