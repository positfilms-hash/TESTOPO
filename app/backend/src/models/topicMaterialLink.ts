// Vinculo entre un material (SPEC 002) y un tema (SPEC 003).
// Un material puede vincularse a uno o varios temas y viceversa.

export interface TopicMaterialLink {
  id: string;
  material_id: string;
  topic_id: string;
  /** Referencia opcional: pagina, articulo, capitulo, apartado o fragmento. */
  reference: string | null;
  created_at: Date;
}
