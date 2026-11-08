# Replate

Replate is a web application that connects foodservice businesses
with food assistance organizations to coordinate surplus food donations.

## Technology

- React
- JavaScript
- Node.js
- Express.js
- MySQL

## Requirements

- Node.js 24.21.0
- npm 11.19.0
- MySQL
- Git
- Modern web browser

## Database Setup

1. Start MySQL.
2. Run `database/schema.sql`.
3. Run `database/seed.sql`.

## Environment Setup

Create a local `.env` file in the backend directory.

Example:

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=replate
PORT=3000

Do not commit the `.env` file.

## Start Backend

cd backend
npm install
node server.js

## Start Frontend

cd frontend
npm install
npm run dev

## Test the Vertical Slice

1. Open the React application.
2. Open Post a Donation.
3. Complete the required fields.
4. Select Post Donation.
5. Verify that the donation appears.
6. Refresh the page.
7. Verify that the donation remains.

## Validation Test

1. Open Post a Donation.
2. Leave a required field blank.
3. Select Post Donation.
4. Verify that an error message appears.
5. Verify that the invalid donation is not saved.