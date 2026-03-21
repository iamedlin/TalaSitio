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

app.post("/residents", async (req, res) => {
    try {
        console.log("POST HIT");
        console.log("BODY:", req.body);

        const newResident = new Resident({
            head: req.body.head,
            familyMembers: req.body.familyMembers || [],
            sitio: Number(req.body.sitio)
        });

        await newResident.save();

        console.log("SAVED:", newResident);

        res.json({ message: "Saved successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error saving resident" });
    }
});
app.delete("/residents/:id", async (req, res) => {
    try {
        const id = req.params.id;

        console.log("DELETE REQUEST ID:", id);

        const deleted = await Resident.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "Resident not found" });
        }

        console.log("DELETED:", deleted);

        res.json({ message: "Resident deleted" });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});