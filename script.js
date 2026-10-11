const inquiryForm = document.querySelector("#inquiryForm");

const trackEvent = (eventName, parameters = {}) => {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, parameters);
};

let contactFormStarted = false;

inquiryForm?.addEventListener("focusin", () => {
  if (contactFormStarted) return;
  contactFormStarted = true;
  trackEvent("contact_form_started");
});

inquiryForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(inquiryForm);
  trackEvent("contact_form_submitted");
  const subject = encodeURIComponent("Guilin Way Travel Question");
  const body = encodeURIComponent(
    [
      `Name: ${data.get("name") || ""}`,
      `Email: ${data.get("email") || ""}`,
      `Travel date: ${data.get("date") || ""}`,
      `Topic: ${data.get("route") || ""}`,
      "",
      "Question:",
      data.get("message") || "",
    ].join("\n")
  );

  window.location.href = `mailto:guilinway@gmail.com?subject=${subject}&body=${body}`;
});
const aiChatForm = document.querySelector("#aiChatForm");
const aiChatWindow = document.querySelector("#aiChatWindow");
const aiQuestionInput = document.querySelector("#aiQuestion");
const suggestionButtons = document.querySelectorAll(".ai-suggestions button");

const getQuestionCategory = (question) => {
  const normalizedQuestion = question.toLowerCase();
  if (/longji|rice terrace|ping'an|dazhai/.test(normalizedQuestion)) return "longji";
  if (/li river|cruise/.test(normalizedQuestion)) return "li_river";
  if (/hotel|stay|accommodation|guilin or yangshuo/.test(normalizedQuestion)) return "accommodation";
  if (/train|airport|transport|bus|taxi|transfer/.test(normalizedQuestion)) return "transport";
  if (/food|eat|restaurant|dish/.test(normalizedQuestion)) return "food";
  if (/day|days|itinerary|route|plan/.test(normalizedQuestion)) return "itinerary";
  return "other";
};

const scrollAiToBottom = () => {
  if (!aiChatWindow) return;
  window.requestAnimationFrame(() => {
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
  });
};

const addAiMessage = (text, type) => {
  if (!aiChatWindow) return;
  const message = document.createElement("div");
  message.className = `ai-message ${type}`;
  message.textContent = text;
  aiChatWindow.appendChild(message);
  scrollAiToBottom();
  return message;
};

/* ---- Membership (login / signup) ---- */
const authButton = document.querySelector("#authButton");
const authUser = document.querySelector("#authUser");
const quotaLine = document.querySelector("#quotaLine");
const authModal = document.querySelector("#authModal");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authEmail = document.querySelector("#authEmail");
const authPassword = document.querySelector("#authPassword");
const authSubmit = document.querySelector("#authSubmit");
const authSwitch = document.querySelector("#authSwitch");
const authError = document.querySelector("#authError");
const authClose = document.querySelector("#authClose");

const authState = { loggedIn: false, email: null, plan: "guest", limit: null, remaining: null };
let authMode = "register";

const AUTH_ERRORS = {
  invalid_email: "Please enter a valid email address.",
  weak_password: "Your password must be 8 to 128 characters.",
  email_taken: "This email is already registered. Please log in instead.",
  invalid_credentials: "Email or password is incorrect.",
  signup_limit: "Too many sign-ups from this network today. Please try again tomorrow.",
  rate_limited: "Too many attempts. Please wait a minute and try again.",
};

const callAuth = async (action, extra = {}) => {
  try {
    const response = await fetch("/.netlify/functions/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
};

const renderAuth = () => {
  if (authButton) authButton.textContent = authState.loggedIn ? "Log out" : "Log in / Sign up";
  if (authUser) {
    authUser.textContent = authState.email || "";
    authUser.hidden = !authState.loggedIn;
  }
  if (quotaLine) {
    if (authState.remaining === null || authState.limit === null) {
      quotaLine.hidden = true;
      return;
    }
    quotaLine.hidden = false;
    quotaLine.textContent = authState.loggedIn
      ? `Member: ${authState.remaining} of ${authState.limit} questions left today.`
      : `Guest: ${authState.remaining} of ${authState.limit} questions left today. Sign up free for more.`;
  }
};

const applyQuota = (data) => {
  if (!data) return;
  if (typeof data.limit === "number") authState.limit = data.limit;
  if (typeof data.remaining === "number") authState.remaining = data.remaining;
  if (data.plan) authState.plan = data.plan;
  renderAuth();
};

const refreshStatus = async () => {
  const { ok, data } = await callAuth("me");
  if (!ok) return;
  authState.loggedIn = Boolean(data.loggedIn);
  authState.email = data.email || null;
  applyQuota(data);
  renderAuth();
};

const setAuthMode = (mode) => {
  authMode = mode;
  const isRegister = mode === "register";
  if (authTitle) authTitle.textContent = isRegister ? "Create your free account" : "Log in";
  if (authSubmit) authSubmit.textContent = isRegister ? "Sign up" : "Log in";
  if (authSwitch) {
    authSwitch.textContent = isRegister ? "Already a member? Log in" : "New here? Create a free account";
  }
  if (authPassword) authPassword.autocomplete = isRegister ? "new-password" : "current-password";
  if (authError) authError.textContent = "";
};

const openAuth = (mode) => {
  if (!authModal) return false;
  setAuthMode(mode);
  authModal.hidden = false;
  authEmail?.focus();
  return true;
};

const closeAuth = () => {
  if (authModal) authModal.hidden = true;
};

authButton?.addEventListener("click", async () => {
  if (authState.loggedIn) {
    await callAuth("logout");
    authState.loggedIn = false;
    authState.email = null;
    trackEvent("member_logout");
    await refreshStatus();
    return;
  }
  openAuth("register");
});

authSwitch?.addEventListener("click", () => {
  setAuthMode(authMode === "register" ? "login" : "register");
});

authClose?.addEventListener("click", closeAuth);
authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeAuth();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAuth();
});

authForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authError) authError.textContent = "";
  if (authSubmit) authSubmit.disabled = true;
  const action = authMode === "register" ? "register" : "login";
  const { ok, data } = await callAuth(action, {
    email: authEmail?.value.trim() || "",
    password: authPassword?.value || "",
  });
  if (authSubmit) authSubmit.disabled = false;
  if (!ok) {
    if (authError) {
      authError.textContent = AUTH_ERRORS[data.error] || "Something went wrong. Please try again shortly.";
    }
    return;
  }
  trackEvent(action === "register" ? "member_signup" : "member_login");
  if (authPassword) authPassword.value = "";
  closeAuth();
  await refreshStatus();
});

aiChatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = aiQuestionInput?.value.trim();
  if (!question) return;
  const questionCategory = getQuestionCategory(question);

  trackEvent("ai_question_submitted", { question_category: questionCategory });
  addAiMessage(question, "user");
  aiQuestionInput.value = "";
  const submitButton = aiChatForm.querySelector('button[type="submit"]');
  const thinkingMessage = addAiMessage("Thinking about your Guilin trip...", "agent pending");
  aiQuestionInput.disabled = true;
  submitButton.disabled = true;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 125000);

  try {
    const response = await fetch("/.netlify/functions/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 429) {
      const quotaHit = payload.error === "quota_exceeded";
      const canSignUp = Boolean(authModal);
      let text;
      if (!quotaHit) {
        text = "You are asking a little too fast. Please wait a minute and try again.";
      } else if (payload.plan === "member") {
        text = "You have used all of today's questions. Please come back tomorrow.";
      } else if (canSignUp) {
        text = "You have used today's free questions. Sign up free to ask more, or come back tomorrow.";
      } else {
        text = "You have used today's free questions. Please come back tomorrow or email guilinway@gmail.com.";
      }
      if (quotaHit) applyQuota({ remaining: 0, limit: payload.limit, plan: payload.plan });
      thinkingMessage.textContent = text;
      thinkingMessage.classList.remove("pending");
      trackEvent("ai_question_limited", {
        limit_type: quotaHit ? "daily_quota" : "rate_limit",
        plan: payload.plan || "guest",
      });
      if (quotaHit && payload.plan !== "member") openAuth("register");
      return;
    }

    if (!response.ok || !payload.answer) {
      throw new Error(payload.error || "assistant_unavailable");
    }
    thinkingMessage.textContent = payload.answer;
    thinkingMessage.classList.remove("pending");
    applyQuota(payload);
    trackEvent("ai_answer_received", { question_category: questionCategory });
  } catch (error) {
    const failureType = error.name === "AbortError" ? "timeout" : "unavailable";
    thinkingMessage.textContent =
      error.name === "AbortError"
        ? "The answer is taking too long. Please try again in a moment."
        : "The AI guide is temporarily unavailable. Please try again shortly or email guilinway@gmail.com.";
    thinkingMessage.classList.remove("pending");
    thinkingMessage.classList.add("error");
    trackEvent("ai_answer_failed", {
      question_category: questionCategory,
      failure_type: failureType,
    });
  } finally {
    window.clearTimeout(timeout);
    aiQuestionInput.disabled = false;
    submitButton.disabled = false;
    scrollAiToBottom();
    aiQuestionInput.focus();
  }
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || button.textContent || "";
    trackEvent("ai_suggestion_clicked", {
      question_category: getQuestionCategory(question),
    });
    if (aiQuestionInput) aiQuestionInput.value = question;
    aiChatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
  });
});

refreshStatus();
