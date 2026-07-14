export function formatCurrencyBRL(valueInCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
}

export function formatDateBR(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function reaisToCents(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) {
    return 0;
  }

  return Math.round(numberValue * 100);
}

export function centsToReaisInput(valueInCents: number) {
  return (valueInCents / 100).toFixed(2).replace(".", ",");
}
