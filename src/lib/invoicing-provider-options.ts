// Elenco provider per la UI (client-side): tenuto separato da
// invoicing-providers/index.ts per non trascinare tipi/logica server-side nel bundle client.
export const INVOICE_PROVIDER_OPTIONS = [
  { id: "manual", label: "Manuale (segna come inviata)" },
  { id: "aruba", label: "Aruba Fatturazione Elettronica (non configurato)" },
  { id: "fattureincloud", label: "Fatture in Cloud (non configurato)" },
];
