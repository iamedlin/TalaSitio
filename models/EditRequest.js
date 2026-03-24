const mongoose = require("mongoose");

const editRequestSchema = new mongoose.Schema({
    residentId: String,
    newData: Object,
    status: { type: String, default: "pending" },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("EditRequest", editRequestSchema);