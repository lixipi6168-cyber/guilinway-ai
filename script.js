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
    updateQuota(payload);
    if (response.status === 429) {
      const limitError = new Error(payload.error || "rate_limited");
      limitError.code = "limit_reached";
      throw limitError;
    }
    if (!response.ok || !payload.answer) {
      throw new Error(payload.error || "assistant_unavailable");
    }
    thinkingMessage.textContent = payload.answer;
    thinkingMessage.classList.remove("pending");
    trackEvent("ai_answer_received", { question_category: questionCategory });
  } catch (error) {
    if (error.code === "limit_reached") {
      showLimitNudge(thinkingMessage);
      trackEvent("ai_limit_reached");
    } else {
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
    }
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
