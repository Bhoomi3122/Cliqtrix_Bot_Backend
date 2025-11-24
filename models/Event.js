// models/Event.js
import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    visitorId: String,       // Zoho SalesIQ visitor id (if any)
    email: String,
    eventType: String,       // TRACK_ORDER / RETURN_ORDER / STOCK_CHECK etc.
    metadata: Object,        // anything about the event (order summary, stock, etc.)
    sentiment: String,       // positive / neutral / negative
    aiNotes: String          // recommendation from AI layer
  },
  { timestamps: true }
);

export const Event = mongoose.model("Event", eventSchema);
