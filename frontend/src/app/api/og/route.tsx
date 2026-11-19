import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/**
 * Dynamic OpenGraph (OG) Image Generator for CakeToHome.
 * Generates 1200x630 social share cards with Navy & Gold branding.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const title = searchParams.get("title") || "CakeToHome — Handcrafted Cakes";
    const description = searchParams.get("description") || "Kerala's Premium Cake Bakery. Delivered Fresh in 2 Hours.";
    const price = searchParams.get("price");
    const badge = searchParams.get("badge") || "Same Day Delivery";
    const rating = searchParams.get("rating") || "4.9";
    const reviews = searchParams.get("reviews") || "1,200+";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#0B192C", // Brand Deep Navy
            padding: "50px 60px",
            fontFamily: "sans-serif",
            position: "relative",
          }}
        >
          {/* Subtle background glow */}
          <div
            style={{
              position: "absolute",
              top: "-150px",
              right: "-100px",
              width: "500px",
              height: "500px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(212, 175, 55, 0.15) 0%, rgba(11, 25, 44, 0) 70%)",
            }}
          />

          {/* Top Bar: Brand Logo & Badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  backgroundColor: "#C28A2C", // Brand Gold
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0B192C",
                  fontSize: "24px",
                  fontWeight: "bold",
                }}
              >
                🎂
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    color: "#FFFFFF",
                    fontSize: "26px",
                    fontWeight: "800",
                    letterSpacing: "-0.5px",
                  }}
                >
                  Cake<span style={{ color: "#C28A2C" }}>To</span>Home
                </span>
                <span style={{ color: "#94A3B8", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Fresh Bakery
                </span>
              </div>
            </div>

            {/* Delivery Badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "rgba(212, 175, 55, 0.15)",
                border: "1px solid rgba(212, 175, 55, 0.4)",
                borderRadius: "30px",
                padding: "8px 20px",
                color: "#F3C623",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              <span>⚡</span>
              <span>{badge}</span>
            </div>
          </div>

          {/* Middle: Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "950px" }}>
            <h1
              style={{
                color: "#FFFFFF",
                fontSize: title.length > 40 ? "46px" : "56px",
                fontWeight: "800",
                lineHeight: "1.15",
                letterSpacing: "-1px",
                margin: "0",
              }}
            >
              {title}
            </h1>

            <p
              style={{
                color: "#94A3B8",
                fontSize: "20px",
                lineHeight: "1.5",
                margin: "0",
              }}
            >
              {description}
            </p>
          </div>

          {/* Bottom Bar: Price, Rating & Trust */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              width: "100%",
              borderTop: "1px solid rgba(148, 163, 184, 0.15)",
              paddingTop: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
              {price && (
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ color: "#94A3B8", fontSize: "14px" }}>Starts at</span>
                  <span style={{ color: "#C28A2C", fontSize: "36px", fontWeight: "800" }}>{price}</span>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#F3C623", fontSize: "18px" }}>★</span>
                <span style={{ color: "#FFFFFF", fontSize: "18px", fontWeight: "700" }}>{rating}</span>
                <span style={{ color: "#6B7280", fontSize: "14px" }}>({reviews} reviews)</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#6B7280", fontSize: "14px" }}>
              <span>caketohome.com</span>
              <span>•</span>
              <span>100% Eggless Options</span>
              <span>•</span>
              <span>Kerala</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err: any) {
    return new Response(`Failed to generate OG image: ${err.message}`, { status: 500 });
  }
}
