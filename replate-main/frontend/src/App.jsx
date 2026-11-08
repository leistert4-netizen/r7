
import { useEffect, useState } from "react";
import "./App.css";

// ============================================================
// API CONFIGURATION
// ============================================================

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const DONATIONS_API = `${API_BASE}/api/donations`;
const REGISTER_API = `${API_BASE}/api/users/register`;

// ============================================================
// DEFAULT FORM VALUES
// ============================================================

const emptyDonation = {
  food_type: "",
  quantity: "",
  quantity_unit: "",
  pickup_address: "",
  pickup_date: "",
  pickup_time: "",
  claim_deadline: "",
  additional_information: ""
};

const emptyRegistration = {
  organization_name: "",
  organization_type: "",
  address: "",
  email: "",
  password: ""
};

// ============================================================
// API RESPONSE HELPER
// ============================================================

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      throw new Error(
        `HTTP ${response.status}: Invalid JSON response from the backend.`
      );
    }
  } else {
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: API endpoint unavailable. Check the backend route.`
      );
    }

    throw new Error(
      `HTTP ${response.status}: Expected JSON but received a different response.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${
        data?.error || "The request could not be completed."
      }`
    );
  }

  return data;
}

// ============================================================
// DATE HELPERS
// ============================================================

function formatDate(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return "";
}

function formatTime(value) {
  if (!value) return "";
  return String(value).slice(0, 5);
}

function formatDateTimeLocal(value) {
  if (!value) return "";

  if (typeof value === "string") {
    // MySQL DATETIME or ISO timestamp
    return value.replace(" ", "T").slice(0, 16);
  }

  return "";
}

// ============================================================
// REPLATE APPLICATION
// ============================================================

function App() {
  // Donation posting
  const [form, setForm] = useState({
    ...emptyDonation
  });

  // Registration
  const [registration, setRegistration] = useState({
    ...emptyRegistration
  });

  const [registering, setRegistering] = useState(false);

  // Donation listing and claiming
  const [donations, setDonations] = useState([]);
  const [recipientUserId, setRecipientUserId] =
    useState("");

  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState(null);
  const [loadingDonations, setLoadingDonations] =
    useState(true);

  // Donation editing
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    ...emptyDonation
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Messages
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function clearMessages() {
    setMessage("");
    setError("");
  }

  // ==========================================================
  // LOAD AVAILABLE DONATIONS
  // ==========================================================

  async function loadDonations() {
    setLoadingDonations(true);

    try {
      const response = await fetch(DONATIONS_API);
      const data = await readResponse(response);

      if (!Array.isArray(data)) {
        throw new Error(
          "Invalid donation list received."
        );
      }

      setDonations(data);
      return true;

    } catch (err) {
      setError(err.message);
      return false;

    } finally {
      setLoadingDonations(false);
    }
  }

  useEffect(() => {
    loadDonations();
  }, []);

  // ==========================================================
  // REGISTRATION
  // ==========================================================

  function handleRegistrationChange(event) {
    const { name, value } = event.target;

    setRegistration(previous => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleRegistration(event) {
    event.preventDefault();

    if (registering) return;

    clearMessages();
    setRegistering(true);

    try {
      const response = await fetch(REGISTER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          organization_name:
            registration.organization_name.trim(),
          organization_type:
            registration.organization_type,
          address: registration.address.trim(),
          email: registration.email.trim(),
          password: registration.password
        })
      });

      const data = await readResponse(response);

      setMessage(
        data.message ||
        "User registered successfully."
      );

      setRegistration({ ...emptyRegistration });

    } catch (err) {
      setError(err.message);

    } finally {
      setRegistering(false);
    }
  }

  // ==========================================================
  // POST DONATION
  // ==========================================================

  function handleChange(event) {
    const { name, value } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    clearMessages();
    setLoading(true);

    try {
      const response = await fetch(DONATIONS_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await readResponse(response);

      setForm({ ...emptyDonation });

      setMessage(
        data.message ||
        "Donation posted successfully."
      );

      await loadDonations();

    } catch (err) {
      setError(err.message);

    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // CLAIM DONATION
  // ==========================================================

  async function handleClaim(donationId) {
    if (claimingId !== null) return;

    clearMessages();

    const id = Number(donationId);
    const recipientId = Number(recipientUserId);

    if (!Number.isSafeInteger(id) || id <= 0) {
      setError("Invalid donation ID.");
      return;
    }

    if (
      recipientUserId.trim() === "" ||
      !Number.isSafeInteger(recipientId) ||
      recipientId <= 0
    ) {
      setError(
        "Please enter a valid recipient user ID."
      );
      return;
    }

    setClaimingId(id);

    try {
      const response = await fetch(
        `${DONATIONS_API}/${id}/claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            recipient_user_id: recipientId
          })
        }
      );

      const data = await readResponse(response);

      setMessage(
        data.message ||
        "Donation claimed successfully."
      );

      await loadDonations();

    } catch (err) {
      setError(err.message);

    } finally {
      setClaimingId(null);
    }
  }

  // ==========================================================
  // EDIT DONATION
  // ==========================================================

  function startEditing(donation) {
    clearMessages();

    setEditingId(donation.donation_id);

    setEditForm({
      food_type: donation.food_type || "",
      quantity: String(donation.quantity ?? ""),
      quantity_unit: donation.quantity_unit || "",
      pickup_address: donation.pickup_address || "",
      pickup_date: formatDate(donation.pickup_date),
      pickup_time: formatTime(donation.pickup_time),
      claim_deadline: formatDateTimeLocal(
        donation.claim_deadline
      ),
      additional_information:
        donation.additional_information || ""
    });
  }

  function handleEditChange(event) {
    const { name, value } = event.target;

    setEditForm(previous => ({
      ...previous,
      [name]: value
    }));
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm({ ...emptyDonation });
  }

  async function handleSaveEdit(event) {
    event.preventDefault();

    if (savingEdit || editingId === null) return;

    clearMessages();
    setSavingEdit(true);

    try {
      const response = await fetch(
        `${DONATIONS_API}/${editingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(editForm)
        }
      );

      const data = await readResponse(response);

      cancelEditing();

      setMessage(
        data.message ||
        "Donation updated successfully."
      );

      await loadDonations();

    } catch (err) {
      setError(err.message);

    } finally {
      setSavingEdit(false);
    }
  }

  // ==========================================================
  // USER INTERFACE
  // ==========================================================

  return (
    <main className="app">
      <header>
        <h1>Replate</h1>
        <p>
          Food Surplus Donation Management System
        </p>
      </header>

      {/* ================================================
          ACCOUNT REGISTRATION
      ================================================= */}

      <section>
        <h2>Register an Account</h2>

        <p>
          Register a foodservice business or recipient
          organization.
        </p>

        <form onSubmit={handleRegistration}>
          <label>
            Organization Name
            <input
              type="text"
              name="organization_name"
              value={registration.organization_name}
              onChange={handleRegistrationChange}
              required
            />
          </label>

          <label>
            Organization Type
            <select
              name="organization_type"
              value={registration.organization_type}
              onChange={handleRegistrationChange}
              required
            >
              <option value="">
                Select organization type
              </option>
              <option value="FOODSERVICE">
                Foodservice Donor
              </option>
              <option value="RECIPIENT">
                Food Assistance Recipient
              </option>
            </select>
          </label>

          <label>
            Organization Address
            <input
              type="text"
              name="address"
              value={registration.address}
              onChange={handleRegistrationChange}
              required
            />
          </label>

          <label>
            Email Address
            <input
              type="email"
              name="email"
              value={registration.email}
              onChange={handleRegistrationChange}
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              value={registration.password}
              onChange={handleRegistrationChange}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button
            type="submit"
            disabled={registering}
          >
            {registering
              ? "Registering..."
              : "Create Account"}
          </button>
        </form>

        <p>
          Registration creates an account but does not
          automatically log you in.
        </p>
      </section>

      {/* ================================================
          POST A DONATION
      ================================================= */}

      <section>
        <h2>Post a Donation</h2>

        <form onSubmit={handleSubmit}>
          <label>
            Food Type
            <select
              name="food_type"
              value={form.food_type}
              onChange={handleChange}
              required
            >
              <option value="">
                Select food type
              </option>
              <option value="Prepared Meals">
                Prepared Meals
              </option>
              <option value="Bakery Items">
                Bakery Items
              </option>
              <option value="Fresh Produce">
                Fresh Produce
              </option>
              <option value="Packaged Food">
                Packaged Food
              </option>
            </select>
          </label>

          <label>
            Quantity
            <input
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              min="0.01"
              step="0.01"
              required
            />
          </label>

          <label>
            Unit
            <select
              name="quantity_unit"
              value={form.quantity_unit}
              onChange={handleChange}
              required
            >
              <option value="">
                Select unit
              </option>
              <option value="servings">
                Servings
              </option>
              <option value="lbs">
                Pounds
              </option>
              <option value="boxes">
                Boxes
              </option>
              <option value="items">
                Items
              </option>
            </select>
          </label>

          <label>
            Pickup Address
            <input
              type="text"
              name="pickup_address"
              value={form.pickup_address}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Pickup Date
            <input
              type="date"
              name="pickup_date"
              value={form.pickup_date}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Pickup Time
            <input
              type="time"
              name="pickup_time"
              value={form.pickup_time}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Claim Deadline
            <input
              type="datetime-local"
              name="claim_deadline"
              value={form.claim_deadline}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Additional Information
            <textarea
              name="additional_information"
              value={form.additional_information}
              onChange={handleChange}
              rows={3}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Posting..."
              : "Post Donation"}
          </button>
        </form>
      </section>

      {/* ================================================
          AVAILABLE DONATIONS
      ================================================= */}

      <section>
        <h2>Available Donations</h2>

        <label>
          Demo Recipient User ID
          <input
            type="number"
            min="1"
            value={recipientUserId}
            onChange={event =>
              setRecipientUserId(event.target.value)
            }
            placeholder="Enter recipient user ID"
          />
        </label>

        {loadingDonations ? (
          <p>Loading donations...</p>
        ) : (
          <div className="donations-list">
            {donations.length === 0 ? (
              <p>No donations available.</p>
            ) : (
              donations.map(donation => (
                <article
                  key={donation.donation_id}
                  className="donation-card"
                >
                  <h3>{donation.food_type}</h3>

                  <p>
                    <strong>Donor:</strong>{" "}
                    {donation.organization_name}
                  </p>

                  <p>
                    <strong>Quantity:</strong>{" "}
                    {donation.quantity}{" "}
                    {donation.quantity_unit}
                  </p>

                  <p>
                    <strong>Pickup:</strong>{" "}
                    {donation.pickup_address}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {donation.status}
                  </p>

                  <button
                    type="button"
                    disabled={claimingId !== null}
                    onClick={() =>
                      handleClaim(donation.donation_id)
                    }
                  >
                    {claimingId ===
                    donation.donation_id
                      ? "Claiming..."
                      : "Claim Donation"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startEditing(donation)
                    }
                  >
                    Edit Donation (Demo)
                  </button>
                </article>
              ))
            )}
          </div>
        )}
      </section>

      {/* ================================================
          EDIT DONATION
      ================================================= */}

      {editingId !== null && (
        <section>
          <h2>Edit Donation #{editingId}</h2>

          <p>
            Demo editing only. Donor ownership
            verification is not implemented.
          </p>

          <form onSubmit={handleSaveEdit}>
            <label>
              Food Type
              <select
                name="food_type"
                value={editForm.food_type}
                onChange={handleEditChange}
                required
              >
                <option value="Prepared Meals">
                  Prepared Meals
                </option>
                <option value="Bakery Items">
                  Bakery Items
                </option>
                <option value="Fresh Produce">
                  Fresh Produce
                </option>
                <option value="Packaged Food">
                  Packaged Food
                </option>
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                name="quantity"
                value={editForm.quantity}
                onChange={handleEditChange}
                min="0.01"
                step="0.01"
                required
              />
            </label>

            <label>
              Unit
              <select
                name="quantity_unit"
                value={editForm.quantity_unit}
                onChange={handleEditChange}
                required
              >
                <option value="servings">
                  Servings
                </option>
                <option value="lbs">
                  Pounds
                </option>
                <option value="boxes">
                  Boxes
                </option>
                <option value="items">
                  Items
                </option>
              </select>
            </label>

            <label>
              Pickup Address
              <input
                type="text"
                name="pickup_address"
                value={editForm.pickup_address}
                onChange={handleEditChange}
                required
              />
            </label>

            <label>
              Pickup Date
              <input
                type="date"
                name="pickup_date"
                value={editForm.pickup_date}
                onChange={handleEditChange}
                required
              />
            </label>

            <label>
              Pickup Time
              <input
                type="time"
                name="pickup_time"
                value={editForm.pickup_time}
                onChange={handleEditChange}
                required
              />
            </label>

            <label>
              Claim Deadline
              <input
                type="datetime-local"
                name="claim_deadline"
                value={editForm.claim_deadline}
                onChange={handleEditChange}
                required
              />
            </label>

            <label>
              Additional Information
              <textarea
                name="additional_information"
                value={
                  editForm.additional_information
                }
                onChange={handleEditChange}
                rows={3}
              />
            </label>

            <button
              type="submit"
              disabled={savingEdit}
            >
              {savingEdit
                ? "Saving..."
                : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={cancelEditing}
              disabled={savingEdit}
            >
              Cancel Editing
            </button>
          </form>
        </section>
      )}

      {/* ================================================
          STATUS MESSAGES
      ================================================= */}

      {message && (
        <p role="status">{message}</p>
      )}

      {error && (
        <p role="alert">Error: {error}</p>
      )}
    </main>
  );
}

export default App;
