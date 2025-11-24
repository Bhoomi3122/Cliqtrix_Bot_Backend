// adapters/shopify/shopifyService.js
import axios from "axios";

// ----------------------
// DOMAIN RESOLUTION LOGIC
// ----------------------
let storeDomain = "";

// If user provides STORE_DOMAIN → use it
if (process.env.SHOPIFY_STORE_DOMAIN) {
  storeDomain = process.env.SHOPIFY_STORE_DOMAIN
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}
// Else fallback to STORE_URL
else if (process.env.SHOPIFY_STORE_URL) {
  storeDomain = process.env.SHOPIFY_STORE_URL
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

if (!storeDomain) {
  console.error("❌ Shopify domain missing. Set SHOPIFY_STORE_DOMAIN in .env");
}

if (!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.error("❌ Shopify admin access token missing. Set SHOPIFY_ADMIN_ACCESS_TOKEN in .env");
}

// ----------------------
// SHOPIFY CLIENT
// ----------------------
export const shopifyClient = axios.create({
  baseURL: `https://${storeDomain}/admin/api/${process.env.SHOPIFY_API_VERSION}`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    "Content-Type": "application/json"
  }
});

// ----------------------
// FIND ORDER
// ----------------------
export const findOrder = async ({ orderNumber, email }) => {
  try {
    if (email) {
      const res = await shopifyClient.get(
        `/orders.json?email=${encodeURIComponent(email)}&status=any&limit=5`
      );
      return res.data.orders?.[0] || null;
    }

    if (orderNumber) {
      const res = await shopifyClient.get(
        `/orders.json?name=${encodeURIComponent(orderNumber)}&status=any&limit=1`
      );
      return res.data.orders?.[0] || null;
    }

    return null;
  } catch (err) {
    console.error("Shopify findOrder error:", err.response?.data || err.message);
    return null;
  }
};

// ----------------------
// SUMMARY
// ----------------------
export const getOrderSummary = (order) => {
  if (!order) return null;

  return {
    orderId: order.id,
    orderNumber: order.name,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    totalPrice: order.total_price,
    currency: order.currency,
    createdAt: order.created_at,
    customerEmail: order.email,
    lineItems: (order.line_items || []).map((i) => ({
      title: i.title,
      quantity: i.quantity,
      price: i.price,
      sku: i.sku
    }))
  };
};

// ----------------------
// RETURN ELIGIBILITY
// ----------------------
export const checkReturnEligibility = (order) => {
  if (!order) return { eligible: false, reason: "Order not found" };

  const orderDate = new Date(order.created_at);
  const today = new Date();
  const diffDays = (today - orderDate) / (1000 * 60 * 60 * 24);

  if (diffDays <= 7) {
    return { eligible: true, reason: "Within 7-day return window" };
  }

  return { eligible: false, reason: "Return period exceeded" };
};

// ----------------------
// SIMULATED RETURN
// ----------------------
export const processReturn = (order) => {
  if (!order) {
    return {
      success: false,
      message: "Order not found. Cannot process return."
    };
  }

  return {
    success: true,
    message: `Return request submitted for order ${order.name} (demo mode).`
  };
};

// ----------------------
// STOCK CHECK
// ----------------------
export const checkStock = async ({ productId, variantId }) => {
  try {
    if (variantId) {
      const res = await shopifyClient.get(`/variants/${variantId}.json`);
      const variant = res.data.variant;

      return {
        inStock: variant.inventory_quantity > 0,
        quantity: variant.inventory_quantity,
        variantId: variant.id
      };
    }

    return { inStock: false, quantity: 0 };
  } catch (err) {
    console.error("Shopify checkStock error:", err.response?.data || err.message);
    return { inStock: false, quantity: 0, error: err.message };
  }
};
