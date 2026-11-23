import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  MessageSquare,
  RotateCcw,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import PortalLayout from '../components/PortalLayout';
import DemoNoticeBanner from '../components/DemoNoticeBanner';
import { useAuth } from '../context/AuthContext';
import {
  SUGGESTED_CHAT_QUESTIONS,
  getDemoChatbotReply,
} from '../data/demoData';
import './ChatbotPage.css';

const CHATBOT_NAV_ITEMS = [
  { id: 'chat', label: 'Campus Q&A Chat', icon: MessageSquare },
];

function getTimeLabel() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createWelcomeMessage() {
  return {
    id: 1,
    sender: 'assistant',
    text: 'Welcome to the AI-Powered Smart Campus Assistant! Ask me about college notices, upcoming events, class timetables, faculty office hours, or campus facilities. Try one of the suggested questions to preview how the chat works.',
    time: getTimeLabel(),
  };
}

function ChatbotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([createWelcomeMessage()]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: trimmed,
      time: getTimeLabel(),
    };

    const replyMsg = {
      id: Date.now() + 1,
      sender: 'assistant',
      text: getDemoChatbotReply(trimmed),
      time: getTimeLabel(),
    };

    setMessages((prev) => [...prev, userMsg, replyMsg]);
    setInputText('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleClearChat = () => {
    setMessages([createWelcomeMessage()]);
  };

  return (
    <PortalLayout
      roleLabel="Intelligent Helpdesk"
      roleName="AI Campus Assistant"
      userLabel={user?.name || 'Campus User'}
      userInitials="CU"
      pageTitle="AI Campus Assistant"
      pageSubtitle="Ask questions about notices, timetables, events, faculty, and campus facilities"
      navItems={CHATBOT_NAV_ITEMS}
      activeItem="chat"
      quickSwitch="chatbot"
    >
      <DemoNoticeBanner message="Chatbot UI preview only. Responses below are sample demo replies; Google Gemini API and verified MySQL knowledge grounding will be integrated in the AI phase." />

      <div className="chat-workspace">
        {/* Main Chat Panel */}
        <section className="chat-panel" aria-label="AI Assistant Conversation">
          <div className="chat-panel-header">
            <div className="chat-bot-identity">
              <span className="chat-bot-avatar" aria-hidden="true">
                <Bot size={20} />
              </span>
              <div>
                <div className="chat-bot-name">Smart Campus AI Assistant</div>
                <div className="chat-bot-status">
                  UI Preview Mode &bull; Gemini API Pending
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearChat}
            >
              <RotateCcw size={14} />
              <span>Reset Chat</span>
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-message-row ${msg.sender}`}
              >
                <span className="msg-avatar" aria-hidden="true">
                  {msg.sender === 'assistant' ? (
                    <Bot size={15} />
                  ) : (
                    <User size={15} />
                  )}
                </span>
                <div className="msg-bubble">
                  <div>{msg.text}</div>
                  <span className="msg-time">{msg.time}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-composer" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-input"
              placeholder="Ask about exam notices, library hours, timetables, or faculty..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              aria-label="Type your campus question"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!inputText.trim()}
            >
              <Send size={16} />
              <span>Send</span>
            </button>
          </form>
        </section>

        {/* Side Suggested Questions Panel */}
        <aside className="chat-side-panel">
          <div className="suggestions-card">
            <h2 className="suggestions-title">
              <Sparkles size={17} color="#1d5bbf" />
              <span>Suggested Questions</span>
            </h2>
            <p className="suggestions-sub">
              Click any sample question to test the conversation interface.
            </p>
            <div className="suggestions-list">
              {SUGGESTED_CHAT_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => sendMessage(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>

          <div className="ai-info-card">
            <h3>Planned Verified AI Grounding</h3>
            <p>
              In the Gemini integration phase, your questions will be answered
              by Google Gemini on the Express backend using verified data from
              the <code>campus_assistant_db_v2</code> MySQL database, and logged
              securely in <code>chatbot_logs</code>.
            </p>
          </div>
        </aside>
      </div>
    </PortalLayout>
  );
}

export default ChatbotPage;
