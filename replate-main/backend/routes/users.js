
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/db");

const router = express.Router();

// POST /api/users/register
router.post("/register", async (req, res) => {
  const {
    organization_name,
    organization_type,
    address,
    email,
    password
  } = req.body || {};

  // Validate required fields
  if (
    typeof organization_name !== "string" ||
    !organization_name.trim() ||
    typeof address !== "string" ||
    !address.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      error: "All fields are required."
    });
  }

  // Validate organization type
  if (
    organization_type !== "FOODSERVICE" &&
    organization_type !== "RECIPIENT"
  ) {
    return res.status(400).json({
      error:
        "Organization type must be either FOODSERVICE or RECIPIENT."
    });
  }

  // Basic email validation
  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      error: "Please enter a valid email address."
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must contain at least 8 characters."
    });
  }

  let connection;

  try {
    connection = await pool.getConnection();

    await connection.beginTransaction();

    // Check for duplicate email
    const [existingUsers] = await connection.execute(
      "SELECT user_id FROM users WHERE email = ?",
      [normalizedEmail]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();

      return res.status(400).json({
        error: "Email is already in use."
      });
    }

    // Hash password before storage
    const passwordHash = await bcrypt.hash(password, 10);

    // Create organization
    const [organizationResult] = await connection.execute(
      `INSERT INTO organizations
        (organization_name, organization_type, address)
       VALUES (?, ?, ?)`,
      [
        organization_name.trim(),
        organization_type,
        address.trim()
      ]
    );

    const organizationId = organizationResult.insertId;

    // Determine role
    const role =
      organization_type === "FOODSERVICE"
        ? "FOOD_DONOR"
        : "RECIPIENT";

    // Create user
    const [userResult] = await connection.execute(
      `INSERT INTO users
        (organization_id, email, password_hash, role)
       VALUES (?, ?, ?, ?)`,
      [
        organizationId,
        normalizedEmail,
        passwordHash,
        role
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: "User registered successfully.",
      user_id: userResult.insertId,
      organization_id: organizationId,
      role
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    // Handle duplicate email race conditions
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        error: "Email is already in use."
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      error: "Unable to register user."
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
