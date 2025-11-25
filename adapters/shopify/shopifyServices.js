// adapters/shopify/shopifyService.js
import axios from "axios";

// ----------------------
// DOMAIN RESOLUTION LOGIC
// ----------------------
let storeDomain = "";

if (process.env.SHOPIFY_STORE_DOMAIN) {
  storeDomain = process.env.SHOPIFY_STORE_DOMAIN
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
} else if (process.env.SHOPIFY_STORE_URL) {
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

// ---------------------------------------------------------
// NORMALIZE ORDER NUMBER (#1033 → {raw:"#1033",numeric:1033,name:"#1033"})
// ---------------------------------------------------------
export const normalizeOrderNumber = (value) => {
  if (!value) return null;

  value = decodeURIComponent(String(value)).trim();
  const num = value.replace("#", "");

  return {
    raw: value,
    numeric: Number(num),
    name: `#${num}`
  };
};

// ---------------------------------------------------------
// FIND CUSTOMER BY EMAIL
// ---------------------------------------------------------
const findCustomerByEmail = async (email) => {
  try {
    const res = await shopifyClient.get(
      `/customers/search.json?query=email:${encodeURIComponent(email)}`
    );
    return res.data.customers?.[0] || null;
  } catch (err) {
    console.error("❌ Shopify email search error:", err.response?.data || err.message);
    return null;
  }
};

// ---------------------------------------------------------
// GET ORDERS FOR CUSTOMER
// ---------------------------------------------------------
const getOrdersForCustomer = async (customerId) => {
  try {
    const res = await shopifyClient.get(
      `/orders.json?customer_id=${customerId}&status=any&limit=50`
    );
    return res.data.orders || [];
  } catch (err) {
    console.error("❌ Shopify orders-for-customer error:", err.response?.data || err.message);
    return [];
  }
};

// ---------------------------------------------------------
// MAP SHOPIFY FULFILLMENT → CANONICAL SHIPPING STATUS
// ---------------------------------------------------------
const mapShippingStatus = (order) => {
  if (!order.fulfillments || order.fulfillments.length === 0) {
    return "not_shipped";
  }

  const f = order.fulfillments[0];

  if (f.status === "success") return "delivered";
  if (f.status === "in_transit") return "in_transit";
  if (f.status === "out_for_delivery") return "out_for_delivery";

  return "in_transit";
};

// ---------------------------------------------------------
// FIND ORDER (email preferred, fallback to order number)
// ---------------------------------------------------------
export const findOrder = async ({ orderNumber, email }) => {
  try {
    let normalized = orderNumber ? normalizeOrderNumber(orderNumber) : null;

    // Search by email first
    if (email) {
      const customer = await findCustomerByEmail(email);
      if (!customer) return null;

      const orders = await getOrdersForCustomer(customer.id);

      if (normalized) {
        return (
          orders.find((o) => o.order_number === normalized.numeric) ||
          orders.find((o) => o.name === normalized.name) ||
          null
        );
      }

      return orders[0] || null;
    }

    // Search by orderNumber alone
    if (normalized) {
      try {
        const res = await shopifyClient.get(
          `/orders.json?name=${encodeURIComponent(normalized.name)}&status=any&limit=1`
        );
        if (res.data.orders?.length) return res.data.orders[0];
      } catch {}

      try {
        const res = await shopifyClient.get(`/orders.json?status=any&limit=50`);
        return (
          res.data.orders?.find((o) => o.order_number === normalized.numeric) || null
        );
      } catch {}
    }

    return null;
  } catch (err) {
    console.error("❌ Shopify findOrder final error:", err.response?.data || err.message);
    return null;
  }
};

// ---------------------------------------------------------
// SUMMARY (return canonical structure)
// ---------------------------------------------------------
export const getOrderSummary = (order) => {
  if (!order) return null;

  return {
    orderId: order.id,
    orderNumber: order.name,
    orderNumberRaw: order.order_number,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    shippingStatus: mapShippingStatus(order),
    totalPrice: order.total_price,
    currency: order.currency,
    createdAt: order.created_at,
    customerEmail: order.email,
    lineItems: (order.line_items || []).map((i) => ({
      title: i.title,
      quantity: i.quantity,
      price: i.price,
      sku: i.sku,
      lineItemId: i.id
    })),
    tracking: order.fulfillments?.[0]?.tracking_number || null,
    trackingUrl: order.fulfillments?.[0]?.tracking_url || null
  };
};

// ---------------------------------------------------------
// RETURN ELIGIBILITY
// ---------------------------------------------------------
export const checkReturnEligibility = (order, windowDays = 7) => {
  if (!order) return { eligible: false, reason: "ORDER_NOT_FOUND" };

  const shippingStatus = mapShippingStatus(order);

  if (shippingStatus !== "delivered") {
    return { eligible: false, reason: "ORDER_NOT_DELIVERED_YET" };
  }

  const diffDays =
    (new Date() - new Date(order.created_at)) / (1000 * 60 * 60 * 24);

  if (diffDays > windowDays) {
    return { eligible: false, reason: "RETURN_WINDOW_EXPIRED" };
  }

  return { eligible: true, reason: "OK" };
};

// ---------------------------------------------------------
// SIMULATED RETURN (kept unchanged)
// ---------------------------------------------------------
export const processReturn = (order) => {
  if (!order) {
    return {
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found. Cannot process return."
    };
  }

  return {
    success: true,
    code: "RETURN_SUBMITTED",
    message: `Return request submitted for order ${order.name}.`
  };
};

// ---------------------------------------------------------
// STOCK CHECK
// ---------------------------------------------------------
export const checkStock = async ({ variantId, productId }) => {
  try {
    if (variantId) {
      const res = await shopifyClient.get(`/variants/${variantId}.json`);
      const variant = res.data.variant;

      return {
        success: true,
        code: "OK",
        inStock: variant.inventory_quantity > 0,
        quantity: variant.inventory_quantity,
        variantId: variant.id,
        productId: variant.product_id
      };
    }

    return { success: false, code: "MISSING_VARIANT_ID", inStock: false, quantity: 0 };
  } catch (err) {
    console.error("❌ Shopify checkStock error:", err.response?.data || err.message);
    return {
      success: false,
      code: "STOCK_CHECK_FAILED",
      inStock: false,
      quantity: 0,
      error: err.message
    };
  }
};

// ---------------------------------------------------------
// CANCEL ELIGIBILITY (REAL SHOPIFY RULES)
// ---------------------------------------------------------
export const checkCancelEligibility = (order) => {
  if (!order) return { eligible: false, reason: "ORDER_NOT_FOUND" };

  if (order.cancelled_at) {
    return { eligible: false, reason: "ORDER_ALREADY_CANCELLED" };
  }

  if (order.fulfillment_status !== null) {
    return { eligible: false, reason: "ORDER_ALREADY_FULFILLED" };
  }

  if (order.financial_status === "voided") {
    return { eligible: false, reason: "PAYMENT_VOIDED" };
  }

  return { eligible: true, reason: "OK" };
};

// ---------------------------------------------------------
// REAL SHOPIFY CANCEL ORDER (restock=true)
// ---------------------------------------------------------
const performCancellation = async (orderId) => {
  try {
    const res = await shopifyClient.post(
      `/orders/${orderId}/cancel.json`,
      {
        restock: true
      }
    );

    return {
      success: true,
      code: "CANCEL_SUCCESS",
      cancellation: res.data
    };
  } catch (err) {
    console.error("❌ Shopify cancel error:", err.response?.data || err.message);
    return {
      success: false,
      code: "CANCEL_FAILED",
      error: err.response?.data || err.message
    };
  }
};

// ---------------------------------------------------------
// REAL SHOPIFY REFUND ORDER
// ---------------------------------------------------------
const performRefund = async (order) => {
  try {
    // Build refund line items
    const refundLineItems = (order.line_items || []).map((item) => ({
      line_item_id: item.id,
      quantity: item.quantity
    }));

    const res = await shopifyClient.post(
      `/orders/${order.id}/refunds.json`,
      {
        refund: {
          refund_line_items: refundLineItems
        }
      }
    );

    return {
      success: true,
      code: "REFUND_SUCCESS",
      refund: res.data
    };
  } catch (err) {
    console.error("❌ Shopify refund error:", err.response?.data || err.message);
    return {
      success: false,
      code: "REFUND_FAILED",
      error: err.response?.data || err.message
    };
  }
};

// ---------------------------------------------------------
// CANCEL + REFUND WORKFLOW
// ---------------------------------------------------------
export const cancelAndRefund = async (order) => {
  if (!order) {
    return {
      success: false,
      code: "ORDER_NOT_FOUND",
      message: "Order not found."
    };
  }

  const el = checkCancelEligibility(order);
  if (!el.eligible) {
    return {
      success: false,
      code: el.reason,
      message: `Order cannot be cancelled: ${el.reason}`
    };
  }

  // Step 1: Cancel
  const cancelRes = await performCancellation(order.id);
  if (!cancelRes.success) {
    return {
      success: false,
      code: "CANCEL_FAILED",
      message: "Cancellation failed.",
      error: cancelRes.error
    };
  }

  // Step 2: Refund
  const refundRes = await performRefund(order);

  if (!refundRes.success) {
    return {
      success: false,
      code: "REFUND_FAILED",
      message: "Order was cancelled but refund failed.",
      error: refundRes.error
    };
  }

  return {
    success: true,
    code: "CANCEL_AND_REFUND_SUCCESS",
    message: `Order ${order.name} has been cancelled and refunded successfully.`,
    cancellation: cancelRes.cancellation,
    refund: refundRes.refund
  };
};
