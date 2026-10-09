/**
 * Feature flags decide what the UI shows. Connector registries (src/connectors) decide which
 * implementation runs. Every flag stays false until its connector passes the tests in CONNECTORS.md.
 */
export const flags = {
  cardPayments: false,
  athPayments: false,
  splitBill: true,
  sharedTab: true,
  pinSwitch: false,
  offlineMode: false,
  networkPrinting: false,
  aiImport: false,
  fiscalProcessor: false,
  smsReceipts: false,
} as const satisfies Record<string, boolean>;
