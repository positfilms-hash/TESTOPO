// Opcion de respuesta de una pregunta tipo test (SPEC 001, seccion 6).

export interface Option {
  id: string;
  text: string;
  is_correct: boolean;
  order: number;
}
