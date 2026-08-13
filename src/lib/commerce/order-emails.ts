import { sendEmail, emailShell, escapeHtml } from "@/lib/email";
import { formatPaise } from "@/lib/format";
import { orderAccessToken } from "./order-token";
import { siteUrl, env } from "@/lib/env";

/**
 * Transactional order emails. Each one is fire-and-forget from the caller's
 * point of view — a failed email must never roll back a paid order.
 */

type OrderForEmail = {
  id: string;
  orderNumber: string;
  email: string;
  paymentMethod: "RAZORPAY" | "COD";
  totalPaise: number;
  shipName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  items: {
    productName: string;
    variantSize: string;
    quantity: number;
    totalPaise: number;
  }[];
};

function orderUrl(order: { id: string; orderNumber: string }) {
  return `${siteUrl}/order/${order.orderNumber}?t=${orderAccessToken(order.id)}`;
}

function itemsTable(items: OrderForEmail["items"]) {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #232327;">
          <span style="color:#F2EDE3;">${escapeHtml(i.productName)}</span>
          <span style="color:#6B655D;"> · ${escapeHtml(i.variantSize)} × ${i.quantity}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #232327;color:#F2EDE3;white-space:nowrap;">
          ${formatPaise(i.totalPaise)}
        </td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:400 14px/1.5 Arial,sans-serif;">${rows}</table>`;
}

export async function sendOrderConfirmedEmail(order: OrderForEmail) {
  const addr = [order.shipLine1, order.shipLine2, `${order.shipCity}, ${order.shipState} ${order.shipPincode}`]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join("<br>");

  await sendEmail({
    to: order.email,
    subject: `Order confirmed — ${order.orderNumber}`,
    html: emailShell({
      preheader: `Your Avenues order ${order.orderNumber} is confirmed.`,
      heading: "Your order is confirmed",
      body: `
        <p>Thank you. Order <strong style="color:#F2EDE3;">${order.orderNumber}</strong> is
        confirmed and will be dispatched within 24 to 48 hours.</p>
        ${itemsTable(order.items)}
        <p style="text-align:right;margin-top:12px;">
          <strong style="color:#F2EDE3;">Total: ${formatPaise(order.totalPaise)}</strong>
          ${order.paymentMethod === "COD" ? '<br><span style="color:#6B655D;font-size:13px;">Payable on delivery</span>' : ""}
        </p>
        <p style="margin-top:20px;color:#6B655D;">Delivering to:<br>
        <span style="color:#9A938A;">${escapeHtml(order.shipName)}<br>${addr}</span></p>`,
      cta: { label: "Track your order", href: orderUrl(order) },
    }),
  });

  // A copy for the founder so no order goes unnoticed at launch volume.
  if (env.EMAIL_ADMIN) {
    await sendEmail({
      to: env.EMAIL_ADMIN,
      subject: `New order ${order.orderNumber} — ${formatPaise(order.totalPaise)} (${order.paymentMethod})`,
      html: emailShell({
        preheader: `${order.items.length} item(s) to ${order.shipCity}`,
        heading: `New order ${order.orderNumber}`,
        body: `
          ${itemsTable(order.items)}
          <p style="margin-top:14px;">
            <strong style="color:#F2EDE3;">${formatPaise(order.totalPaise)}</strong> ·
            ${order.paymentMethod} · ${escapeHtml(order.shipCity)}, ${escapeHtml(order.shipState)}
          </p>`,
        cta: { label: "Open in admin", href: `${siteUrl}/admin/orders` },
      }),
    });
  }
}

export async function sendOrderShippedEmail(
  order: OrderForEmail,
  shipping: { waybill: string; courier: string; trackingUrl?: string | null },
) {
  await sendEmail({
    to: order.email,
    subject: `On its way — ${order.orderNumber}`,
    html: emailShell({
      preheader: `Your Avenues order has shipped. AWB ${shipping.waybill}.`,
      heading: "Your order has shipped",
      body: `
        <p>Order <strong style="color:#F2EDE3;">${order.orderNumber}</strong> left us and is
        with ${escapeHtml(shipping.courier)}.</p>
        <p>Tracking number (AWB): <strong style="color:#F2EDE3;">${escapeHtml(shipping.waybill)}</strong></p>`,
      cta: { label: "Follow the journey", href: orderUrl(order) },
    }),
  });
}

export async function sendOrderDeliveredEmail(order: OrderForEmail) {
  await sendEmail({
    to: order.email,
    subject: `Delivered — ${order.orderNumber}`,
    html: emailShell({
      preheader: "Your Avenues order has arrived.",
      heading: "Delivered",
      body: `
        <p>Order <strong style="color:#F2EDE3;">${order.orderNumber}</strong> has arrived.</p>
        <p>Two sprays on pulse points; don't rub your wrists together. Give it an
        hour before you judge it — the base notes are the point.</p>
        <p style="color:#6B655D;">Loved it? A short review on the product page
        helps a small brand more than you'd think.</p>`,
      cta: { label: "Write a review", href: `${siteUrl}/account/orders` },
    }),
  });
}

export async function sendOrderCancelledEmail(
  order: OrderForEmail,
  opts: { refundPaise: number | null },
) {
  await sendEmail({
    to: order.email,
    subject: `Cancelled — ${order.orderNumber}`,
    html: emailShell({
      preheader: `Your Avenues order ${order.orderNumber} is cancelled.`,
      heading: "Order cancelled",
      body: `
        <p>Order <strong style="color:#F2EDE3;">${order.orderNumber}</strong> has been cancelled.</p>
        ${
          opts.refundPaise
            ? `<p>A refund of <strong style="color:#F2EDE3;">${formatPaise(opts.refundPaise)}</strong>
               has been initiated to your original payment method. Banks typically
               post it within 5 to 7 working days.</p>`
            : "<p>Nothing was charged for this order.</p>"
        }`,
      cta: { label: "Shop the five", href: `${siteUrl}/shop` },
    }),
  });
}
