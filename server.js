const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const EditRequest = require("./models/EditRequest");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const Resident = require("./models/Resident");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Login route
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if(!user) return res.status(400).json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if(!match) return res.status(400).json({ message: "Incorrect password" });

    // Include role in token
    const token = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );

    // Send role in response
    res.json({ token, role: user.role });
});

// Auth middleware
function auth(req, res, next) {
    const authHeader = req.headers.authorization;
    if(!authHeader) return res.status(401).json({ message: "No token" });

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
}

// Current user route
app.get("/api/auth/me", auth, async (req, res) => {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
});

app.post("/edit-request", async (req, res) => {
    try {
        const { residentId, newData } = req.body;

        const request = new EditRequest({
            residentId,
            newData
        });

        await request.save();

        res.json({ message: "Request sent for approval" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/edit-requests", async (req, res) => {
    const requests = await EditRequest.find();
    res.json(requests);
});

app.put("/edit-request/approve/:id", async (req, res) => {
    try {
        const request = await EditRequest.findById(req.params.id);

        if (!request) return res.status(404).json({ message: "Not found" });

        // Apply changes
        await Resident.findByIdAndUpdate(
            request.residentId,
            request.newData
        );

        request.status = "approved";
        await request.save();

        res.json({ message: "Approved & updated" });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* =========================
   GET ALL BY SITIO (FIXED)
========================= */
app.get("/residents/sitio/:number", async (req, res) => {
    try {
        const sitioNumber = Number(req.params.number);

        const residents = await Resident.find({
            sitio: sitioNumber
        });

        console.log("FETCH SITIO:", sitioNumber);
        console.log("RESULT:", residents.length);

        res.json(residents);
    } catch (err) {
        res.status(500).json({ message: "Error fetching residents" });
    }
});

/* =========================
   GET BY ID (IMPORTANT)
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
   CREATE RESIDENT (FIXED)
========================= */
app.post("/residents", async (req, res) => {
    try {
        const { head, familyMembers, sitio } = req.body;

        const newResident = new Resident({
            head,
            familyMembers: familyMembers || [],
            sitio: Number(sitio) // 🔥 FIXED (number)
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
        console.error(err);
        res.status(500).json({ message: "Error saving resident" });
    }
});

/* =========================
   UPDATE RESIDENT
========================= */
app.put("/residents/:id", async (req, res) => {
    try {
        const updated = await Resident.findByIdAndUpdate(
            req.params.id,  // use id from URL
            { $set: req.body },  // update with body
            { new: true } // return updated document
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

app.get("/residents/by-email/:email", async (req, res) => {
    try {
        const resident = await Resident.findOne({
            "head.email": req.params.email
        });

        if (!resident) {
            return res.status(404).json({ message: "Resident not found" });
        }

        res.json(resident);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});