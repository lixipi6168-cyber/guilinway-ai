
// ---- Membership (sign in / sign up) ----
const aiAuthBox = document.querySelector("#aiAuth");
const aiQuota = document.querySelector("#aiQuota");
const authModal = document.querySelector("#authModal");
const authModalTitle = document.querySelector("#authModalTitle");
const authModalSub = document.querySelector("#authModalSub");
const authForm = document.querySelector("#authForm");
const authEmailInput = document.querySelector("#authEmail");
const authPasswordInput = document.querySelector("#authPassword");
const authError = document.querySelector("#authError");
const authSubmitButton = document.querySelector("#authSubmit");
const authSwitchButton = document.querySelector("#authSwitch");
const authModalClose = document.querySelector("#authModalClose");

let authMode = "login"; // "login" | "register"
let authState = { loggedIn: false, email: "", plan: "guest" };

const callAuth = async (action, email, password) => {
  const response = await fetch("/.netlify/functions/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (action !== "me" && !payload.ok && !payload.loggedIn)) {
    const error = new Error(payload.error || "auth_failed");
    error.status = response.status;
    throw error;
  }
  return payload;
};

const renderAuthArea = () => {
  const slots = [aiAuthBox, document.querySelector("#headerAuth")].filter(Boolean);
  slots.forEach((box) => {
    box.innerHTML = "";
    if (authState.loggedIn && authState.email) {
      const label = document.createElement("span");
      label.className = "ai-auth-email";
      label.textContent = authState.email;
      label.title = authState.email;
      const outBtn = document.createElement("button");
      outBtn.type = "button";
      outBtn.className = "ai-auth-btn";
      outBtn.textContent = "Sign out";
      outBtn.addEventListener("click", signOut);
      box.append(label, outBtn);
    } else {
      const inBtn = document.createElement("button");
      inBtn.type = "button";
      inBtn.className = "ai-auth-btn";
      inBtn.textContent = "Sign in";
      inBtn.addEventListener("click", () => openAuthModal("login"));
      box.append(inBtn);
    }
  });
};

const renderQuota = (payload = {}) => {
  if (!aiQuota) return;
  aiQuota.innerHTML = "";
  if (authState.loggedIn) {
    aiQuota.textContent = "Signed in · enjoy unlimited questions";
    return;
  }
  const remaining = typeof payload.remaining === "number" ? payload.remaining : null;
  const limit = typeof payload.limit === "number" ? payload.limit : null;
  const text = document.createElement("span");
  text.textContent =
    remaining !== null && limit !== null
      ? `${remaining} of ${limit} free questions left today · `
      : "Free questions are limited for guests · ";
  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.textContent = "Sign up free for unlimited";
  upBtn.addEventListener("click", () => openAuthModal("register"));
  aiQuota.append(text, upBtn);
};

// Called from the ask submit handler after each response.
const updateQuota = (payload) => renderQuota(payload);

const showLimitNudge = (placeholder) => {
  const nudge = document.createElement("div");
  nudge.className = "ai-message agent";
  const text = document.createElement("div");
  text.textContent = "You've used today's free questions.";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ai-nudge-button";
  btn.textContent = "Sign up free to keep asking";
  btn.addEventListener("click", () => openAuthModal("register"));
  nudge.append(text, btn);
  placeholder.replaceWith(nudge);
  scrollAiToBottom();
};

const openAuthModal = (mode) => {
  authMode = mode === "register" ? "register" : "login";
  authModalTitle.textContent = authMode === "register" ? "Create account" : "Sign in";
  authModalSub.textContent =
    authMode === "register" ? "Free forever · unlimited AI questions." : "Welcome back.";
  authSubmitButton.textContent = authMode === "register" ? "Create account" : "Sign in";
  authSwitchButton.textContent = authMode === "register" ? "Sign in" : "Create an account";
  authError.hidden = true;
  authModal.hidden = false;
  trackEvent("auth_modal_opened", { auth_mode: authMode });
  window.setTimeout(() => authEmailInput?.focus(), 50);
};

const closeAuthModal = () => {
  authModal.hidden = true;
};

authSwitchButton?.addEventListener("click", () => {
  openAuthModal(authMode === "register" ? "login" : "register");
});
const authPasswordToggle = document.querySelector("#authPasswordToggle");
authPasswordToggle?.addEventListener("click", () => {
  const showing = authPasswordInput.type === "text";
  authPasswordInput.type = showing ? "password" : "text";
  authPasswordToggle.textContent = showing ? "Show" : "Hide";
  authPasswordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
});
authModalClose?.addEventListener("click", closeAuthModal);
authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuthModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && authModal && !authModal.hidden) closeAuthModal();
});

const friendlyAuthError = (code) =>
  ({
    invalid_email: "Please enter a valid email address.",
    weak_password: "Password must be at least 8 characters.",
    email_taken: "This email is already registered. Try signing in.",
    invalid_credentials: "Incorrect email or password.",
    signup_limit: "Too many signups from your network today. Please try again tomorrow.",
    rate_limited: "Too many attempts. Please try again in a moment.",
  })[code] || "Something went wrong. Please try again.";

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = authEmailInput?.value.trim() || "";
  const password = authPasswordInput?.value || "";
  authError.hidden = true;
  authSubmitButton.disabled = true;
  try {
    const payload = await callAuth(authMode, email, password);
    authState = { loggedIn: true, email: payload.email || email, plan: "member" };
    closeAuthModal();
    renderAuthArea();
    renderQuota();
    trackEvent("auth_succeeded", { auth_mode: authMode });
    addAiMessage(
      authMode === "register"
        ? `Welcome aboard, ${authState.email}! Ask me anything about Guilin.`
        : `Welcome back, ${authState.email}!`,
      "agent"
    );
  } catch (error) {
    authError.textContent = friendlyAuthError(error.message);
    authError.hidden = false;
    trackEvent("auth_failed", { auth_mode: authMode });
  } finally {
    authSubmitButton.disabled = false;
  }
});

const signOut = async () => {
  try {
    await callAuth("logout");
  } catch {
    // Local sign-out still proceeds.
  }
  authState = { loggedIn: false, email: "", plan: "guest" };
  renderAuthArea();
  renderQuota();
  trackEvent("auth_signed_out");
};

// Restore session on page load.
(async () => {
  renderAuthArea();
  renderQuota();
  try {
    const me = await callAuth("me");
    if (me.loggedIn) {
      authState = { loggedIn: true, email: me.email || "", plan: me.plan || "member" };
      renderAuthArea();
      renderQuota(me);
    }
  } catch {
    // Stay in guest mode; the ask flow will surface any problem.
  }
})();
