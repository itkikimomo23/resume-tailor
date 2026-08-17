export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export const MODELS: ModelOption[] = [
  { id: "gpt-5.5",      label: "GPT-5.5",       description: "Most capable" },
  { id: "gpt-5.5-pro",  label: "GPT-5.5 Pro",   description: "Pro variant" },
  { id: "gpt-5.4",      label: "GPT-5.4",        description: "Balanced" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini",   description: "Fast & efficient" },
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano",   description: "Fastest" },
  { id: "gpt-5.4-pro",  label: "GPT-5.4 Pro",    description: "Pro variant" },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function isValidModel(id: string): boolean {
  return MODELS.some((m) => m.id === id);
}
