/**
 * Mock-gateway sentinels, in their own module with no Node imports.
 *
 * The mock payment page is a client component and needs these values; keeping
 * them here stops it from pulling lib/payments/razorpay.ts — and therefore
 * node:crypto and the Razorpay SDK — into the browser bundle.
 */
export const MOCK_ORDER_PREFIX = "order_mock_";
export const MOCK_PAYMENT_PREFIX = "pay_mock_";
export const MOCK_SIGNATURE = "mock_signature_ok";
