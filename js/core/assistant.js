// js/core/assistant.js — the AI assistant panel.
//
// One launcher and one panel for the whole dashboard (the markup lives at the
// bottom of dashboard.html, outside .dashboard-layout), so it is available on
// every page and survives navigation between them.
//
// ---------------------------------------------------------------------------
// DESIGN-PREVIEW MODE: the AI endpoints don't exist yet, so `ASSISTANT_STUBBED`
// short-circuits the request and replies with a canned message. Flip it to
// false once POST /admin/assistant/chat ships — the real request code below is
// already wired up. See ASSISTANT_BACKEND.md.
// ---------------------------------------------------------------------------
const ASSISTANT_STUBBED = true;

// Conversation is per-tab: refreshing starts a new thread. Persisting it is a
// backend decision (see the doc) rather than something to fake in storage.
let assistantMessages = [];
let assistantConversationId = null;
let assistantBusy = false;

const ASSISTANT_SUGGESTIONS = [
  "How many bookings were confirmed this week?",
  "Which cars are still awaiting verification?",
  "Summarise the open support conversations",
];

function assistantEls() {
  return {
    fab: document.getElementById("assistantFab"),
    panel: document.getElementById("assistantPanel"),
    close: document.getElementById("assistantClose"),
    list: document.getElementById("assistantMessages"),
    form: document.getElementById("assistantComposer"),
    input: document.getElementById("assistantInput"),
    send: document.getElementById("assistantSend"),
    status: document.getElementById("assistantStatus"),
    footnote: document.getElementById("assistantFootnote"),
  };
}

function assistantIsOpen() {
  const { panel } = assistantEls();
  return Boolean(panel && !panel.hidden);
}

function openAssistant() {
  const { fab, panel, input } = assistantEls();
  if (!panel) return;
  panel.hidden = false;
  // Next frame, so the transform transition actually runs.
  requestAnimationFrame(() => panel.classList.add("is-open"));
  if (fab) {
    fab.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Close AI assistant");
  }
  renderAssistantMessages();
  setTimeout(() => input && input.focus(), 180);
}

function closeAssistant() {
  const { fab, panel } = assistantEls();
  if (!panel) return;
  panel.classList.remove("is-open");
  if (fab) {
    fab.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Open AI assistant");
    fab.focus();
  }
  // Wait out the slide-out before removing it from the tree.
  setTimeout(() => {
    if (!panel.classList.contains("is-open")) panel.hidden = true;
  }, 240);
}

function toggleAssistant() {
  if (assistantIsOpen()) closeAssistant();
  else openAssistant();
}

function assistantTimeLabel(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderAssistantMessages() {
  const { list } = assistantEls();
  if (!list) return;

  if (!assistantMessages.length) {
    list.innerHTML = `
      <div class="assistant-empty">
        <div class="assistant-empty-title">How can I help?</div>
        <p>Ask about bookings, hosts, cars, revenue or anything else in the dashboard.</p>
        <div class="assistant-suggestions">
          ${ASSISTANT_SUGGESTIONS.map(
            (text) =>
              `<button type="button" class="assistant-suggestion">${escapeHtml(text)}</button>`,
          ).join("")}
        </div>
      </div>`;
    list.querySelectorAll(".assistant-suggestion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { input } = assistantEls();
        if (input) {
          input.value = btn.textContent;
          input.dispatchEvent(new Event("input"));
          input.focus();
        }
      });
    });
    return;
  }

  list.innerHTML = assistantMessages
    .map((msg) => {
      const roleClass =
        msg.role === "admin" ? "is-admin" : msg.error ? "is-ai is-error" : "is-ai";
      return `
        <div class="assistant-msg ${roleClass}">
          <div class="assistant-bubble">${escapeHtml(msg.text)}</div>
          <div class="assistant-msg-time">${assistantTimeLabel(msg.at)}</div>
        </div>`;
    })
    .join("");

  if (assistantBusy) {
    list.insertAdjacentHTML(
      "beforeend",
      '<div class="assistant-typing" aria-label="Assistant is typing"><span></span><span></span><span></span></div>',
    );
  }

  list.scrollTop = list.scrollHeight;
}

function pushAssistantMessage(role, text, opts) {
  assistantMessages.push({
    role: role,
    text: text,
    at: new Date(),
    error: Boolean(opts && opts.error),
  });
  renderAssistantMessages();
}

function setAssistantBusy(busy) {
  assistantBusy = busy;
  const { send, status } = assistantEls();
  if (send) send.disabled = busy || !assistantHasDraft();
  if (status) {
    status.textContent = busy
      ? "Thinking..."
      : "Ask about anything in the dashboard";
  }
  renderAssistantMessages();
}

function assistantHasDraft() {
  const { input } = assistantEls();
  return Boolean(input && input.value.trim());
}

// The one request the backend has to answer. Everything else here is UI.
async function sendAssistantMessage(text) {
  if (ASSISTANT_STUBBED) {
    await new Promise((r) => setTimeout(r, 900));
    return {
      reply:
        "I'm not connected to the AI service yet — this panel is a design " +
        "preview.\n\nOnce the endpoint is live I'll be able to answer this " +
        "using the same data you see in the dashboard.",
      conversation_id: assistantConversationId || "preview",
    };
  }

  return api.assistantChat({
    message: text,
    conversation_id: assistantConversationId,
    // Where the admin asked from, so the assistant can answer in context.
    page: typeof currentDashboardPage !== "undefined" ? currentDashboardPage : null,
  });
}

async function submitAssistantMessage(event) {
  event.preventDefault();
  const { input } = assistantEls();
  if (!input) return;

  const text = input.value.trim();
  if (!text || assistantBusy) return;

  pushAssistantMessage("admin", text);
  input.value = "";
  autosizeAssistantInput();
  setAssistantBusy(true);

  try {
    const data = await sendAssistantMessage(text);
    if (data && data.conversation_id) {
      assistantConversationId = data.conversation_id;
    }
    setAssistantBusy(false);
    pushAssistantMessage(
      "ai",
      (data && (data.reply || data.message)) || "No response.",
    );
  } catch (error) {
    setAssistantBusy(false);
    pushAssistantMessage(
      "ai",
      error.message || "Something went wrong reaching the assistant.",
      { error: true },
    );
  }
}

// Grow the composer with the message, up to the CSS max-height.
function autosizeAssistantInput() {
  const { input } = assistantEls();
  if (!input) return;
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 140) + "px";
}

function setupAssistant() {
  const { fab, close, form, input, send, footnote } = assistantEls();
  if (!fab || !form || !input) return;

  if (footnote) {
    footnote.textContent = ASSISTANT_STUBBED
      ? "Preview only — not connected to the AI service yet."
      : "The assistant can be wrong. Check anything important against the data.";
  }

  fab.addEventListener("click", toggleAssistant);
  if (close) close.addEventListener("click", closeAssistant);
  form.addEventListener("submit", submitAssistantMessage);

  input.addEventListener("input", () => {
    autosizeAssistantInput();
    if (send) send.disabled = assistantBusy || !assistantHasDraft();
  });

  // Enter sends, Shift+Enter starts a new line.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && assistantIsOpen()) closeAssistant();
  });
}
