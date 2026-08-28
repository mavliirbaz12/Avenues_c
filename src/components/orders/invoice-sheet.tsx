import type { Order, OrderItem } from "@prisma/client";
import type { StoreSettings } from "@/lib/settings";
import { formatPaise, formatDate } from "@/lib/format";
import { PrintButton } from "@/components/admin/print-button";

/**
 * The printable tax invoice, shared verbatim by the admin route and the
 * customer's "Download invoice" link — one document, two doors, so the copy
 * a customer files can never disagree with the copy in the back office.
 *
 * Deliberately black-on-white: this is a paper document, not a screen.
 * GST-ready — sequential invoice number, seller details with GSTIN, HSN 3303
 * (perfumes and toilet waters), MRP-inclusive figures as Legal Metrology
 * requires.
 */
export function InvoiceSheet({
  order,
  settings,
}: {
  order: Order & { items: OrderItem[] };
  settings: StoreSettings;
}) {
  return (
    <div className="min-h-dvh bg-white p-8 font-sans text-[0.8125rem] leading-relaxed text-neutral-900 print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>

        {/* Head */}
        <header className="flex items-start justify-between border-b-2 border-neutral-900 pb-6">
          <div>
            <p className="font-display text-2xl tracking-[0.2em] text-neutral-900">AVENUES</p>
            <p className="mt-1 text-[0.6875rem] uppercase tracking-[0.2em] text-neutral-500">Perfumes</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-medium">Tax invoice</p>
            <p className="mt-1 text-neutral-600">{order.invoiceNumber}</p>
            <p className="text-neutral-600">{formatDate(order.invoicedAt)}</p>
          </div>
        </header>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 border-b border-neutral-300 py-5">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Sold by</p>
            <p className="mt-1.5 font-medium">{settings.manufacturerName}</p>
            {settings.manufacturerAddress && (
              <p className="whitespace-pre-line text-neutral-600">{settings.manufacturerAddress}</p>
            )}
            {settings.gstin && <p className="mt-1">GSTIN: {settings.gstin}</p>}
            <p className="text-neutral-600">{settings.customerCareEmail}</p>
          </div>
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wider text-neutral-500">Billed & shipped to</p>
            <p className="mt-1.5 font-medium">{order.shipName}</p>
            <p className="text-neutral-600">
              {order.shipLine1}
              {order.shipLine2 && <>, {order.shipLine2}</>}
              <br />
              {order.shipCity}, {order.shipState} {order.shipPincode}
              <br />
              {order.shipPhone} · {order.email}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex gap-10 border-b border-neutral-300 py-3 text-neutral-600">
          <span>
            Order: <span className="text-neutral-900">{order.orderNumber}</span>
          </span>
          <span>
            Placed: <span className="text-neutral-900">{formatDate(order.placedAt ?? order.createdAt)}</span>
          </span>
          <span>
            Payment:{" "}
            <span className="text-neutral-900">
              {order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid (Razorpay)"}
            </span>
          </span>
        </div>

        {/* Items */}
        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-900 text-left text-[0.6875rem] uppercase tracking-wider text-neutral-500">
              <th className="py-2 font-normal">Item</th>
              <th className="py-2 text-center font-normal">HSN</th>
              <th className="py-2 text-center font-normal">Qty</th>
              <th className="py-2 text-right font-normal">MRP</th>
              <th className="py-2 text-right font-normal">Price</th>
              <th className="py-2 text-right font-normal">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-neutral-200">
                <td className="py-2.5">
                  {item.productName}
                  <span className="text-neutral-500"> · {item.variantSize} · {item.sku}</span>
                </td>
                <td className="py-2.5 text-center text-neutral-600">3303</td>
                <td className="py-2.5 text-center">{item.quantity}</td>
                <td className="money py-2.5 text-right text-neutral-500">{formatPaise(item.mrpPaise)}</td>
                <td className="money py-2.5 text-right">{formatPaise(item.unitPricePaise)}</td>
                <td className="money py-2.5 text-right">{formatPaise(item.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto mt-4 w-64 space-y-1.5">
          <TotalRow label="Subtotal">{formatPaise(order.subtotalPaise)}</TotalRow>
          {order.discountPaise > 0 && (
            <TotalRow label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`}>
              −{formatPaise(order.discountPaise)}
            </TotalRow>
          )}
          <TotalRow label="Delivery">
            {order.shippingPaise === 0 ? "Free" : formatPaise(order.shippingPaise)}
          </TotalRow>
          {order.codFeePaise > 0 && <TotalRow label="COD handling">{formatPaise(order.codFeePaise)}</TotalRow>}
          <div className="flex justify-between border-t-2 border-neutral-900 pt-2 text-base font-medium">
            <span>Total</span>
            <span className="money">{formatPaise(order.totalPaise)}</span>
          </div>
          <p className="text-right text-[0.6875rem] text-neutral-500">Inclusive of all taxes</p>
        </div>

        <footer className="mt-10 border-t border-neutral-300 pt-4 text-[0.6875rem] text-neutral-500">
          <p>
            Country of origin: India. Net quantities as stated per item. Customer care:{" "}
            {settings.customerCareEmail}
            {settings.customerCarePhone && <> · {settings.customerCarePhone}</>}
          </p>
          <p className="mt-1">This is a computer-generated invoice and needs no signature.</p>
        </footer>
      </div>
    </div>
  );
}

function TotalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-neutral-700">
      <span>{label}</span>
      <span className="money">{children}</span>
    </div>
  );
}
