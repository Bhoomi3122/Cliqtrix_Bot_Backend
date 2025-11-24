// routes/ecommerceRoutes.js
import express from "express";
import { Event } from "../models/Event.js";
import { analyzeSentimentAndIntent } from "../services/aiService.js";
import { ecommerceManager } from "../services/ecommerceManager.js";

const router = express.Router();

/**
 * POST /api/track-order
 * Body: { orderNumber?, email?, visitorId?, message? }
 */
router.post("/track-order", async (req, res) => {
  try {
    const {
      orderNumber,
      order_id,   // support alternate field from bot
      email,
      visitorId,
      message
    } = req.body;

    const orderNo = orderNumber || order_id || null;

    const order = await ecommerceManager.findOrder({ orderNumber: orderNo, email });
    const summary = ecommerceManager.getOrderSummary(order);
    const ai = await analyzeSentimentAndIntent(message);

    await Event.create({
      visitorId,
      email,
      eventType: "TRACK_ORDER",
      metadata: { orderNumber: orderNo, email, summary },
      sentiment: ai.sentiment,
      aiNotes: ai.recommendation
    });

    if (!order || !summary) {
      return res.json({
        success: false,
        botMessage: "I couldn't find any order with those details. Please double-check your email or order number."
      });
    }

    return res.json({
      success: true,
      botMessage: `Got it! Here are the details for ${summary.orderNumber}.`,
      data: summary
    });
  } catch (e) {
    console.error("track-order error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/return-order
 * Body: { orderNumber?, email?, visitorId?, message? }
 */
router.post("/return-order", async (req, res) => {
  try {
    const {
      orderNumber,
      order_id,
      email,
      visitorId,
      message
    } = req.body;

    const orderNo = orderNumber || order_id || null;

    const order = await ecommerceManager.findOrder({ orderNumber: orderNo, email });
    const eligibility = ecommerceManager.checkReturnEligibility(order);
    const ai = await analyzeSentimentAndIntent(message);

    await Event.create({
      visitorId,
      email,
      eventType: "RETURN_ORDER",
      metadata: { orderNumber: orderNo, eligibility },
      sentiment: ai.sentiment,
      aiNotes: ai.recommendation
    });

    if (!eligibility.eligible) {
      return res.json({
        success: false,
        botMessage: `Sorry, this order can't be returned: ${eligibility.reason}`,
        data: eligibility
      });
    }

    const result = ecommerceManager.processReturn(order);

    return res.json({
      success: true,
      botMessage: result.message,
      data: result
    });
  } catch (e) {
    console.error("return-order error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/check-stock
 * Body: { variantId?, productId?, visitorId?, email?, message? }
 */
router.post("/check-stock", async (req, res) => {
  try {
    const { variantId, productId, visitorId, email, message } = req.body;

    const stock = await ecommerceManager.checkStock({ variantId, productId });
    const ai = await analyzeSentimentAndIntent(message);

    await Event.create({
      visitorId,
      email,
      eventType: "STOCK_CHECK",
      metadata: { variantId, productId, stock },
      sentiment: ai.sentiment,
      aiNotes: ai.recommendation
    });

    return res.json({
      success: true,
      botMessage: stock.inStock
        ? `Good news! This item is in stock (${stock.quantity} units).`
        : "Currently out of stock. You can try a different variant or check back later.",
      data: stock
    });
  } catch (e) {
    console.error("check-stock error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
