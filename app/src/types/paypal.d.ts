// ============================================================
//  types/paypal.d.ts
//  Minimal shape of the PayPal JS SDK (https://www.paypal.com/sdk/js)
//  actually used by this app — just enough to type-check our own
//  calls, not a full SDK model. Declared once here so multiple
//  pages (PaymentPage, DonatePage) that both load the PayPal
//  script don't end up with conflicting global declarations.
// ============================================================

export interface PayPalButtonsInstance {
  render: (container: HTMLElement) => void;
}

export interface PayPalNamespace {
  Buttons: (config: {
    style?: Record<string, string | number>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => PayPalButtonsInstance;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

export {};
