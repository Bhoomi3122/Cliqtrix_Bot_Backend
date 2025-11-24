// services/ecommerceManager.js
import * as shopify from "../adapters/shopify/shopifyService.js";

const platform = process.env.ECOM_PLATFORM || "shopify";

let impl;

if (platform === "shopify") {
  impl = shopify;
} else {
  // You can later plug WooCommerce/Magento here
  throw new Error(`Platform '${platform}' not implemented`);
}

export const ecommerceManager = {
  findOrder: impl.findOrder,
  getOrderSummary: impl.getOrderSummary,
  checkReturnEligibility: impl.checkReturnEligibility,
  processReturn: impl.processReturn,
  checkStock: impl.checkStock
};
