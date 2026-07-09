import type { InvoiceProvider } from "./types";

/**
 * STUB non funzionante: predisposto per una futura integrazione con Fatture
 * in Cloud (API REST + OAuth2). Come per aruba.ts, nessuna API e' stata
 * verificata: il provider rifiuta esplicitamente l'invio finche' non viene
 * implementato con credenziali reali, invece di simulare un successo.
 */
export const fattureInCloudProvider: InvoiceProvider = {
  id: "fattureincloud",
  label: "Fatture in Cloud (non configurato)",
  async send(invoice) {
    return {
      status: "ERROR",
      requestPayload: { invoiceNumber: invoice.number },
      errorMessage:
        "Integrazione Fatture in Cloud non ancora implementata: nessuna credenziale/API verificata. Usa il provider Manuale oppure implementa questo adapter.",
    };
  },
};
