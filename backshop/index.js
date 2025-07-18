const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
require("dotenv").config(); // Load environment variables from .env

const app = express();

app.use(express.json());
app.use(cors());

// ✅ Multer setup for in-memory storage (no local folder)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ MongoDB Atlas connection using MONGODB_URI from .env
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// ✅ User Schema & Model
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  date: { type: Date, default: Date.now }
});
const User = mongoose.model("User", userSchema);

// ✅ File Schema & Model
const fileSchema = new mongoose.Schema({
  originalname: String,
  mimetype: String,
  size: Number,
  buffer: Buffer,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  uploadDate: { type: Date, default: Date.now },
  analyticsFileId: { type: String, default: null }
});
const File = mongoose.model("File", fileSchema);

// ✅ JWT Middleware
const authenticate = (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).json({ error: "Access denied" });

  try {
    const verified = jwt.verify(token, "secret_shopnosis");
    req.user = verified;
    next();
  } catch {
    res.status(400).json({ error: "Invalid token" });
  }
};

// ✅ Root Endpoint
app.get("/", (req, res) => {
  res.send("Welcome to Shopnosis API");
});

// ✅ Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email, and password are required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();

    const token = jwt.sign({ userId: user._id }, "secret_shopnosis", { expiresIn: "15d" });
    res.json({ success: true, token, name: user.name });
  } catch {
    res.status(500).json({ error: "Signup failed" });
  }
});

// ✅ Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, "secret_shopnosis", { expiresIn: "15d" });
    res.json({ success: true, token, name: user.name });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

// ✅ Upload File (stored in MongoDB)
app.post("/filesupload", authenticate, upload.single("file"), async (req, res) => {
  try {
    // Step 1: Save in Mongo
    const newFile = new File({
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer,
      userId: req.user.id
    });

    await newFile.save();

    // Step 2: Upload to FastAPI
    const form = new FormData();
    form.append("file", req.file.buffer, req.file.originalname);

    let analyticsFileId = null;
    try {
      const response = await axios.post("http://localhost:8080/api/v1/upload", form, {
        headers: form.getHeaders()
      });
      analyticsFileId = response.data.file_id;
    } catch (err) {
      console.error("Error uploading to FastAPI:", err.message);
    }

    // Step 3: Save analyticsFileId in Mongo
    newFile.analyticsFileId = analyticsFileId;
    await newFile.save();

    // Step 4: Return response
    res.json({
      success: true,
      fileId: newFile._id,
      analyticsFileId: analyticsFileId
    });

  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).json({ success: false, message: "File upload failed" });
  }
});

// ✅ List user's files
app.get("/myfiles", authenticate, async (req, res) => {
  try {
    const userFiles = await File.find({ userId: req.user.id }).select("-buffer");

    res.json({
      success: true,
      files: userFiles.map(file => ({
        _id: file._id,
        originalname: file.originalname,
        size: file.size,
        uploadDate: file.uploadDate,
        analyticsFileId: file.analyticsFileId
      }))
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get files" });
  }
});

// ✅ Download file
app.get("/download/:id", authenticate, async (req, res) => {
  try {
    const file = await File.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!file) return res.status(404).json({ error: "File not found" });

    res.set("Content-Type", file.mimetype);
    res.set("Content-Disposition", `attachment; filename="${file.originalname}"`);
    res.send(file.buffer);
  } catch {
    res.status(500).json({ error: "Download failed" });
  }
});

// ✅ Delete file
app.delete("/deletefile/:id", authenticate, async (req, res) => {
  try {
    const deleted = await File.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!deleted) return res.status(404).json({ error: "File not found" });

    res.json({ success: true, message: "File deleted" });
  } catch {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// ✅ Change password
app.post("/changepassword", async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ error: "Email and new password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

// ✅ Admin route - Get all users (without passwords)
app.get("/users", authenticate, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json({ success: true, users });
  } catch {
    res.status(500).json({ error: "Failed to get users" });
  }
});

// ✅ Test protected route
app.get("/protected", authenticate, (req, res) => {
  res.json({ message: "Access granted", userId: req.user.userId });
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Shopnosis backend running on port ${PORT}`);
});
