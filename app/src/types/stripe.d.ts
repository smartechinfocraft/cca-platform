declare global {
  interface StripePaymentIntent {
    id: string;
    status: string;
  }

  interface StripePaymentElement {
    mount: (selector: string | HTMLElement) => void;
    unmount: () => void;
  }

  interface StripeElements {
    create: (type: "payment") => StripePaymentElement;
  }

  interface StripeClient {
    elements: (options: { clientSecret: string; appearance?: Record<string, unknown> }) => StripeElements;
    confirmPayment: (options: {
      elements: StripeElements;
      confirmParams: { return_url: string };
      redirect?: "always" | "if_required";
    }) => Promise<{ error?: { message?: string }; paymentIntent?: StripePaymentIntent }>;
  }

  interface Window {
    Stripe?: (publishableKey: string) => StripeClient;
  }
}

export {};
