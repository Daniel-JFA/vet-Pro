// URL del Web Checkout de Wompi. El pago se confirma por webhook en el backend;
// al terminar, Wompi devuelve al usuario a redirectUrl (/marketplace/payment-result).
export interface WompiCheckoutParams {
  publicKey: string;
  currency: string;
  amountInCents: number;
  reference: string;
  signature: string;
  redirectUrl: string;
}

export function buildWompiCheckoutUrl(p: WompiCheckoutParams): string {
  const params = [
    `public-key=${encodeURIComponent(p.publicKey)}`,
    `currency=${encodeURIComponent(p.currency)}`,
    `amount-in-cents=${p.amountInCents}`,
    `reference=${encodeURIComponent(p.reference)}`,
    `signature:integrity=${encodeURIComponent(p.signature)}`,
    `redirect-url=${encodeURIComponent(p.redirectUrl)}`
  ];
  return `https://checkout.wompi.co/p/?${params.join('&')}`;
}
