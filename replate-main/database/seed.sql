
-- ============================================================
-- REPLATE DEMONSTRATION AND TEST SEED DATA
-- ============================================================
-- Requires database/schema.sql to be executed first.
-- Preserves existing data.
-- Uses fictional test accounts only.
-- Does not create real login credentials.
-- ============================================================

USE replate;

START TRANSACTION;

-- ============================================================
-- 1. DEMO DONOR ORGANIZATION
-- ============================================================

INSERT INTO organizations (
    organization_name,
    organization_type,
    address
)
SELECT
    'Replate Demo Restaurant',
    'FOODSERVICE',
    '123 Main Street'
WHERE NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE organization_name = 'Replate Demo Restaurant'
      AND organization_type = 'FOODSERVICE'
);

SET @donor_org_id = (
    SELECT MIN(organization_id)
    FROM organizations
    WHERE organization_name = 'Replate Demo Restaurant'
      AND organization_type = 'FOODSERVICE'
);

-- ============================================================
-- 2. DEMO RECIPIENT ORGANIZATIONS
-- ============================================================

INSERT INTO organizations (
    organization_name,
    organization_type,
    address
)
SELECT
    'Replate Demo Food Bank',
    'RECIPIENT',
    '456 Main Street'
WHERE NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE organization_name = 'Replate Demo Food Bank'
      AND organization_type = 'RECIPIENT'
);

INSERT INTO organizations (
    organization_name,
    organization_type,
    address
)
SELECT
    'Replate Demo Shelter',
    'RECIPIENT',
    '789 Main Street'
WHERE NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE organization_name = 'Replate Demo Shelter'
      AND organization_type = 'RECIPIENT'
);

SET @recipient_org_id = (
    SELECT MIN(organization_id)
    FROM organizations
    WHERE organization_name = 'Replate Demo Food Bank'
      AND organization_type = 'RECIPIENT'
);

SET @second_recipient_org_id = (
    SELECT MIN(organization_id)
    FROM organizations
    WHERE organization_name = 'Replate Demo Shelter'
      AND organization_type = 'RECIPIENT'
);

-- ============================================================
-- 3. DEMO USER ACCOUNTS
-- ============================================================
-- Placeholder hashes are not valid for authentication.
-- These accounts are for local claim testing only.

INSERT INTO users (
    organization_id,
    email,
    password_hash,
    role
)
SELECT
    @donor_org_id,
    'donor-demo@replate.example',
    'DEMO_NOT_FOR_LOGIN',
    'FOOD_DONOR'
WHERE NOT EXISTS (
    SELECT 1 FROM users
    WHERE email = 'donor-demo@replate.example'
);

INSERT INTO users (
    organization_id,
    email,
    password_hash,
    role
)
SELECT
    @recipient_org_id,
    'recipient-demo@replate.example',
    'DEMO_NOT_FOR_LOGIN',
    'RECIPIENT'
WHERE NOT EXISTS (
    SELECT 1 FROM users
    WHERE email = 'recipient-demo@replate.example'
);

INSERT INTO users (
    organization_id,
    email,
    password_hash,
    role
)
SELECT
    @second_recipient_org_id,
    'recipient-two@replate.example',
    'DEMO_NOT_FOR_LOGIN',
    'RECIPIENT'
WHERE NOT EXISTS (
    SELECT 1 FROM users
    WHERE email = 'recipient-two@replate.example'
);

SET @recipient_user_id = (
    SELECT user_id FROM users
    WHERE email = 'recipient-demo@replate.example'
    LIMIT 1
);

SET @second_recipient_user_id = (
    SELECT user_id FROM users
    WHERE email = 'recipient-two@replate.example'
    LIMIT 1
);

-- ============================================================
-- 4. AVAILABLE TEST DONATION
-- ============================================================
-- Future dates are generated automatically.
-- This listing is intended for successful claim testing.

INSERT INTO donations (
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
SELECT
    @donor_org_id,
    NULL,
    'Replate Test Available Meals',
    12,
    'servings',
    '123 Main Street',
    DATE_ADD(CURDATE(), INTERVAL 2 DAY),
    '12:00:00',
    DATE_ADD(NOW(), INTERVAL 1 DAY),
    'Reusable test donation for claim testing',
    'AVAILABLE'
WHERE NOT EXISTS (
    SELECT 1
    FROM donations
    WHERE food_type = 'Replate Test Available Meals'
      AND additional_information =
          'Reusable test donation for claim testing'
      AND status = 'AVAILABLE'
      AND claim_deadline > NOW()
);

-- ============================================================
-- 5. ALREADY-CLAIMED TEST DONATION
-- ============================================================
-- Used to test duplicate claim rejection.

INSERT INTO donations (
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
SELECT
    @donor_org_id,
    @recipient_user_id,
    'Replate Test Claimed Meals',
    8,
    'servings',
    '123 Main Street',
    DATE_ADD(CURDATE(), INTERVAL 2 DAY),
    '13:00:00',
    DATE_ADD(NOW(), INTERVAL 1 DAY),
    'Reusable test donation for duplicate claim testing',
    'CLAIMED'
WHERE NOT EXISTS (
    SELECT 1 FROM donations
    WHERE food_type = 'Replate Test Claimed Meals'
      AND additional_information =
          'Reusable test donation for duplicate claim testing'
);

-- ============================================================
-- 6. CREATE MATCHING CLAIM RECORD
-- ============================================================

SET @claimed_donation_id = (
    SELECT MIN(donation_id)
    FROM donations
    WHERE food_type = 'Replate Test Claimed Meals'
      AND additional_information =
          'Reusable test donation for duplicate claim testing'
);

INSERT INTO claims (
    donation_id,
    recipient_id,
    claim_status
)
SELECT
    @claimed_donation_id,
    @recipient_user_id,
    'CLAIMED'
WHERE @claimed_donation_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM claims
    WHERE donation_id = @claimed_donation_id
);

COMMIT;

-- ============================================================
-- 7. VERIFY DEMO USERS
-- ============================================================

SELECT
    u.user_id,
    u.email,
    u.role,
    o.organization_name,
    o.organization_type
FROM users u
JOIN organizations o
    ON u.organization_id = o.organization_id
WHERE u.email IN (
    'donor-demo@replate.example',
    'recipient-demo@replate.example',
    'recipient-two@replate.example'
);

-- ============================================================
-- 8. VERIFY TEST DONATIONS
-- ============================================================

SELECT
    donation_id,
    food_type,
    quantity,
    status,
    recipient_user_id,
    claim_deadline
FROM donations
WHERE food_type IN (
    'Replate Test Available Meals',
    'Replate Test Claimed Meals'
)
ORDER BY donation_id;

-- ============================================================
-- 9. VERIFY CLAIM RECORDS
-- ============================================================

SELECT
    c.claim_id,
    c.donation_id,
    c.recipient_id,
    c.claim_status,
    d.status AS donation_status
FROM claims c
JOIN donations d
    ON c.donation_id = d.donation_id
WHERE d.food_type = 'Replate Test Claimed Meals';

-- ============================================================
-- 10. DISPLAY DEMO RECIPIENT IDS
-- ============================================================

SELECT
    @recipient_user_id AS primary_recipient_user_id,
    @second_recipient_user_id AS second_recipient_user_id;

-- ============================================================
-- END OF REPLATE SEED DATA
-- ============================================================
