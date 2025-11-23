const axios = require("axios");
require("dotenv").config();

const shopify = axios.create({
  baseURL: `https://${process.env.SHOPIFY_STORE_URL}/admin/api/2024-07`,
  headers: {
    "X-Shopify-Access-Token": process.env.SHOPIFY_API_PASSWORD,
    "Content-Type": "application/json"
  }
});

module.exports = {
  getOrdersByEmail: async (email) => {
    const response = await shopify.get(`/orders.json?email=${email}`);
    return response.data.orders;
  },

  getOrderById: async (orderId) => {
    const response = await shopify.get(`/orders/${orderId}.json`);
    return response.data.order;
  }
};
