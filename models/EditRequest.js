const mongoose = require("mongoose");

const editRequestSchema = new mongoose.Schema({
    residentId: String,
    requestedBy: String, 
    changes: Object,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EditRequest", editRequestSchema);