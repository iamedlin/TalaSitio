const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const EditRequest = require("./models/EditRequest");

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
const bcrypt = require("bcrypt"); 
const jwt = require("jsonwebtoken");

app.put("/update-me", auth, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const updateData = { name, email };

    if(password){
      const hashed = await bcrypt.hash(password, 10);
      updateData.password = hashed;
    }

    await User.findByIdAndUpdate(req.user.id, updateData);

    res.json({ message: "Profile updated successfully!" });

  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});
app.post("/api/auth/change-password", auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Check current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        // Hash new password
        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;

        await user.save();

        res.json({ message: "Password updated successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});
// CREATE USER (ADMIN ONLY)
app.post("/create-user", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    res.json({ message: "User created successfully!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating user" });
  }
});

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
        const { residentId, requestedBy, changes } = req.body;

        if (!changes || Object.keys(changes).length === 0) {
            return res.json({ message: "No changes detected" });
        }

        const request = new EditRequest({
            residentId,
            requestedBy,
            changes
        });

        await request.save();

        res.json({ message: "Request sent for approval" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});
app.get("/edit-requests", async (req, res) => {
    const requests = await EditRequest.find();
    res.json(requests);
});
// Reject request
app.put("/edit-request/reject/:id", async (req, res) => {
    try {
        await EditRequest.findByIdAndUpdate(req.params.id, {
            status: "rejected"
        });

        res.json({ message: "Request rejected" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.put("/edit-request/approve/:id", async (req, res) => {
    const request = await EditRequest.findById(req.params.id);

    const updates = {};

    for (let key in request.changes) {
        if(key === "familyMembers"){
            updates["familyMembers"] = request.changes[key].new;
        } else {
            updates[key] = request.changes[key].new;
        }
    }

    await Resident.findByIdAndUpdate(request.residentId, {
        $set: updates
    });

    request.status = "approved";
    await request.save();

    res.json({ message: "Approved & updated" });
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
// UPDATE RESIDENT
app.put("/residents/:id", async (req, res) => {
    const { head, familyMembers } = req.body;
    const resident = await Resident.findById(req.params.id);
    if (!resident) return res.status(404).send("Resident not found");

    // Construct fullName for validation
    const fullName = [head.firstName, head.middleName, head.lastName]
        .filter(n => n && n.trim() !== "")
        .join(" ");

    // Update head info
    resident.head = {
        firstName: head.firstName,
        middleName: head.middleName,
        lastName: head.lastName,
        birthdate: head.birthdate,
        age: head.age,
        gender: head.gender,
        civilStatus: head.civilStatus,
        nationality: head.nationality,
        contact: head.contact,
        email: head.email,
        occupation: head.occupation,
        socialClass: head.socialClass,
        religion: head.religion,
        name: fullName || "No Name Provided" // ✅ ensures required field
    };

    // Update family members
    resident.familyMembers = familyMembers || [];

    await resident.save();
    res.json(resident);
});
/* =========================
   DELETE RESIDENT
========================= */
app.delete("/residents/:id", async (req, res) => {
    try {
        const deleted = await Resident.findByIdAndDelete(req.params.id);

        if (!deleted) {
            return res.status(404).json({ message: "Resident not found" });
        }

        // Optional: delete the associated user too
        await User.findOneAndDelete({ email: deleted.head.email });

        res.json({ message: "Resident deleted successfully" });
    } catch (err) {
        console.error("DELETE RESIDENT ERROR:", err);
        res.status(500).json({ message: "Error deleting resident" });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});