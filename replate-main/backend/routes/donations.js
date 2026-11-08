
const express = require("express");
const repo = require("../repositories/donationRepository");

const router = express.Router();

// =====================================================
// VALIDATION HELPERS
// =====================================================

const requiredFields = [
  "food_type",
  "quantity",
  "quantity_unit",
  "pickup_address",
  "pickup_date",
  "pickup_time",
  "claim_deadline"
];

const editableFields = [
  ...requiredFields,
  "additional_information"
];

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

function nonblank(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validTime(value) {
  if (
    typeof value !== "string" ||
    !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)
  ) {
    return false;
  }

  const [hour, minute, second = 0] = value
    .split(":")
    .map(Number);

  return (
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59 &&
    second >= 0 &&
    second <= 59
  );
}

function parseLocalDateTime(value) {
  if (typeof value !== "string") return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText = "00"
  ] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);

  const datePart =
    `${yearText}-${monthText}-${dayText}`;

  const timePart =
    `${hourText}:${minuteText}:${secondText}`;

  if (
    !validDate(datePart) ||
    !validTime(timePart)
  ) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second
  );

  return {
    date,
    mysql: `${datePart} ${timePart}`
  };
}

function validateDonation(data, partial = false) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return "Invalid donation information.";
  }

  if (!partial) {
    for (const field of requiredFields) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ""
      ) {
        return "Please complete all required donation fields.";
      }
    }
  }

  for (const field of [
    "food_type",
    "quantity_unit",
    "pickup_address"
  ]) {
    if (
      Object.prototype.hasOwnProperty.call(data, field) &&
      !nonblank(data[field])
    ) {
      return `${field} cannot be empty.`;
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "quantity")
  ) {
    if (
      data.quantity === "" ||
      data.quantity === null ||
      !Number.isFinite(Number(data.quantity)) ||
      Number(data.quantity) <= 0
    ) {
      return "Quantity must be a positive number.";
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "pickup_date") &&
    !validDate(data.pickup_date)
  ) {
    return "Pickup date is invalid.";
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "pickup_time") &&
    !validTime(data.pickup_time)
  ) {
    return "Pickup time is invalid.";
  }

  if (
    Object.prototype.hasOwnProperty.call(data, "claim_deadline")
  ) {
    const deadline = parseLocalDateTime(
      data.claim_deadline
    );

    if (
      !deadline ||
      deadline.date.getTime() <= Date.now()
    ) {
      return "Claim deadline must be in the future.";
    }
  }

  return null;
}

function normalizeDonation(data) {
  const normalized = { ...data };

  for (const field of [
    "food_type",
    "quantity_unit",
    "pickup_address"
  ]) {
    if (field in normalized) {
      normalized[field] = normalized[field].trim();
    }
  }

  if ("quantity" in normalized) {
    normalized.quantity = Number(normalized.quantity);
  }

  if ("claim_deadline" in normalized) {
    normalized.claim_deadline =
      parseLocalDateTime(
        normalized.claim_deadline
      ).mysql;
  }

  return normalized;
}

function validatePickupSchedule(data) {
  const pickup = parseLocalDateTime(
    `${data.pickup_date}T${data.pickup_time}`
  );

  if (!pickup) {
    return "Pickup date or time is invalid.";
  }

  if (pickup.date.getTime() <= Date.now()) {
    return "Pickup date and time must be in the future.";
  }

  const deadline = parseLocalDateTime(
    data.claim_deadline
  );

  if (
    deadline &&
    deadline.date.getTime() >= pickup.date.getTime()
  ) {
    return "Claim deadline must be before pickup time.";
  }

  return null;
}

// =====================================================
// GET AVAILABLE DONATIONS
// GET /api/donations
// =====================================================

router.get("/", async (req, res) => {
  try {
    const donations = await repo.findAvailable();

    return res.status(200).json(donations);

  } catch (error) {
    console.error("Retrieve donations error:", error);

    return res.status(500).json({
      error: "Unable to retrieve donations."
    });
  }
});

// =====================================================
// POST DONATION
// POST /api/donations
// =====================================================

router.post("/", async (req, res) => {
  try {
    const data = req.body || {};

    const validationError = validateDonation(data);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const scheduleError = validatePickupSchedule(data);

    if (scheduleError) {
      return res.status(400).json({
        error: scheduleError
      });
    }

    const normalized = normalizeDonation(data);

    const result = await repo.insertDonation(normalized);

    if (result.status === "MISSING_DONOR") {
      return res.status(409).json({
        error:
          "Demo donor missing. Run database/seed.sql."
      });
    }

    return res.status(201).json({
      message: "Donation posted successfully.",
      donation_id: result.donation_id
    });

  } catch (error) {
    console.error("Post donation error:", error);

    return res.status(500).json({
      error: "Unable to save donation."
    });
  }
});

// =====================================================
// CLAIM DONATION
// POST /api/donations/:id/claim
// =====================================================

router.post("/:id/claim", async (req, res) => {
  const donationId = Number(req.params.id);

  const recipientId = Number(
    req.body?.recipient_user_id
  );

  if (!validId(donationId)) {
    return res.status(400).json({
      error: "Invalid donation ID."
    });
  }

  if (!validId(recipientId)) {
    return res.status(400).json({
      error: "A valid recipient user ID is required."
    });
  }

  try {
    const result = await repo.claimDonation(
      donationId,
      recipientId
    );

    if (result.status === "INVALID_RECIPIENT") {
      return res.status(400).json({
        error: "Recipient account not found."
      });
    }

    if (result.status === "UNAVAILABLE") {
      return res.status(409).json({
        error:
          "This donation is already claimed or expired."
      });
    }

    return res.status(200).json({
      message: "Donation claimed successfully.",
      donation_id: donationId,
      recipient_user_id: recipientId
    });

  } catch (error) {
    console.error("Claim donation error:", error);

    return res.status(500).json({
      error: "Unable to claim donation."
    });
  }
});

// =====================================================
// EDIT DONATION
// PUT /api/donations/:id
// =====================================================

router.put("/:id", async (req, res) => {
  const donationId = Number(req.params.id);

  if (!validId(donationId)) {
    return res.status(400).json({
      error: "Invalid donation ID."
    });
  }

  const input = req.body || {};
  const updates = {};

  for (const field of editableFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        input,
        field
      )
    ) {
      updates[field] = input[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: "No valid fields provided."
    });
  }

  const validationError = validateDonation(
    updates,
    true
  );

  if (validationError) {
    return res.status(400).json({
      error: validationError
    });
  }

  // The React edit form submits the full pickup schedule.
  // Reject partial schedule updates until a read-by-ID
  // operation is available to validate merged values.
  const scheduleFields = [
    "pickup_date",
    "pickup_time",
    "claim_deadline"
  ];

  const providedScheduleFields =
    scheduleFields.filter(field => field in updates);

  if (
    providedScheduleFields.length > 0 &&
    providedScheduleFields.length !== 3
  ) {
    return res.status(400).json({
      error:
        "Provide pickup date, pickup time, and claim deadline together."
    });
  }

  if (providedScheduleFields.length === 3) {
    const scheduleError =
      validatePickupSchedule(updates);

    if (scheduleError) {
      return res.status(400).json({
        error: scheduleError
      });
    }
  }

  try {
    const normalized = normalizeDonation(updates);

    const updatedCount = await repo.updateDonation(
      donationId,
      normalized
    );

    if (!updatedCount) {
      return res.status(404).json({
        error:
          "Donation not found, expired, claimed, or outside the demo donor organization."
      });
    }

    return res.status(200).json({
      message: "Donation updated successfully.",
      donation_id: donationId
    });

  } catch (error) {
    console.error("Edit donation error:", error);

    return res.status(500).json({
      error: "Unable to update donation."
    });
  }
});

module.exports = router;
