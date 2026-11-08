const pool = require("../config/db");

// =====================================================
// FIND AVAILABLE DONATIONS
// =====================================================

async function findAvailable() {
  const [rows] = await pool.query(`
    SELECT
      d.donation_id,
      d.organization_id,
      d.food_type,
      d.quantity,
      d.quantity_unit,
      d.pickup_address,
      d.pickup_date,
      d.pickup_time,
      d.claim_deadline,
      d.additional_information,
      d.status,
      o.organization_name
    FROM donations d
    INNER JOIN organizations o
      ON o.organization_id = d.organization_id
    WHERE d.status = 'AVAILABLE'
      AND d.claim_deadline > NOW()
    ORDER BY d.created_at DESC, d.donation_id DESC
  `);

  return rows;
}

// =====================================================
// FIND DEMO DONOR ORGANIZATION
// =====================================================

async function findDemoDonor(connection) {
  const [rows] = await connection.execute(`
    SELECT organization_id
    FROM organizations
    WHERE organization_name = 'Replate Demo Restaurant'
      AND organization_type = 'FOODSERVICE'
    ORDER BY organization_id
    LIMIT 1
  `);

  return rows.length ? rows[0].organization_id : null;
}

// =====================================================
// INSERT DONATION
// =====================================================

async function insertDonation(data) {
  const connection = await pool.getConnection();

  try {
    const organizationId = await findDemoDonor(connection);

    if (!organizationId) {
      return {
        status: "MISSING_DONOR"
      };
    }

    const [result] = await connection.execute(
      `INSERT INTO donations (
        organization_id,
        recipient_user_id,
        food_type,
        quantity,
        quantity_unit,
        pickup_address,
        pickup_date,
        pickup_time,
        claim_deadline,
        additional_information,
        status
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')`,
      [
        organizationId,
        data.food_type,
        data.quantity,
        data.quantity_unit,
        data.pickup_address,
        data.pickup_date,
        data.pickup_time,
        data.claim_deadline,
        data.additional_information || null
      ]
    );

    return {
      status: "SUCCESS",
      donation_id: result.insertId
    };

  } finally {
    connection.release();
  }
}

// =====================================================
// CLAIM DONATION
// =====================================================

async function claimDonation(donationId, recipientUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Confirm the recipient account exists.
    const [recipients] = await connection.execute(
      `SELECT u.user_id
       FROM users u
       INNER JOIN organizations o
         ON o.organization_id = u.organization_id
       WHERE u.user_id = ?
         AND u.role = 'RECIPIENT'
         AND o.organization_type = 'RECIPIENT'`,
      [recipientUserId]
    );

    if (recipients.length === 0) {
      await connection.rollback();

      return {
        status: "INVALID_RECIPIENT"
      };
    }

    // Atomically update only an available, unexpired donation.
    const [updateResult] = await connection.execute(
      `UPDATE donations
       SET status = 'CLAIMED',
           recipient_user_id = ?
       WHERE donation_id = ?
         AND status = 'AVAILABLE'
         AND claim_deadline > NOW()`,
      [recipientUserId, donationId]
    );

    if (updateResult.affectedRows !== 1) {
      await connection.rollback();

      return {
        status: "UNAVAILABLE"
      };
    }

    // Record the claim in the same transaction.
    await connection.execute(
      `INSERT INTO claims (
        donation_id,
        recipient_id,
        claim_status
      )
      VALUES (?, ?, 'CLAIMED')`,
      [donationId, recipientUserId]
    );

    await connection.commit();

    return {
      status: "SUCCESS",
      donation_id: donationId,
      recipient_user_id: recipientUserId
    };

  } catch (error) {
    await connection.rollback();
    throw error;

  } finally {
    connection.release();
  }
}

// =====================================================
// UPDATE AVAILABLE DONATION
// =====================================================

async function updateDonation(donationId, updates) {
  const allowedFields = [
    "food_type",
    "quantity",
    "quantity_unit",
    "pickup_address",
    "pickup_date",
    "pickup_time",
    "claim_deadline",
    "additional_information"
  ];

  const fields = allowedFields.filter(field =>
    Object.prototype.hasOwnProperty.call(updates, field)
  );

  if (fields.length === 0) {
    return 0;
  }

  const connection = await pool.getConnection();

  try {
    // Restrict demo edits to the seeded donor organization.
    const organizationId = await findDemoDonor(connection);

    if (!organizationId) {
      return 0;
    }

    const setClause = fields
      .map(field => `${field} = ?`)
      .join(", ");

    const values = fields.map(field => updates[field]);

    const [result] = await connection.execute(
      `UPDATE donations
       SET ${setClause}
       WHERE donation_id = ?
         AND organization_id = ?
         AND status = 'AVAILABLE'
         AND claim_deadline > NOW()`,
      [...values, donationId, organizationId]
    );

    return result.affectedRows;

  } finally {
    connection.release();
  }
}

module.exports = {
  findAvailable,
  insertDonation,
  claimDonation,
  updateDonation
};
