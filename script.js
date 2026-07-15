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

const previewReply = (question) => {
  const lower = question.toLowerCase();

  if (lower.includes("longji")) {
    return "Longji Rice Terraces can be worth it if you like mountain villages, rice fields, and slow views. For a first Guilin trip, I would check your season, walking comfort, and whether you have enough time before adding it.";
  }

  if (lower.includes("li river") || lower.includes("yangshuo")) {
    return "For many first-time visitors, the easiest plan is Guilin city first, then a Li River cruise or transfer toward Yangshuo, then one slower countryside day around the Yulong River.";
  }

  if (lower.includes("3 days") || lower.includes("three days")) {
    return "For 3 days, I would usually suggest: Day 1 Guilin city, Day 2 Li River to Yangshuo, Day 3 Yangshuo countryside. The exact plan depends on your arrival and departure times.";
  }

  return "This is a preview response. In the real version, Hermes Agent would answer only Guilin travel questions and guide visitors toward practical route, transport, food, hotel, and inquiry help.";
};

const addAiMessage = (text, type) => {
  if (!aiChatWindow) return;
  const message = document.createElement("div");
  message.className = `ai-message ${type}`;
  message.textContent = text;
  aiChatWindow.appendChild(message);
  aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
};

aiChatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = aiQuestionInput?.value.trim();
  if (!question) return;

  addAiMessage(question, "user");
  aiQuestionInput.value = "";
  window.setTimeout(() => addAiMessage(previewReply(question), "agent"), 350);
});

suggestionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const question = button.dataset.question || button.textContent || "";
    if (aiQuestionInput) aiQuestionInput.value = question;
    aiChatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
  });
});
