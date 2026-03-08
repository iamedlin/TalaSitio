const express = require("express");
const router = express.Router();

const User = require("../models/User");
const AccountRequest = require("../models/AccountRequest");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* =========================
REGISTER USER (ADMIN USE)
========================= */

router.post("/register", async (req, res) => {

const { name, email, password, role } = req.body;

try {

const userExists = await User.findOne({ email });

if (userExists) {
return res.status(400).json({ message: "User already exists" });
}

const hashedPassword = await bcrypt.hash(password, 10);

const user = await User.create({
name,
email,
password: hashedPassword,
role
});

res.status(201).json({ message: "User registered successfully" });

} catch (error) {

res.status(500).json({ message: error.message });

}

});

/* =========================
LOGIN
========================= */

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {

    console.log("LOGIN ATTEMPT:", email);

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role
    });

  } catch (error) {

    console.error("LOGIN ERROR:", error); // 🔴 ADD THIS

    res.status(500).json({ message: "Server error" });

  }

});

/* =========================
REQUEST ACCOUNT (PUBLIC)
========================= */

router.post("/request-account", async (req, res) => {

    // log the incoming data for debugging
    console.log("REQUEST RECEIVED:", req.body);

    try {
        const { name, age, phone, email, password } = req.body;

        const request = new AccountRequest({
            name,
            age,
            phone,
            email,
            password
        });

        await request.save();

        res.json({ message: "Request submitted" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
});

/* =========================
GET ACCOUNT REQUESTS
(Admin Notification)
========================= */

router.get("/account-requests", async (req, res) => {

try {

const requests = await AccountRequest.find({
status: "pending"
});

res.json(requests);

} catch (error) {

res.status(500).json({ message: error.message });

}

});

/* =========================
APPROVE ACCOUNT REQUEST
(Admin approves user)
========================= */

router.post("/approve-request/:id", async (req, res) => {

try {

const request = await AccountRequest.findById(req.params.id);

if (!request) {
return res.status(404).json({ message: "Request not found" });
}

const hashedPassword = await bcrypt.hash(request.password, 10);

await User.create({
name: request.name,
email: request.email,
password: hashedPassword,
role: "user"
});

request.status = "approved";
await request.save();

res.json({ message: "User account created successfully" });

} catch (error) {

res.status(500).json({ message: error.message });

}

});

module.exports = router;