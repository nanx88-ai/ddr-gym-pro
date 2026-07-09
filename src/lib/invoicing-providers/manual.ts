import type { InvoiceProvider } from "./types";

/**
 * Provider "manuale": non chiama nessuna API esterna, registra soltanto che
 * la fattura e' stata contrassegnata come inviata dall'admin (es. dopo averla
 * spedita a mano via email). E' l'unico provider realmente attivo finche' non
 * viene collegata un'integrazione reale.
 */
export const manualProvider: InvoiceProvider = {
  id: "manual",
  label: "Manuale (segna come inviata)",
  async send(invoice) {
    return {
      status: "SUCCESS",
      requestPayload: { invoiceNumber: invoice.number, clientId: invoice.clientId },
      responsePayload: { note: "Invio manuale registrato dall'operatore, nessuna chiamata esterna effettuata." },
    };
  },
};
