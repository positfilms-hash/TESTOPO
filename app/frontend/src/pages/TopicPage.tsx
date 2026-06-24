import { useEffect, useState } from 'react';
import type { Material } from '@backend';
import { useStore } from '../store/StoreContext.js';
import type { Section } from '../components/AppLayout.js';
import { LoadingState, PageHeader } from '../components/ui.js';
import { StudyMaterialPanel } from './StudyMaterialPanel.js';
import { GenerateFromStudiedMaterialPanel } from './GenerateFromStudiedMaterialPanel.js';

// SPEC 038/039: la pantalla de Análisis ("Temario") ES la ruta
// Material -> Estudiar material -> Generar preguntas. El índice/temario PÚBLICO
// (propuestas, Topic Map, aplicar índice) ya NO forma parte del flujo normal: los
// Topics/propuestas legacy siguen existiendo en el dominio para compatibilidad,
// pero no se exponen aquí ni son requisito para estudiar o generar preguntas.
// (Solo gestión; el alumno nunca ve esta pantalla.)

export function TopicPage({ onNavigate }: { onNavigate?: (section: Section) => void }) {
  const { store, currentUser, currentOpposition, version } = useStore();
  const oppositionId = currentOpposition?.id;

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Solo necesitamos el material de la oposición: el estudio y la generación son
  // autosuficientes (no dependen de un índice/temario previamente aplicado).
  useEffect(() => {
    let cancelled = false;
    if (!currentUser || !oppositionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const mats = await store.platform.listMaterials(currentUser, oppositionId);
      if (!cancelled) {
        setMaterials(mats);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, currentUser, oppositionId, version]);

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Temario" title="Temario" />
        <LoadingState />
      </div>
    );
  }

  return (
    <div>
      <StudyMaterialPanel materials={materials} onNavigate={onNavigate} />
      <GenerateFromStudiedMaterialPanel materials={materials} onNavigate={onNavigate} />
    </div>
  );
}
