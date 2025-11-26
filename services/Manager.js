// services/ecommerceManager.js
import * as shopify from "../adapters/shopify/shopifyServices.js";

const platform = process.env.ECOM_PLATFORM || "shopify";

let impl;

if (platform === "shopify") {
  impl = shopify;
} else {
  // Future: plug WooCommerce / Magento here
  throw new Error(`Platform '${platform}' not implemented`);
}

export const ecommerceManager = {
  // Order lookup
  findOrder: impl.findOrder,
  getOrderSummary: impl.getOrderSummary,

  // Returns
  checkReturnEligibility: impl.checkReturnEligibility,
  processReturn: impl.processReturn,

  // Stock
  checkStock: impl.checkStock,

  // NEW — Cancellation flow
  checkCancelEligibility: impl.checkCancelEligibility,
  cancelAndRefund: impl.cancelAndRefund
};
