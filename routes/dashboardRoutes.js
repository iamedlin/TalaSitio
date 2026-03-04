const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");

router.get("/user", protect, (req, res) => {
  res.json({ message: "Welcome User Dashboard" });
});

router.get("/admin", protect, adminOnly, (req, res) => {
  res.json({ message: "Welcome Admin Dashboard" });
});

module.exports = router;