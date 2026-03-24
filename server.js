const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/auth", authRoutes);

const Resident = require("./models/Resident");
const User = require("./models/User");
const bcrypt = require("bcryptjs");

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
    password: hashedPassword,
    role: "user" // ✅ ADD THIS
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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});