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
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

app.use(cors({
    origin: "http://localhost:5000", // just the protocol + host + port
    credentials: true
}));
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
        const request = await EditRequest.findByIdAndUpdate(req.params.id, {
            status: "rejected"
        }, { new: true });

        if(!request) return res.status(404).json({ message: "Request not found" });

        // Get resident email
        const resident = await Resident.findById(request.residentId);
        const email = resident.head.email;

        // Send email
        await transporter.sendMail({
            from: '"TalaSitio Portal" <itsedielynnase@gmail.com>',
            to: email,
            subject: "Edit Request Rejected ❌",
            text: `Hello ${resident.head.name},\n\nYour edit request was rejected by the admin.\n\nPlease contact the admin for details.\n\nThank you,\nTalaSitio Team`
        });

        res.json({ message: "Request rejected & email sent" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});
app.put("/edit-request/approve/:id", async (req, res) => {
    try {
        const request = await EditRequest.findById(req.params.id);
        if(!request) return res.status(404).json({ message: "Request not found" });

        const updates = {};
        for (let key in request.changes) {
            if(key === "familyMembers") {
                updates["familyMembers"] = request.changes[key].new;
            } else {
                updates[key] = request.changes[key].new;
            }
        }

        await Resident.findByIdAndUpdate(request.residentId, { $set: updates });

        request.status = "approved";
        await request.save();

        // Get resident email
        const resident = await Resident.findById(request.residentId);
        const email = resident.head.email;

        // Send email
        await transporter.sendMail({
            from: '"TalaSitio Portal" <itsedielynnase@gmail.com>',
            to: email,
            subject: "Edit Request Approved ✅",
            text: `Hello ${resident.head.name},\n\nYour edit request has been approved and the changes are now reflected in your profile.\n\nThank you,\nTalaSitio Team`
        });

        res.json({ message: "Approved & email sent" });

    } catch (err) {
        console.error(err);
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
/* =========================
   CREATE RESIDENT & SEND EMAIL
========================= */
app.post("/residents", async (req, res) => {
    try {
        const { head, familyMembers, sitio } = req.body;

        // 1️⃣ Save resident
        const newResident = new Resident({
            head,
            familyMembers: familyMembers || [],
            sitio: Number(sitio)
        });

        await newResident.save();

        // 2️⃣ Create user account
        const email = head.email;
        const rawPassword = head.birthdate.replace(/-/g, ""); // simple password
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        const newUser = await User.create({
            name: head.name,
            email,
            password: hashedPassword,
            role: "user"
        });

        // 3️⃣ Send email with credentials
        let transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: "itsedielynnase@gmail.com",
                pass: "ipro yzvv onps zilm" // Make sure this app password is valid
            }
        });

        const mailOptions = {
            from: '"TalaSitio Admin" <itsedielynnase@gmail.com>',
            to: email,
            subject: "Your TalaSitio Account Credentials",
            html: `
                <p>Hello ${head.name},</p>
                <p>Your account has been created for TalaSitio.</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Password:</strong> ${rawPassword}</p>
                <p>Please login and change your password immediately.</p>
                <p>Thank you!</p>
            `
        };

        await transporter.sendMail(mailOptions);

        res.json({ message: "Resident and user created successfully, email sent!" });

    } catch (err) {
        console.error("CREATE RESIDENT ERROR:", err);
        res.status(500).json({ message: "Error saving resident", error: err.message });
    }
});

// GET resident by head email
app.get("/residents/by-email/:email", async (req, res) => {
    try {
        const resident = await Resident.findOne({ "head.email": req.params.email });
        if (!resident) return res.status(404).json({ message: "Resident not found" });
        res.json(resident);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
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


// -------- Send Verification Code --------
app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save code & expiry (10 minutes)
    user.resetCode = verificationCode;
    user.resetCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Configure Nodemailer
    let transporter = nodemailer.createTransport({
        service: "Gmail",
        auth: {
            user: "itsedielynnase@gmail.com",
            pass: "ipro yzvv onps zilm"  // <- make sure this app password is still valid
        }
    });

    const mailOptions = {
        from: '"My App" <itsedielynnase@gmail.com>',
        to: email,
        subject: "Password Reset Verification Code",
        text: `Your password reset code is: ${verificationCode}`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: "Verification code sent to your email" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to send email" });
    }
});

// -------- Verify Code & Reset Password --------
app.post("/reset-password", async (req, res) => {
    const { email, code, newPassword } = req.body;
    console.log("Reset-password request body:", req.body); // 🔥 log input

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "Email not found" });

        if (!user.resetCode || user.resetCode !== code || user.resetCodeExpires < Date.now()) {
            return res.status(400).json({ message: "Invalid or expired code" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetCode = undefined;
        user.resetCodeExpires = undefined;

        await user.save();

        res.json({ message: "Password has been reset successfully!" });
    } catch (err) {
        console.error("Reset-password route error:", err); // 🔥 full error
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// DELETE edit request
app.delete("/edit-request/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const request = await EditRequest.findByIdAndDelete(id);

    if (!request) return res.status(404).json({ message: "Request not found" });

    // Optionally send email to user notifying deletion
    // await sendEmail(request.email, "Your request was deleted", "Message...");

    res.json({ message: "Request deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));