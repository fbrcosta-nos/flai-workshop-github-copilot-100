document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const messageDiv = document.getElementById("message");

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const availabilityClass = spotsLeft <= 2 ? 'low' : spotsLeft <= 5 ? 'medium' : 'high';
        const canSignup = spotsLeft > 0;

        // Generate participants list HTML
        let participantsHTML = '';
        if (details.participants.length > 0) {
          const participantsList = details.participants
            .map(email => `
              <li>
                <span class="participant-email">${email}</span>
                <button class="delete-btn" data-activity="${name}" data-email="${email}" title="Remove participant" aria-label="Remove ${email} from ${name}">
                  <span class="material-icons">delete</span>
                </button>
              </li>
            `)
            .join('');
          participantsHTML = `
            <div class="participants">
              <h5>Participants (${details.participants.length}/${details.max_participants})</h5>
              <ul>${participantsList}</ul>
            </div>
          `;
        } else {
          participantsHTML = `
            <div class="participants">
              <h5>Participants (0/${details.max_participants})</h5>
              <p class="no-participants">No participants yet. Be the first to sign up!</p>
            </div>
          `;
        }

        // Signup form HTML
        const signupFormHTML = canSignup ? `
          <div class="signup-form hidden" data-activity="${name}">
            <div class="input-group">
              <input type="email" class="signup-email" required placeholder=" " />
              <label>Your Email</label>
              <span class="input-icon material-icons">email</span>
            </div>
            <div class="form-actions">
              <button type="button" class="btn-cancel">
                <span class="material-icons">close</span>
                Cancel
              </button>
              <button type="button" class="btn-primary btn-submit">
                <span class="material-icons">check_circle</span>
                Confirm
              </button>
            </div>
          </div>
        ` : '';

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>📅 Schedule:</strong> ${details.schedule}</p>
          <p class="availability ${availabilityClass}">
            <span class="material-icons">${spotsLeft > 0 ? 'event_available' : 'event_busy'}</span>
            <strong>${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} available</strong>
          </p>
          ${participantsHTML}
          ${canSignup ? `<button class="btn-signup" data-activity="${name}">
            <span class="material-icons">person_add</span>
            <span>Sign Up</span>
          </button>` : `<button class="btn-signup" disabled>
            <span class="material-icons">block</span>
            <span>Full</span>
          </button>`}
          ${signupFormHTML}
        `;

        activitiesList.appendChild(activityCard);
      });

      // Add event listeners
      attachEventListeners();
    } catch (error) {
      activitiesList.innerHTML = `
        <div class="error-message">
          <span class="material-icons">error_outline</span>
          <p>Failed to load activities. Please try again later.</p>
        </div>
      `;
      console.error("Error fetching activities:", error);
    }
  }

  // Attach event listeners
  function attachEventListeners() {
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', handleDeleteParticipant);
    });

    // Sign up buttons
    document.querySelectorAll('.btn-signup:not([disabled])').forEach(button => {
      button.addEventListener('click', (e) => {
        const activity = e.currentTarget.dataset.activity;
        showSignupForm(activity);
      });
    });

    // Cancel buttons
    document.querySelectorAll('.btn-cancel').forEach(button => {
      button.addEventListener('click', (e) => {
        const form = e.currentTarget.closest('.signup-form');
        hideSignupForm(form);
      });
    });

    // Submit buttons
    document.querySelectorAll('.btn-submit').forEach(button => {
      button.addEventListener('click', (e) => {
        const form = e.currentTarget.closest('.signup-form');
        handleSignup(form);
      });
    });

    // Enter key on email input
    document.querySelectorAll('.signup-email').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const form = e.currentTarget.closest('.signup-form');
          handleSignup(form);
        }
      });
    });
  }

  // Show signup form
  function showSignupForm(activity) {
    // Hide all other forms
    document.querySelectorAll('.signup-form').forEach(form => {
      form.classList.add('hidden');
    });

    // Show this form
    const form = document.querySelector(`.signup-form[data-activity="${activity}"]`);
    if (form) {
      form.classList.remove('hidden');
      const input = form.querySelector('.signup-email');
      input.focus();
    }
  }

  // Hide signup form
  function hideSignupForm(form) {
    form.classList.add('hidden');
    form.querySelector('.signup-email').value = '';
  }

  // Handle signup
  async function handleSignup(form) {
    const activity = form.dataset.activity;
    const emailInput = form.querySelector('.signup-email');
    const email = emailInput.value.trim();
    const submitBtn = form.querySelector('.btn-submit');

    if (!email) {
      showMessage('Please enter your email', 'error');
      emailInput.focus();
      return;
    }

    // Basic email validation
    if (!email.includes('@')) {
      showMessage('Please enter a valid email address', 'error');
      emailInput.focus();
      return;
    }

    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-icons">hourglass_empty</span>Processing...';

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Refresh the activities list
        await fetchActivities();
        showMessage(result.message, 'success');
      } else {
        showMessage(result.detail || "An error occurred", 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="material-icons">check_circle</span>Confirm';
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", 'error');
      console.error("Error signing up:", error);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-icons">check_circle</span>Confirm';
    }
  }

  // Handle delete participant
  async function handleDeleteParticipant(event) {
    const button = event.currentTarget;
    const activity = button.dataset.activity;
    const email = button.dataset.email;

    if (!confirm(`Are you sure you want to remove ${email} from ${activity}?`)) {
      return;
    }

    // Disable button during request
    button.disabled = true;
    button.style.opacity = '0.5';

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Refresh the activities list
        await fetchActivities();
        showMessage(result.message, 'success');
      } else {
        showMessage(result.detail || "An error occurred", 'error');
      }
    } catch (error) {
      showMessage("Failed to remove participant. Please try again.", 'error');
      console.error("Error removing participant:", error);
    } finally {
      // Re-enable button
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  // Show message function
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  // Initialize app
  fetchActivities();
});
