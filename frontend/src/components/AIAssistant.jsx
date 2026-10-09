import { useState } from "react";
import { aiAssistantApi, getErrorMessage } from "../services/api.js";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm your Scholarwise AI assistant. Ask me what to study, how to prepare for an exam, or anything about your study plan.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const message = input.trim();

    if (!message || loading) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const data = await aiAssistantApi.chat(message);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data.reply ||
            data.detail ||
            "I couldn't generate a response right now.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: getErrorMessage(
            error,
            "Something went wrong while contacting the AI assistant."
          ),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-assistant">
      <div className="ai-assistant-header">
        <div>
          <h2>🤖 Scholarwise AI</h2>
          <p>Your personal study assistant</p>
        </div>
      </div>

      <div className="ai-chat">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`ai-message ${message.role}`}
          >
            {message.content}
          </div>
        ))}

        {loading && (
          <div className="ai-message assistant">
            Thinking...
          </div>
        )}
      </div>

      <form className="ai-chat-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Scholarwise AI something..."
          maxLength={1000}
          disabled={loading}
        />

        <button
          type="submit"
          className="button primary"
          disabled={loading || !input.trim()}
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}