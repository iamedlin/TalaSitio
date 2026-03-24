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

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

const Resident = require("./models/Resident");
const { protect } = require("./middleware/authMiddleware");

app.get("/residents/sitio/:number", async (req, res) => {
    const sitio = req.params.number;

    try {
        const residents = await Resident.find({
    sitio: String(req.params.number) // ✅ siguradong match
});
        res.json(residents);
    } catch (err) {
        res.status(500).json({ message: "Error fetching residents" });
    }
});

const bcrypt = require("bcryptjs");
const User = require("./models/User");

app.post("/residents", async (req, res) => {
    try {
        console.log("POST HIT");
        console.log("BODY:", req.body);

        const { head, familyMembers, sitio } = req.body;

        if (!head.email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // 1. SAVE RESIDENT
        const newResident = new Resident({
            head,
            familyMembers: familyMembers || [],
            sitio: String(sitio) // ✅ FIXED
        });

        await newResident.save();

        // 2. CREATE USER ACCOUNT
        const email = head.email;
        const rawPassword = head.birthdate.replace(/-/g, ""); // ✅ improved
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        // ✅ DEBUG HERE
console.log("HEAD:", head);
console.log("NAME:", head.name);

const name = head.name;

if (!name) {
    console.log("❌ NAME IS UNDEFINED!");
    return res.status(400).json({ message: "Name is missing" });
}

try {
    await User.create({
        name,       // ✅ Use the variable we already defined
        email,
        password: hashedPassword
    });
    console.log("USER CREATED");
} catch (err) {
    if (err.code === 11000) {
        console.log("User already exists");
    } else {
        throw err;
    }
}

        res.json({ message: "Saved successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving resident" });
    }
});
app.delete("/residents/:id", async (req, res) => {
    try {
        const id = req.params.id;

        // 1️⃣ Find the resident first
        const resident = await Resident.findById(id);

        if (!resident) {
            return res.status(404).json({ message: "Resident not found" });
        }

        // 2️⃣ Delete the resident
        await Resident.findByIdAndDelete(id);
        console.log("RESIDENT DELETED:", resident);

        // 3️⃣ Delete the user account linked to email
        const email = resident.head.email;

        if (email) {
            const deletedUser = await User.findOneAndDelete({ email });
            if (deletedUser) {
                console.log("USER DELETED:", deletedUser.email);
            } else {
                console.log("No user found for this email");
            }
        }

        res.json({ message: "Resident and linked user deleted successfully" });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});
app.put("/residents/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const updatedResident = await Resident.findByIdAndUpdate(
            id,
            req.body,
            { new: true } // returns updated data
        );

        res.json(updatedResident);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});