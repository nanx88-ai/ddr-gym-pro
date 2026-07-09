import type { Invoice, InvoiceLineItem, Client } from "@/generated/prisma";

export interface InvoiceWithDetails extends Invoice {
  lineItems: InvoiceLineItem[];
  client: Client;
}

export interface ProviderSendResult {
  status: "SUCCESS" | "ERROR";
  requestPayload?: unknown;
  responsePayload?: unknown;
  externalId?: string;
  errorMessage?: string;
}

/**
 * Astrazione per l'invio di una fattura a un sistema esterno. Ogni provider
 * implementa `send`; l'esito (successo o errore) viene sempre salvato in
 * InvoiceSubmission da chi chiama, cosi' restano tracciati gli esiti e gli
 * stati restituiti dal sistema anche quando l'invio fallisce.
 */
export interface InvoiceProvider {
  id: string;
  label: string;
  send(invoice: InvoiceWithDetails): Promise<ProviderSendResult>;
}
