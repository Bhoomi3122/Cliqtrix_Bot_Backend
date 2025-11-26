// routes/ecommerceRoutes.js
import express from "express";
import { Event } from "../models/Event.js";
import { analyzeSentimentAndIntent } from "../services/aiService.js";
import { ecommerceManager } from "../services/Manager.js";

const router = express.Router();

/**
 * Helper to normalize incoming order ID
 */
const normalizeIncomingOrderId = (v) => {
  if (!v && v !== 0) return null;
  try {
    return String(v).trim();
  } catch {
    return null;
  }
};

/* -------------------------------------------------------------
   TRACK ORDER
------------------------------------------------------------- */
router.post("/track-order", async (req, res) => {
  console.log("RAW BODY RECEIVED:", req.body);

  try {
    const { orderNumber, order_id, email, visitorId, message } = req.body;

    const orderNo = normalizeIncomingOrderId(orderNumber || order_id);

    if (!email && !orderNo) {
      return res.json({
        success: false,
        botMessage:
          "Please provide either the email used at checkout or the Order ID (e.g., #1003)."
      });
    }

    const order = await ecommerceManager.findOrder({ orderNumber: orderNo, email });
    const summary = ecommerceManager.getOrderSummary(order);

    let ai = { sentiment: "neutral", recommendation: "" };
    try {
      ai = await analyzeSentimentAndIntent(message);
    } catch {}

    try {
      await Event.create({
        visitorId,
        email,
        eventType: "TRACK_ORDER",
        metadata: { orderNumber: orderNo, found: !!order, summary },
        sentiment: ai.sentiment,
        aiNotes: ai.recommendation
      });
    } catch (err) {
      console.error("Event create warn:", err.message);
    }

    if (!order || !summary) {
      return res.json({
        success: false,
        botMessage:
          "I couldn't find any order with those details. Please double-check your email or order number."
      });
    }

    return res.json({
      success: true,
      botMessage: `Here are the details for order ${summary.orderNumber}.`,
      data: summary
    });
  } catch (err) {
    console.error("track-order error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* -------------------------------------------------------------
   RETURN ORDER
------------------------------------------------------------- */
router.post("/return-order", async (req, res) => {
  console.log("RAW BODY RECEIVED:", req.body);

  try {
    const { orderNumber, order_id, email, visitorId, message } = req.body;

    const orderNo = normalizeIncomingOrderId(orderNumber || order_id);

    if (!email && !orderNo) {
      return res.json({
        success: false,
        botMessage:
          "Please provide the email used at checkout or the Order ID so I can check return eligibility."
      });
    }

    const order = await ecommerceManager.findOrder({ orderNumber: orderNo, email });

    let ai = { sentiment: "neutral", recommendation: "" };
    try {
      ai = await analyzeSentimentAndIntent(message);
    } catch {}

    if (!order) {
      try {
        await Event.create({
          visitorId,
          email,
          eventType: "RETURN_ORDER",
          metadata: { orderNumber: orderNo, found: false },
          sentiment: ai.sentiment,
          aiNotes: ai.recommendation
        });
      } catch {}

      return res.json({
        success: false,
        botMessage: "No matching order found. Please re-check the email or order ID."
      });
    }

    const eligibility = ecommerceManager.checkReturnEligibility(order);

    try {
      await Event.create({
        visitorId,
        email,
        eventType: "RETURN_ORDER",
        metadata: { orderNumber: orderNo, found: true, eligibility },
        sentiment: ai.sentiment,
        aiNotes: ai.recommendation
      });
    } catch {}

    if (!eligibility.eligible) {
      return res.json({
        success: false,
        botMessage: `Return not allowed: ${eligibility.reason}`,
        data: eligibility
      });
    }

    const result = ecommerceManager.processReturn(order);

    return res.json({
      success: true,
      botMessage: result.message,
      data: result
    });
  } catch (err) {
    console.error("return-order error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* -------------------------------------------------------------
   CANCEL ORDER
   (New: cancel + refund workflow)
------------------------------------------------------------- */
router.post("/cancel-order", async (req, res) => {
  console.log("RAW BODY RECEIVED:", req.body);

  try {
    const { orderNumber, order_id, email, visitorId, message } = req.body;

    const orderNo = normalizeIncomingOrderId(orderNumber || order_id);

    if (!email && !orderNo) {
      return res.json({
        success: false,
        botMessage:
          "Please provide the email used at checkout or the Order ID so I can check cancellation eligibility."
      });
    }

    const order = await ecommerceManager.findOrder({ orderNumber: orderNo, email });

    let ai = { sentiment: "neutral", recommendation: "" };
    try {
      ai = await analyzeSentimentAndIntent(message);
    } catch {}

    if (!order) {
      try {
        await Event.create({
          visitorId,
          email,
          eventType: "CANCEL_ORDER",
          metadata: { orderNumber: orderNo, found: false },
          sentiment: ai.sentiment,
          aiNotes: ai.recommendation
        });
      } catch {}

      return res.json({
        success: false,
        botMessage: "No order found with these details. Please re-check the email or order ID."
      });
    }

    const eligibility = ecommerceManager.checkCancelEligibility(order);

    try {
      await Event.create({
        visitorId,
        email,
        eventType: "CANCEL_ORDER",
        metadata: { orderNumber: orderNo, found: true, eligibility },
        sentiment: ai.sentiment,
        aiNotes: ai.recommendation
      });
    } catch {}

    if (!eligibility.eligible) {
      return res.json({
        success: false,
        botMessage: `Cancellation not allowed: ${eligibility.reason}`,
        data: eligibility
      });
    }

    const result = await ecommerceManager.cancelAndRefund(order);

    return res.json({
      success: result.success,
      botMessage: result.message,
      data: result
    });
  } catch (err) {
    console.error("cancel-order error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/* -------------------------------------------------------------
   CHECK STOCK
------------------------------------------------------------- */
router.post("/check-stock", async (req, res) => {
  console.log("RAW BODY RECEIVED:", req.body);

  try {
    const { variantId, productId, product_name, visitorId, email, message } = req.body;

    if (!variantId && !productId && !product_name) {
      return res.json({
        success: false,
        botMessage:
          "Please provide a variant ID or product ID. Name-only stock checks are not supported."
      });
    }

    if (!variantId && product_name && !productId) {
      return res.json({
        success: false,
        botMessage:
          "To check stock, I need a variant ID or product ID (e.g., 395534453)."
      });
    }

    const stock = await ecommerceManager.checkStock({ variantId, productId });

    let ai = { sentiment: "neutral", recommendation: "" };
    try {
      ai = await analyzeSentimentAndIntent(message);
    } catch {}

    try {
      await Event.create({
        visitorId,
        email,
        eventType: "STOCK_CHECK",
        metadata: { variantId, productId, product_name, stock },
        sentiment: ai.sentiment,
        aiNotes: ai.recommendation
      });
    } catch {}

    if (!stock) {
      return res.json({
        success: false,
        botMessage: "Unable to fetch stock details at the moment.",
        data: null
      });
    }

    return res.json({
      success: true,
      botMessage: stock.inStock
        ? `Good news! This item is in stock (${stock.quantity} units).`
        : "Currently out of stock.",
      data: stock
    });
  } catch (err) {
    console.error("check-stock error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
