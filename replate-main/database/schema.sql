
-- ============================================================
-- REPLATE DATABASE SCHEMA
-- Assignment 8 - Integration and Testing
-- ============================================================
-- Creates the Replate database and required tables.
-- Preserves existing donation records.
-- Safe to rerun for the supported schema migrations.
-- ============================================================

CREATE DATABASE IF NOT EXISTS replate;

USE replate;

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS organizations (
    organization_id INT AUTO_INCREMENT PRIMARY KEY,
    organization_name VARCHAR(150) NOT NULL,
    organization_type ENUM(
        'FOODSERVICE',
        'RECIPIENT'
    ) NOT NULL,
    address VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM(
        'FOOD_DONOR',
        'RECIPIENT',
        'ADMIN'
    ) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_users_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(organization_id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. DONATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS donations (
    donation_id INT AUTO_INCREMENT PRIMARY KEY,
    organization_id INT NOT NULL,
    recipient_user_id INT NULL,

    food_type VARCHAR(100) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    quantity_unit VARCHAR(30) NOT NULL,

    pickup_address VARCHAR(255) NOT NULL,
    pickup_date DATE NOT NULL,
    pickup_time TIME NOT NULL,
    claim_deadline DATETIME NOT NULL,

    additional_information TEXT,

    status ENUM(
        'AVAILABLE',
        'CLAIMED',
        'COMPLETED'
    ) NOT NULL DEFAULT 'AVAILABLE',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    pickup_confirmed_at DATETIME NULL,
    pickup_confirmed_by INT NULL,

    CONSTRAINT fk_donations_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(organization_id),

    CONSTRAINT fk_donations_recipient
        FOREIGN KEY (recipient_user_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_donation_quantity
        CHECK (quantity > 0)
) ENGINE=InnoDB;

-- ============================================================
-- 4. MIGRATE OLDER DONATIONS TABLES
-- ============================================================

-- Add recipient_user_id if missing.

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'donations'
      AND column_name = 'recipient_user_id'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE donations ADD COLUMN recipient_user_id INT NULL',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add pickup_confirmed_at if missing.

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'donations'
      AND column_name = 'pickup_confirmed_at'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE donations ADD COLUMN pickup_confirmed_at DATETIME NULL',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add pickup_confirmed_by if missing.

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'donations'
      AND column_name = 'pickup_confirmed_by'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE donations ADD COLUMN pickup_confirmed_by INT NULL',
    'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- 5. CLAIMS
-- ============================================================

CREATE TABLE IF NOT EXISTS claims (
    claim_id INT AUTO_INCREMENT PRIMARY KEY,

    donation_id INT NOT NULL UNIQUE,
    recipient_id INT NOT NULL,

    claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    claim_status ENUM(
        'CLAIMED',
        'COMPLETED',
        'CANCELLED'
    ) NOT NULL DEFAULT 'CLAIMED',

    CONSTRAINT fk_claims_donation
        FOREIGN KEY (donation_id)
        REFERENCES donations(donation_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_claims_recipient
        FOREIGN KEY (recipient_id)
        REFERENCES users(user_id)
) ENGINE=InnoDB;

-- ============================================================
-- 6. NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    donation_id INT NULL,

    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,

    status ENUM(
        'UNREAD',
        'READ'
    ) NOT NULL DEFAULT 'UNREAD',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_notifications_donation
        FOREIGN KEY (donation_id)
        REFERENCES donations(donation_id)
) ENGINE=InnoDB;

-- ============================================================
-- 7. DATABASE VERIFICATION
-- ============================================================

SHOW TABLES;

DESCRIBE organizations;
DESCRIBE users;
DESCRIBE donations;
DESCRIBE claims;
DESCRIBE notifications;

-- Check donation status and claim records.

SELECT
    donation_id,
    food_type,
    quantity,
    status,
    recipient_user_id
FROM donations
ORDER BY donation_id DESC;

SELECT
    claim_id,
    donation_id,
    recipient_id,
    claim_status
FROM claims
ORDER BY claim_id DESC;

-- ============================================================
-- END OF REPLATE SCHEMA
-- ============================================================
