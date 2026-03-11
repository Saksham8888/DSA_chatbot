const SYSTEM_PROMPT = `You are a Data Structure and Algorithm Instructor. You will only reply to questions related to Data Structures and Algorithms.
If the user asks anything NOT related to DSA, reply very rudely and dismissively.Be very rude.
If the question is about DSA, reply politely and helpfully with simple explanations. Use code snippets when helpful.`;

let conversationHistory = [];
let apiKey = localStorage.getItem("Enter your groq api") || "";
let isLoading = false;

if (apiKey) document.getElementById("apiModal").style.display = "none";

function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) return;
  apiKey = key;
  localStorage.setItem("groq_api_key", key);
  document.getElementById("apiModal").style.display = "none";
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function useSuggestion(btn) {
  document.getElementById("userInput").value = btn.textContent;
  sendMessage();
}

function getTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessage(text) {
  text = text.replace(
    /```(\w+)?\n?([\s\S]*?)```/g,
    (_, lang, code) => `<pre><code>${escapeHtml(code.trim())}</code></pre>`,
  );
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\n/g, "<br>");
  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isRude(text) {
  return [
    "dumb",
    "nonsense",
    "irrelevant",
    "wasting my time",
    "serious?",
    "stop",
  ].some((p) => text.toLowerCase().includes(p));
}

function appendMessage(role, content) {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();
  const messages = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `message ${role}`;
  if (role === "bot" && isRude(content)) div.classList.add("rude");
  const avatar = role === "user" ? "👤" : "🧠";
  const bubbleContent =
    role === "bot" ? formatMessage(content) : escapeHtml(content);
  div.innerHTML = `
    <div class="avatar">${avatar}</div>
    <div>
      <div class="bubble">${bubbleContent}</div>
      <div class="timestamp">${getTime()}</div>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function showTyping() {
  const messages = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = "typing-indicator";
  div.id = "typing";
  div.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#00ff88,#00ccff)">🧠</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;
  if (!apiKey) {
    document.getElementById("apiModal").style.display = "flex";
    return;
  }

  input.value = "";
  input.style.height = "auto";
  isLoading = true;
  document.getElementById("sendBtn").disabled = true;

  appendMessage("user", text);
  conversationHistory.push({ role: "user", content: text });
  showTyping();

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...conversationHistory,
          ],
          stream: true,
        }),
      },
    );

    removeTyping();
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "API Error");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    const welcome = document.getElementById("welcome");
    if (welcome) welcome.remove();
    const messages = document.getElementById("messages");
    const msgDiv = document.createElement("div");
    msgDiv.className = "message bot";
    msgDiv.innerHTML = `<div class="avatar" style="background:linear-gradient(135deg,#00ff88,#00ccff)">🧠</div><div><div class="bubble" id="stream-bubble"></div><div class="timestamp">${getTime()}</div></div>`;
    messages.appendChild(msgDiv);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
        try {
          const json = JSON.parse(line.slice(6));
          const delta = json.choices[0]?.delta?.content || "";
          fullText += delta;
          const bubble = document.getElementById("stream-bubble");
          if (bubble) {
            bubble.innerHTML = formatMessage(fullText);
            if (isRude(fullText)) msgDiv.classList.add("rude");
          }
        } catch {}
      }
      messages.scrollTop = messages.scrollHeight;
    }

    document.getElementById("stream-bubble")?.removeAttribute("id");
    conversationHistory.push({ role: "assistant", content: fullText });
  } catch (err) {
    removeTyping();
    appendMessage("bot", `⚠️ Error: ${err.message}`);
  }

  isLoading = false;
  document.getElementById("sendBtn").disabled = false;
  input.focus();
}

function clearChat() {
  conversationHistory = [];
  document.getElementById("messages").innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-icon">⚡</div>
      <h2>Ask me anything DSA</h2>
      <p>Your personal DSA tutor — arrays, trees, graphs, sorting, DP and more!</p>
      <div class="suggestions">
        <button class="suggestion" onclick="useSuggestion(this)">What is a Binary Search Tree?</button>
        <button class="suggestion" onclick="useSuggestion(this)">Explain Quick Sort</button>
        <button class="suggestion" onclick="useSuggestion(this)">How does Dijkstra work?</button>
        <button class="suggestion" onclick="useSuggestion(this)">What is Dynamic Programming?</button>
        <button class="suggestion" onclick="useSuggestion(this)">Explain Big O Notation</button>
      </div>
    </div>`;
}

document.getElementById("apiKeyInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveApiKey();
});
document.getElementById("userInput").focus();
