// js/core/assistant.js — the AI assistant panel.
//
// One launcher and one panel for the whole dashboard (the markup lives at the
// bottom of dashboard.html, outside .dashboard-layout), so it is available on
// every page and survives navigation between them.
//
// Answers stream in over Server-Sent Events from POST /admin/assistant/stream,
// so text appears as it is written and the panel can name the lookup that is
// running. See ai.md.

// The thread id is held for the tab; the transcript itself lives server-side.
let assistantMessages = [];
let assistantConversationId = null;
let assistantBusy = false;

// True between the first token of a reply and the end of the turn — the reply
// bubble is being appended to rather than pushed whole.
let assistantStreaming = false;

// Shown one at a time while a reply is generating, so the wait has some
// character instead of three grey dots. Rotates every few seconds.
const ASSISTANT_THINKING_WORDS = [
  "Boondoggling",
  "Marinating",
  "Percolating",
  "Noodling",
  "Simmering",
  "Ruminating",
  "Puttering",
  "Cogitating",
  "Whirring",
  "Pondering",
];

// The activity line ticks every second; the whimsical word only changes every
// few ticks so it stays readable.
const ASSISTANT_TICK_MS = 1000;
const ASSISTANT_WORD_TICKS = 3;

// How long the reply can go quiet mid-answer before the line comes back. The
// model pauses to think between tool calls, and silence reads as "stuck".
const ASSISTANT_IDLE_MS = 2000;

// While a lookup runs, say which one instead of a rotating word. The list grows
// server-side, so an unrecognised name falls back to a generic phrase rather
// than leaking a raw tool name into the panel.
const ASSISTANT_TOOL_LABELS = {
  get_platform_overview: "Checking the numbers",
  get_today: "Checking today",
  find_bookings: "Searching bookings",
  get_booking: "Opening the booking",
  find_cars: "Searching listings",
  find_user: "Looking up the account",
  get_verification_queue: "Checking the queue",
  get_deposit_claims: "Checking deposit claims",
  get_revenue: "Reading the ledger",
  get_withdrawals: "Checking withdrawals",
  get_refunds: "Checking refunds",
  get_payment_health: "Checking payments",
  get_support_conversations: "Reading support",
  read_support_conversation: "Reading the thread",
  get_agent_conversations: "Checking AI conversations",
  read_agent_conversation: "Reading the thread",
  get_feedback: "Reading feedback",
  get_listing_reports: "Checking reports",
  get_b2b_overview: "Checking Ardena for Business",
  find_b2b_business: "Looking up the workspace",
  get_b2b_support: "Checking B2B support",
  get_admins: "Checking admin accounts",
  get_subscribers: "Checking subscribers",
};

let assistantThinkingWord = ASSISTANT_THINKING_WORDS[0];
let assistantThinkingTimer = null;
let assistantTick = 0;

// Set while a named lookup is running; overrides the rotating word.
let assistantToolLabel = null;

// When the last token landed, so a long silence can bring the line back.
let assistantLastTokenAt = 0;

const ASSISTANT_SUGGESTIONS = [
  "How many bookings were confirmed this week?",
  "Which cars are still awaiting verification?",
  "Summarise the open support conversations",
];

function assistantEls() {
  return {
    fab: document.getElementById("assistantFab"),
    panel: document.getElementById("assistantPanel"),
    scrim: document.getElementById("assistantScrim"),
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
  const { fab, panel, scrim, input } = assistantEls();
  if (!panel) return;
  panel.hidden = false;
  if (scrim) scrim.hidden = false;
  // Next frame, so the transform/opacity transitions actually run.
  requestAnimationFrame(() => {
    panel.classList.add("is-open");
    if (scrim) scrim.classList.add("is-open");
  });
  if (fab) {
    fab.classList.add("is-open");
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "Close AI assistant");
  }
  renderAssistantMessages();
  setTimeout(() => input && input.focus(), 180);
}

function closeAssistant() {
  const { fab, panel, scrim } = assistantEls();
  if (!panel) return;
  panel.classList.remove("is-open");
  if (scrim) scrim.classList.remove("is-open");
  if (fab) {
    fab.classList.remove("is-open");
    fab.setAttribute("aria-expanded", "false");
    fab.setAttribute("aria-label", "Open AI assistant");
    fab.focus();
  }
  // Wait out the slide-out before removing them from the tree.
  setTimeout(() => {
    if (!panel.classList.contains("is-open")) {
      panel.hidden = true;
      if (scrim) scrim.hidden = true;
    }
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

  const lastIndex = assistantMessages.length - 1;

  list.innerHTML = assistantMessages
    .map((msg, i) => {
      const roleClass =
        msg.role === "admin" ? "is-admin" : msg.error ? "is-ai is-error" : "is-ai";
      // A caret on the tail of the reply currently being written.
      const isLive =
        assistantStreaming && i === lastIndex && msg.role === "ai";
      // The live reply keeps its text in its own span so tokens can be appended
      // without rebuilding the bubble (and without disturbing the caret).
      const live = isLive
        ? '<span class="assistant-caret" aria-hidden="true"></span>'
        : "";
      // Lookups the admin's role refused. The reply already explains it; this
      // is a quiet footnote, not an error.
      const note = msg.outOfScope
        ? '<div class="assistant-note">Some of that is outside your role&rsquo;s access.</div>'
        : "";
      return `
        <div class="assistant-msg ${roleClass}">
          <div class="assistant-bubble"><span${isLive ? ' id="assistantLiveText"' : ""}>${escapeHtml(msg.text)}</span>${live}</div>
          ${note}
          <div class="assistant-msg-time">${assistantTimeLabel(msg.at)}</div>
        </div>`;
    })
    .join("");

  if (assistantShowActivity()) {
    list.insertAdjacentHTML(
      "beforeend",
      '<div class="assistant-thinking" aria-label="Generating a reply">' +
        '<span class="assistant-thinking-word" id="assistantThinkingWord">' +
        escapeHtml(assistantThinkingText()) +
        "</span>" +
        '<span class="assistant-typing" aria-hidden="true"><span></span><span></span><span></span></span>' +
        "</div>",
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

// Pick a word that isn't the one already on screen, so each swap is visible.
function nextThinkingWord() {
  const pool = ASSISTANT_THINKING_WORDS.filter((w) => w !== assistantThinkingWord);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Should the activity line be on screen right now?
//
// A turn is not one wait — it is: think, answer a little, run a lookup, answer
// some more. The line has to come back for each of those pauses, otherwise the
// panel looks frozen exactly when the assistant is busiest.
function assistantShowActivity() {
  if (!assistantBusy) return false;
  if (!assistantStreaming) return true; // nothing written yet
  if (assistantToolLabel) return true; // a named lookup is running
  // Mid-answer and gone quiet: the model is thinking between steps.
  return Date.now() - assistantLastTokenAt > ASSISTANT_IDLE_MS;
}

// What the line says: the running lookup if there is one, otherwise the word.
function assistantThinkingText() {
  return (assistantToolLabel || assistantThinkingWord) + "\u2026";
}

function paintThinkingWord() {
  // Update in place: re-rendering the whole log would fight the scroll.
  const el = document.getElementById("assistantThinkingWord");
  if (el) el.textContent = assistantThinkingText();
}

// One timer for the whole turn. Each tick decides whether the line belongs on
// screen and re-renders only when that answer changes, so a streaming reply
// isn't rebuilt once a second.
function startThinkingWords() {
  assistantThinkingWord = nextThinkingWord();
  assistantTick = 0;
  clearInterval(assistantThinkingTimer);
  assistantThinkingTimer = setInterval(() => {
    const want = assistantShowActivity();
    const onScreen = Boolean(document.querySelector(".assistant-thinking"));
    if (want !== onScreen) {
      renderAssistantMessages();
      return;
    }
    if (!want) return;
    // A named lookup holds the line until it finishes.
    if (assistantToolLabel) return;
    assistantTick += 1;
    if (assistantTick % ASSISTANT_WORD_TICKS === 0) {
      assistantThinkingWord = nextThinkingWord();
      paintThinkingWord();
    }
  }, ASSISTANT_TICK_MS);
}

function stopThinkingWords() {
  clearInterval(assistantThinkingTimer);
  assistantThinkingTimer = null;
  assistantToolLabel = null;
}

// `tool` frame: name the lookup and bring the line back if it had gone.
function setAssistantToolLabel(name) {
  assistantToolLabel = ASSISTANT_TOOL_LABELS[name] || "Working";
  if (document.querySelector(".assistant-thinking")) paintThinkingWord();
  else renderAssistantMessages();
}

// Text is flowing again, so the lookup that was running is done. Returns
// whether anything changed, since the caller may need a full re-render.
function clearAssistantToolLabel() {
  if (!assistantToolLabel) return false;
  assistantToolLabel = null;
  return true;
}

function setAssistantBusy(busy) {
  assistantBusy = busy;
  const { send, status } = assistantEls();
  if (send) send.disabled = busy || !assistantHasDraft();
  if (status) {
    status.textContent = busy
      ? "Generating a reply..."
      : "Ask about anything in the dashboard";
  }
  if (busy) startThinkingWords();
  else stopThinkingWords();
  renderAssistantMessages();
}

function assistantHasDraft() {
  const { input } = assistantEls();
  return Boolean(input && input.value.trim());
}

// Append to the reply currently being streamed, creating it on the first token.
function appendAssistantToken(text, forceRender) {
  const last = assistantMessages[assistantMessages.length - 1];
  assistantLastTokenAt = Date.now();
  if (assistantStreaming && last && last.role === "ai") {
    last.text += text;
    // Patch the one span rather than re-rendering the whole log on every
    // token — a long reply would otherwise rebuild the DOM hundreds of times.
    // A full render is only needed when the activity line has to come off —
    // either a lookup just finished, or the "gone quiet" line is showing. That
    // is one rebuild per pause, not one per token.
    const needsFullRender =
      forceRender || Boolean(document.querySelector(".assistant-thinking"));
    const liveText = needsFullRender
      ? null
      : document.getElementById("assistantLiveText");
    if (liveText) {
      liveText.textContent = last.text;
      const { list } = assistantEls();
      if (list) list.scrollTop = list.scrollHeight;
      return;
    }
  } else {
    assistantStreaming = true;
    assistantMessages.push({ role: "ai", text: text, at: new Date() });
  }
  renderAssistantMessages();
}

// One turn, streamed. Resolves when the turn is done; throws if the request
// fails before the stream starts (the caller renders that as a failed message).
function streamAssistantTurn(text) {
  let sawError = false;
  let sawToken = false;

  return api
    .assistantStream(
      {
        message: text,
        conversation_id: assistantConversationId,
        // Where the admin asked from, so the assistant can resolve "these
        // bookings" without being told.
        page:
          typeof currentDashboardPage !== "undefined"
            ? currentDashboardPage
            : null,
      },
      {
        meta: (payload) => {
          if (payload.conversation_id) {
            assistantConversationId = payload.conversation_id;
          }
        },
        tool: (payload) => setAssistantToolLabel(payload.name),
        token: (payload) => {
          if (!payload.text) return;
          sawToken = true;
          // Text means the lookup that was running has finished. Dropping the
          // label takes the activity line off, so re-render rather than
          // patching the live span in place.
          const hadTool = clearAssistantToolLabel();
          appendAssistantToken(payload.text, hadTool);
        },
        error: (payload) => {
          sawError = true;
          setAssistantBusy(false);
          assistantStreaming = false;
          pushAssistantMessage(
            "ai",
            payload.detail || "The assistant could not answer that.",
            { error: true },
          );
        },
        done: (payload) => {
          setAssistantBusy(false);
          assistantStreaming = false;
          if (payload && payload.conversation_id) {
            assistantConversationId = payload.conversation_id;
          }
          // Lookups the role refused. Not an error: the reply still stands.
          const refused = (payload && payload.out_of_scope) || [];
          const last = assistantMessages[assistantMessages.length - 1];
          if (refused.length && last && last.role === "ai" && !last.error) {
            last.outOfScope = true;
          }
          renderAssistantMessages();
        },
      },
    )
    .then(() => {
      // A stream that ends without a `done` frame — a dropped connection, a
      // proxy timing out — must not leave the panel thinking forever.
      if (assistantBusy) setAssistantBusy(false);
      assistantStreaming = false;
      if (!sawToken && !sawError) {
        pushAssistantMessage(
          "ai",
          "The connection to the assistant ended before it answered. Try again.",
          { error: true },
        );
      }
      return sawError;
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
    await streamAssistantTurn(text);
  } catch (error) {
    // 409 = the thread can no longer be continued (the admin's role changed, or
    // it was closed). Start a fresh thread and try the same question once.
    if (error && error.status === 409 && assistantConversationId) {
      assistantConversationId = null;
      try {
        setAssistantBusy(true);
        await streamAssistantTurn(text);
        return;
      } catch (retryError) {
        error = retryError;
      }
    }
    setAssistantBusy(false);
    assistantStreaming = false;
    pushAssistantMessage(
      "ai",
      (error && error.message) ||
        "Something went wrong reaching the assistant.",
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
  const { fab, close, scrim, form, input, send, footnote } = assistantEls();
  if (!fab || !form || !input) return;

  if (footnote) {
    footnote.textContent =
      "The assistant can be wrong. Check anything important against the data.";
  }

  fab.addEventListener("click", toggleAssistant);
  if (close) close.addEventListener("click", closeAssistant);
  // Clicking anywhere outside the panel dismisses it.
  if (scrim) scrim.addEventListener("click", closeAssistant);
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
