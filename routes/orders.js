const express = require("express");
const router = express.Router();
const shopify = require("../adapters/shopify");

// GET orders by customer email
router.get("/by-email/:email", async (req, res) => {
  try {
    const orders = await shopify.getOrdersByEmail(req.params.email);
    res.json({ orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET single order by ID
router.get("/:id", async (req, res) => {
  try {
    const order = await shopify.getOrderById(req.params.id);
    res.json({ order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
