"use client";

import React, { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: (...args: any[]) => void;
  }
}

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID ||
  process.env.NEXT_PUBLIC_META_PIXEL_ID ||
  "";

/**
 * Universal safe Meta Pixel tracker.
 * Only executes if `window.fbq` is initialized.
 */
export function trackMetaEvent(
  eventName: string,
  params: Record<string, any> = {},
  eventId?: string
) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  try {
    if (eventId) {
      window.fbq("track", eventName, params, { eventID: eventId });
    } else {
      window.fbq("track", eventName, params);
    }
  } catch (err) {
    console.debug("[MetaPixel] Track event error:", err);
  }
}

/**
 * Client Event: ViewContent (Product Detail View)
 */
export function trackMetaViewContent(product: {
  id: string;
  title: string;
  price: number;
  category?: string;
}) {
  trackMetaEvent("ViewContent", {
    content_name: product.title,
    content_ids: [product.id],
    content_type: "product",
    content_category: product.category || "Cakes",
    value: product.price,
    currency: "INR",
  });
}

/**
 * Client Event: AddToCart
 */
export function trackMetaAddToCart(item: {
  id: string;
  title: string;
  price: number;
  quantity?: number;
}) {
  trackMetaEvent("AddToCart", {
    content_name: item.title,
    content_ids: [item.id],
    content_type: "product",
    value: item.price * (item.quantity || 1),
    currency: "INR",
  });
}

/**
 * Client Event: InitiateCheckout
 */
export function trackMetaInitiateCheckout(cart: {
  value: number;
  numItems?: number;
}) {
  trackMetaEvent("InitiateCheckout", {
    value: cart.value,
    currency: "INR",
    num_items: cart.numItems || 1,
  });
}

/**
 * Client Event: Purchase (Deduplicated with CAPI via deterministic eventID)
 */
export function trackMetaPurchase(order: {
  orderId: string;
  value: number;
  currency?: string;
}) {
  const eventId = `purchase_${order.orderId}`;
  trackMetaEvent(
    "Purchase",
    {
      value: order.value,
      currency: order.currency || "INR",
      order_id: order.orderId,
      content_type: "product",
    },
    eventId
  );
}

/**
 * Meta Pixel Script Loader & Route Observer
 */
export function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track PageView on route navigation
  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname, searchParams]);

  if (!META_PIXEL_ID) {
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
