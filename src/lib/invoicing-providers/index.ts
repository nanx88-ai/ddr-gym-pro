import { manualProvider } from "./manual";
import { arubaProvider } from "./aruba";
import { fattureInCloudProvider } from "./fattureincloud";
import type { InvoiceProvider } from "./types";

export const INVOICE_PROVIDERS: InvoiceProvider[] = [manualProvider, arubaProvider, fattureInCloudProvider];

export function getInvoiceProvider(id: string): InvoiceProvider | undefined {
  return INVOICE_PROVIDERS.find((p) => p.id === id);
}

export type { InvoiceProvider, ProviderSendResult, InvoiceWithDetails } from "./types";
