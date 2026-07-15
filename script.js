const inquiryForm = document.querySelector("#inquiryForm");

inquiryForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(inquiryForm);
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

  window.location.href = `mailto:guilinway@outlook.com?subject=${subject}&body=${body}`;
});
const aiChatForm = document.querySelector("#aiChatForm");
const aiChatWindow = document.querySelector("#aiChatWindow");
const aiQuestionInput = document.querySelector("#aiQuestion");
const suggestionButtons = document.querySelectorAll(".ai-suggestions button");

const addAiMessage = (text, type) => {
  if (!aiChatWindow) return;
  const message = document.createElement("div");
  message.className = `ai-message ${type}`;
  message.textContent = text;
  aiChatWindow.appendChild(message);
  aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
  return message;
};

aiChatForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = aiQuestionInput?.value.trim();
  if (!question) return;

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
    if (!response.ok || !payload.answer) {
      throw new Error(payload.error || "assistant_unavailable");
    }
    thinkingMessage.textContent = payload.answer;
    thinkingMessage.classList.remove("pending");
  } catch (error) {
    thinkingMessage.textContent =
      error.name === "AbortError"
        ? "The answer is taking too long. Please try again in a moment."
        : "The AI guide is temporarily unavailable. Please try again shortly or email guilinway@outlook.com.";
    thinkingMessage.classList.remove("pending");
    thinkingMessage.classList.add("error");
  } finally {
    window.clearTimeout(timeout);
    aiQuestionInput.disabled = false;
    submitButton.disabled = false;
    aiQuestionInput.focus();
  }
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || button.textContent || "";
    if (aiQuestionInput) aiQuestionInput.value = question;
    aiChatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
  });
});
