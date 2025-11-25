// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    // Zoho visitor ID
    visitorId: {
      type: String,
      default: null
    },

    // Customer email (if available)
    email: {
      type: String,
      default: null
    },

    // TRACK_ORDER / RETURN_ORDER / CANCEL_ORDER / STOCK_CHECK / REFUND etc.
    eventType: {
      type: String,
      required: true,
      enum: [
        "TRACK_ORDER",
        "RETURN_ORDER",
        "CANCEL_ORDER",
        "STOCK_CHECK",
        "REFUND",
        "OTHER"
      ],
      default: "OTHER"
    },

    // Useful for faster queries
    orderNumber: {
      type: String,
      index: true,
      sparse: true,
      default: null
    },

    // Whether the operation succeeded
    status: {
      type: String,
      enum: ["success", "failed", "unknown"],
      default: "unknown"
    },

    // Human-readable error or system error
    errorMessage: {
      type: String,
      default: null
    },

    // Shopify / WooCommerce / bigcommerce (future ready)
    platform: {
      type: String,
      default: "shopify"
    },

    // Generic metadata object (order summary, stock details, eligibility, etc.)
    metadata: {
      type: Object,
      default: {}
    },

    // Sentiment from AI
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral"
    },

    // AI recommendation to operator
    aiNotes: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);
