import type { InvoiceProvider } from "./types";

/**
 * STUB non funzionante: predisposto per una futura integrazione con Aruba
 * Fatturazione Elettronica. Non e' mai stata verificata alcuna API Aruba in
 * questo progetto (nessun fatto verificato, nessuna credenziale disponibile),
 * quindi il provider dichiara esplicitamente di non essere configurato invece
 * di fingere un invio riuscito. Per attivarlo: implementare qui la chiamata
 * reale (autenticazione, endpoint, mapping XML FatturaPA) e aggiungere le
 * credenziali come variabili d'ambiente.
 */
export const arubaProvider: InvoiceProvider = {
  id: "aruba",
  label: "Aruba Fatturazione Elettronica (non configurato)",
  async send(invoice) {
    return {
      status: "ERROR",
      requestPayload: { invoiceNumber: invoice.number },
      errorMessage:
        "Integrazione Aruba non ancora implementata: nessuna credenziale/API verificata. Usa il provider Manuale oppure implementa questo adapter.",
    };
  },
};
