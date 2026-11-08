
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const donationRoutes = require("./routes/donations");
const userRoutes = require("./routes/users");

const app = express();

app.use(cors());
app.use(express.json());

// Registration routes
app.use("/api/users", userRoutes);

// Donation routes — mount exactly once
app.use("/api/donations", donationRoutes);

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Replate backend is running."
  });
});

// Unknown API endpoints
app.use("/api", (req, res) => {
  res.status(404).json({
    error: "API endpoint not found."
  });
});

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, () => {
  console.log(
    `Replate backend running on http://localhost:${PORT}`
  );
});
