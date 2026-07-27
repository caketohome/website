import { defineMiddlewares, authenticate } from "@medusajs/framework";
import { ipWhitelistMiddleware, rateLimitMiddleware, twoFactorMiddleware } from "../middlewares/security";

const isAllowed = (req, res, next) => {
  const { shop_id, delivery_partner_id } = req.auth_context.app_metadata;

  if (shop_id || delivery_partner_id) {
    const user = {
      actor_type: shop_id ? "shop" : "delivery_partner",
      user_id: shop_id || delivery_partner_id,
    };

    req.user = user;

    next();
  } else {
    res.status(403).json({
      message:
        "Forbidden. Reason: No shop_id or delivery_partner_id in app_metadata",
    });
  }
};

export default defineMiddlewares({
  routes: [
    {
      method: ["GET"],
      matcher: "/store/users/me",
      middlewares: [
        authenticate(["delivery_partner", "shop"], "bearer"),
        isAllowed,
      ],
    },
    {
      method: ["POST"],
      matcher: "/store/users",
      middlewares: [
        authenticate(["delivery_partner", "shop"], "bearer", {
          allowUnregistered: true,
        }),
      ],
    },
    {
      method: ["POST", "DELETE"],
      matcher: "/store/shops/:id/**",
      middlewares: [authenticate(["shop", "admin"], "bearer")],
    },
    {
      matcher: "/store/shops/:id/admin/**",
      middlewares: [authenticate(["shop", "admin"], "bearer")],
    },
    {
      method: ["GET", "POST", "DELETE"],
      matcher: "/store/customers/addresses/**",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET", "POST"],
      matcher: "/store/rewards/**",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET", "POST", "DELETE"],
      matcher: "/store/wishlist",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["POST"],
      matcher: "/store/products/:id/reviews",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET", "POST"],
      matcher: "/store/subscriptions",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["POST"],
      matcher: "/store/subscriptions/:id/**",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET", "POST"],
      matcher: "/store/products/recently-viewed",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: true })],
    },
    {
      method: ["GET"],
      matcher: "/store/orders",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET", "POST"],
      matcher: "/store/orders/:id/**",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      method: ["GET"],
      matcher: "/store/orders/:id",
      middlewares: [authenticate("customer", "bearer", { allowUnregistered: false })],
    },
    {
      matcher: "/admin/**",
      middlewares: [ipWhitelistMiddleware, twoFactorMiddleware],
    },
    {
      matcher: "/store/**",
      middlewares: [rateLimitMiddleware],
    },
  ],
});
