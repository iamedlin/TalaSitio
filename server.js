const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MODELS
const Resident = require("./models/Resident");
const User = require("./models/User");
const EditRequest = require("./models/EditRequest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role || "user" },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({
            token,
            role: user.role || "user"
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// MIDDLEWARE
const { protect } = require("./middleware/authMiddleware");

/* =========================
   EDIT REQUEST (USER)
========================= */
app.post("/api/edit-request", protect, async (req, res) => {
    try {
        const request = new EditRequest({
            userId: req.user.id,
            newData: req.body
        });

        await request.save();

        res.json({ message: "Request sent to admin for approval." });

    } catch (err) {
        res.status(500).json({ message: "Error sending request" });
    }
});

/* =========================
   GET ALL EDIT REQUESTS (ADMIN)
========================= */
app.get("/api/edit-requests", async (req, res) => {
    const requests = await EditRequest.find().populate("userId");
    res.json(requests);
});

/* =========================
   APPROVE REQUEST
========================= */
app.put("/api/edit-request/:id/approve", async (req, res) => {
    try {
        const request = await EditRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: "Not found" });

        const user = await User.findById(request.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // APPLY CHANGES
        user.name = request.newData.name;
        user.email = request.newData.email;

        // NOTIFICATION
        user.notifications.push({
            message: "Your profile update has been approved"
        });

        await user.save();

        request.status = "approved";
        await request.save();

        res.json({ message: "Request approved and user updated" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   REJECT REQUEST
========================= */
app.put("/api/edit-request/:id/reject", async (req, res) => {
    try {
        const request = await EditRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: "Not found" });

        const user = await User.findById(request.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // NOTIFICATION
        user.notifications.push({
            message: "Your profile update was rejected"
        });

        await user.save();

        request.status = "rejected";
        await request.save();

        res.json({ message: "Request rejected" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   GET NOTIFICATIONS
========================= */
app.get("/api/notifications", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json(user.notifications || []);

    } catch (err) {
        res.status(500).json({ message: "Error fetching notifications" });
    }
});

/* =========================
   GET RESIDENTS BY SITIO
========================= */
app.get("/residents/sitio/:number", async (req, res) => {
    try {
        const sitioNumber = Number(req.params.number);

        const residents = await Resident.find({ sitio: sitioNumber });

        res.json(residents);
    } catch (err) {
        res.status(500).json({ message: "Error fetching residents" });
    }
});

/* =========================
   GET RESIDENT BY ID
========================= */
app.get("/residents/:id", async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);

        if (!resident) {
            return res.status(404).json({ message: "Not found" });
        }

        res.json(resident);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   CREATE RESIDENT
========================= */
app.post("/residents", async (req, res) => {
    try {
        const { head, familyMembers, sitio } = req.body;

        const newResident = new Resident({
            head,
            familyMembers: familyMembers || [],
            sitio: Number(sitio)
        });

        await newResident.save();

        const email = head.email;
        const rawPassword = head.birthdate.replace(/-/g, "");
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        await User.create({
            name: head.name,
            email,
            password: hashedPassword
        });

        res.json({ message: "Saved successfully" });

    } catch (err) {
        res.status(500).json({ message: "Error saving resident" });
    }
});

/* =========================
   UPDATE RESIDENT
========================= */
app.put("/residents/:id", async (req, res) => {
    try {
        const updated = await Resident.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   DELETE RESIDENT
========================= */
app.delete("/residents/:id", async (req, res) => {
    try {
        const resident = await Resident.findById(req.params.id);

        if (!resident) {
            return res.status(404).json({ message: "Not found" });
        }

        await Resident.findByIdAndDelete(req.params.id);

        const email = resident.head.email;

        if (email) {
            await User.findOneAndDelete({ email });
        }

        res.json({ message: "Deleted" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});