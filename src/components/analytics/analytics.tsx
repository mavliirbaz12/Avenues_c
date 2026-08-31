import Script from "next/script";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { env } from "@/lib/env";

/**
 * Marketing analytics slots — GA4, Meta Pixel, and Vercel Web Analytics.
 *
 * Nothing renders when the env vars are blank: no script tag, no empty
 * loader, no cookie. The day the founder starts running Instagram ads,
 * setting NEXT_PUBLIC_GA4_ID / NEXT_PUBLIC_META_PIXEL_ID turns these on
 * with a redeploy, and the purchase event on the order page starts
 * reporting conversions automatically.
 *
 * Vercel Web Analytics is always enabled and provides privacy-friendly,
 * cookie-less analytics for basic traffic insights.
 */
export function Analytics() {
  const ga4 = env.NEXT_PUBLIC_GA4_ID;
  const pixel = env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <>
      {ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4}');`}
          </Script>
        </>
      )}

      {pixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixel}');
            fbq('track', 'PageView');`}
        </Script>
      )}

      <VercelAnalytics />
    </>
  );
}
