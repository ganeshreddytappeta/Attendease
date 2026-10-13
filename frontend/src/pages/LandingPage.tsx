import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, Download, CheckCircle2,
  Clock, ArrowRight, Lock, ChevronDown, ChevronUp,
  FileText, MessageSquareText, Bot, RotateCcw, ArrowUp, Code2
} from 'lucide-react';
import './landing.css';
import logoImg from '../assets/logo.png';
import { sendChatMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FAQS = [
  {
    question: "How do students apply for duty-leave / permissions?",
    answer: "Students can log in to the Student Portal, click 'New Permission Request', select their date, time slot/periods, reason category, and upload proof documents. Once submitted, it forwards to their assigned Faculty Advisor."
  },
  {
    question: "How does Faculty mark attendance?",
    answer: "Faculty members log in, select the Year and Target Section (e.g. CSIT-B), select the specific period (P1 to P8), and tap student roll numbers to mark Present/Absent. Approved permissions automatically highlight in yellow."
  },
  {
    question: "What is the HOD Direct Exemption feature?",
    answer: "HODs can grant bulk attendance exemptions to multiple students directly for academic events, hackathons, sports, or official college duties without requiring individual student submissions."
  },
  {
    question: "How can I export attendance to WhatsApp?",
    answer: "On the Public Permissions & Attendance page, tap 'Share to WhatsApp' or 'WhatsApp Report' to automatically format sorted presentees and absentees lists with Date and Time, ready to paste directly into official WhatsApp groups."
  }
];

export default function LandingPage() {
  const { user, isAuthenticated } = useAuth();
  const dashboardPath = user
    ? (user.role === 'admin' ? '/admin' : user.role === 'hod' ? '/hod' : user.role === 'faculty' ? '/faculty' : '/student')
    : '/student';

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '👋 Hi! I am the AttendEase AI Support Assistant powered by LLM. Ask me anything about student permissions, faculty attendance, or portal features!' }
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [isLoadingMsg, setIsLoadingMsg] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatOpen) {
      scrollToBottom();
    }
  }, [messages, isLoadingMsg, isChatOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMsg).trim();
    if (!query || isLoadingMsg) return;

    const userMessage: ChatMessage = { role: 'user', content: query };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    if (!textToSend) setInputMsg('');
    setIsLoadingMsg(true);

    try {
      const data = await sendChatMessage(updatedMessages);
      const replyText = data.reply || 'Thank you for reaching out! How else can I assist you?';
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      console.error('Chat request error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to connect to AttendEase AI Assistant right now. Please try again in a moment.' }]);
    } finally {
      setIsLoadingMsg(false);
    }
  };

  return (
    <div className={`landing-layout-root flex w-full min-h-screen relative overflow-x-hidden transition-colors duration-300 ${isChatOpen ? 'bg-slate-100/80' : 'bg-white'
      }`}>
      {/* ── Left / Main Content Container (Rounded Corners when AI Chat is open) ── */}
      <main
        className={`landing-main-canvas flex-1 min-w-0 bg-white transition-all duration-300 ease-in-out ${isChatOpen
          ? 'lg:my-2.5 lg:ml-2.5 lg:mr-[410px] xl:mr-[450px] lg:rounded-3xl lg:border lg:border-slate-200/90 lg:shadow-xl overflow-hidden'
          : 'mr-0 rounded-none border-none shadow-none'
          }`}
      >
        {/* ── Top Navigation Bar ── */}
        <nav className={`landing-nav ${isChatOpen ? 'lg:rounded-t-3xl' : ''}`}>
          <div className="landing-container landing-nav-inner">
            <Link to={isAuthenticated && user ? dashboardPath : "/"} className="landing-nav-logo">
              <img
                src={logoImg}
                alt="AttendEase Logo"
                className="landing-nav-logo-img"
              />
              <span className="landing-nav-brand">AttendEase</span>
            </Link>
            <div className="landing-nav-links">
              <Link to="/permissions" className="landing-btn landing-btn-secondary">
                View Attendance
              </Link>
              {isAuthenticated && user ? (
                <Link to={dashboardPath} className="landing-btn landing-btn-primary">
                  Dashboard
                </Link>
              ) : (
                <Link to="/login" className="landing-btn landing-btn-primary">
                  Login
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* ── Hero Section ── */}
        <header className="landing-hero landing-container">
          <img
            src={logoImg}
            alt="Attend Ease Emblem"
            className="landing-hero-logo"
          />
          <div>
            <span className="landing-hero-badge">Designed for Modern Classrooms</span>
          </div>
          <h1 className="landing-hero-title landing-display-font">
            Attend Ease.<br />
            <span className="text-orange-500 font-extrabold">Smart Attendance System.</span>
          </h1>
          <p className="landing-hero-sub">
            A modern attendance &amp; permission management system built for SRKR Engineering College. Track, manage, and export attendance effortlessly.
          </p>
          <div className="landing-hero-ctas">
            {isAuthenticated && user ? (
              <Link to={dashboardPath} className="landing-btn landing-btn-primary">
                <span>Go to Dashboard</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link to="/login" className="landing-btn landing-btn-primary">
                <span>Sign In to Portal</span>
                <ArrowRight size={16} />
              </Link>
            )}
            <Link to="/permissions" className="landing-btn landing-btn-secondary">
              <span>View Public Permissions</span>
            </Link>
            <a
              href="https://github.com/gowthamkrishna27/AttendEase/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-btn border border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
            >
              <Download size={16} className="text-orange-500" />
              <span>Download Android App</span>
            </a>
          </div>
        </header>

        {/* ── Screenshots Marquee ── */}
        <section className="landing-marquee-wrapper">
          <div className="landing-container mb-6 text-center">
            <span className="text-[12px] font-extrabold text-orange-600 uppercase tracking-widest block mb-1">Interactive Interface</span>
            <h2 className="text-[28px] font-extrabold text-slate-900 landing-display-font">Built For Everyday Workflow</h2>
          </div>
          <div className="landing-marquee-container">
            {[
              { title: "Dashboard Overview", src: "https://res.cloudinary.com/q40pqnho/image/upload/v1786111774/WhatsApp_Image_2026-08-07_at_7.31.38_PM_fs2vcw.jpg" },
              { title: "Student Portal", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-001007_rtfv3g.png" },
              { title: "Faculty Attendance", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-000150_yd6g1x.png" },
              { title: "HOD Dashboard", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-000004_mojjji.png" },
              { title: "Permissions Grid", src: "https://res.cloudinary.com/q40pqnho/image/upload/v1786111849/WhatsApp_Image_2026-08-07_at_7.31.50_PM_1_kxqwb6.jpg" },
              // Repeat for smooth loop
              { title: "Dashboard Overview", src: "https://res.cloudinary.com/q40pqnho/image/upload/v1786111774/WhatsApp_Image_2026-08-07_at_7.31.38_PM_fs2vcw.jpg" },
              { title: "Student Portal", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-001007_rtfv3g.png" },
              { title: "Faculty Attendance", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-000150_yd6g1x.png" },
              { title: "HOD Dashboard", src: "https://res.cloudinary.com/ucckdidb/image/upload/v1787078511/Screenshot_20260819-000004_mojjji.png" },
              { title: "Permissions Grid", src: "https://res.cloudinary.com/q40pqnho/image/upload/v1786111849/WhatsApp_Image_2026-08-07_at_7.31.50_PM_1_kxqwb6.jpg" },
            ].map((item, idx) => (
              <div key={idx} className="text-center shrink-0">
                <img src={item.src} alt={item.title} className="landing-phone-mockup" />
                <p className="text-[12px] font-bold text-slate-500 mt-2">{item.title}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature Grid ── */}
        <section className="landing-features-section">
          <div className="landing-container">
            <h2 className="landing-section-title landing-display-font">Key Features</h2>
            <p className="landing-section-sub">Engineered specifically for SRKR Engineering College departmental workflows.</p>

            <div className="landing-features-grid">
              <div className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Lock size={24} className="text-orange-500" />
                </div>
                <h3 className="landing-feature-title landing-display-font">Flexible Login &amp; Security</h3>
                <p className="landing-feature-desc">Sign in with password, 4-digit PIN code, or registered biometric passkeys (Touch ID, Face ID, Windows Hello).</p>
              </div>

              <div className="landing-feature-card">
                <div className="landing-feature-icon">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <h3 className="landing-feature-title landing-display-font">Instant Permission Sync</h3>
                <p className="landing-feature-desc">Approved duty-leave requests auto-highlight students in yellow across faculty attendance and public permission pages.</p>
              </div>

              <div className="landing-feature-card">
                <div className="landing-feature-icon">
                  <Clock size={24} className="text-amber-500" />
                </div>
                <h3 className="landing-feature-title landing-display-font">Period-Wise Selection</h3>
                <p className="landing-feature-desc">Multi-period selection (P1-P8) allows faculty and representatives to inspect specific periods or combined session attendance.</p>
              </div>

              <div className="landing-feature-card">
                <div className="landing-feature-icon">
                  <FileText size={24} className="text-emerald-600" />
                </div>
                <h3 className="landing-feature-title landing-display-font">WhatsApp Formatting</h3>
                <p className="landing-feature-desc">Format presentees and absentees automatically with Date and Time stamp, ready to share directly into WhatsApp groups.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ Accordion Section ── */}
        <section className="py-16 bg-slate-50 border-t border-slate-200/80">
          <div className="landing-container max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-[12px] font-extrabold text-orange-600 uppercase tracking-wider block mb-1">Help &amp; Answers</span>
              <h2 className="text-[28px] font-bold text-slate-900 landing-display-font">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-3">
              {FAQS.map((faq, idx) => (
                <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                  <button
                    onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                    className="w-full px-5 py-4 text-left font-bold text-[14px] text-slate-900 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.question}</span>
                    {activeFaq === idx ? <ChevronUp size={18} className="text-orange-500" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </button>
                  <AnimatePresence>
                    {activeFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-4 text-[13px] text-slate-600 leading-relaxed border-t border-slate-100 pt-3"
                      >
                        {faq.answer}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Landing Page Footer ── */}
        <footer className="py-8 bg-white border-t border-slate-200/80">
          <div className="landing-container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <img src={logoImg} alt="AttendEase" className="w-5 h-5 rounded-md object-contain" />
              <span className="font-bold text-slate-800">AttendEase</span>
              <span>•</span>
              <span>SRKR Engineering College</span>
            </div>

            <div className="flex items-center gap-5 font-medium">
              <Link to="/developers" className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1">
                <Code2 size={13} />
                <span>Meet The Developers</span>
              </Link>
              <Link to="/permissions" className="hover:text-slate-900 transition-colors">
                Public Attendance
              </Link>
              <Link to={isAuthenticated && user ? dashboardPath : "/login"} className="hover:text-slate-900 transition-colors">
                {isAuthenticated && user ? 'Dashboard' : 'Portal Login'}
              </Link>
              <a
                href="https://github.com/gowthamkrishna27/AttendEase"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* ── Floating Chatbot Trigger (Visible when panel is closed) ── */}
      {!isChatOpen && (
        <div className="landing-chat-fab">
          <button
            onClick={() => setIsChatOpen(true)}
            className="landing-fab-btn"
            title="Open AttendEase AI Chat"
          >
            <div className="relative flex items-center justify-center">
              <MessageSquareText size={24} />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ── AI Chat Panel (Floating on mobile & Docked Split-Screen on Desktop) ── */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.aside
            initial={{ y: 20, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            className="fixed bottom-3.5 left-3.5 right-3.5 sm:left-auto sm:right-3.5 sm:bottom-3.5 sm:top-auto lg:top-3 lg:bottom-3 lg:right-3 w-auto sm:w-[390px] xl:w-[430px] h-[520px] max-h-[82vh] lg:h-[calc(100vh-24px)] lg:max-h-none z-50 bg-white border border-orange-200/90 shadow-2xl rounded-3xl flex flex-col justify-between overflow-hidden"
          >
            {/* Header: Clean 'AI Chat' Title with Curved Corners */}
            <div className="px-5 py-3.5 bg-white border-b border-orange-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-[18px] text-slate-900 tracking-tight">AI Chat</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMessages([{ role: 'assistant', content: '👋 Hi! I am the AttendEase AI Support Assistant powered by LLM. Ask me anything about student permissions, faculty attendance, or portal features!' }])}
                  className="w-8 h-8 rounded-full hover:bg-orange-50 text-slate-400 hover:text-orange-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-orange-50 text-slate-400 hover:text-orange-600 flex items-center justify-center transition-colors cursor-pointer"
                  title="Close AI Chat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-white via-orange-50/20 to-white text-[13px]">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 mr-2 mt-1 shadow-2xs">
                      <Bot size={15} />
                    </div>
                  )}
                  <div
                    style={{
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)' : '#FFFFFF',
                      border: msg.role === 'user' ? 'none' : '1px solid #FED7AA',
                      color: msg.role === 'user' ? '#FFFFFF' : '#1E293B',
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(249, 115, 22, 0.25)' : '0 2px 8px rgba(249, 115, 22, 0.04)',
                    }}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${msg.role === 'user' ? 'rounded-tr-xs font-medium' : 'rounded-tl-xs'
                      }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoadingMsg && (
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0 mt-1">
                    <Sparkles size={14} className="animate-spin" />
                  </div>
                  <div className="bg-white border border-orange-200 text-orange-950 rounded-2xl rounded-tl-xs px-4 py-2.5 text-[12px] flex items-center gap-2 shadow-2xs">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                    <span className="font-semibold text-orange-800">Thinking with AttendEase LLM...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion Chips */}
            <div className="px-4 py-2 bg-white/95 border-t border-orange-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11.5px]">
              {["How to request permission?", "WhatsApp Format?", "HOD Exemption?", "Period selection P1-P8"].map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(sug)}
                  className="px-3 py-1.5 rounded-full bg-orange-50/80 hover:bg-orange-500 hover:text-white text-orange-800 border border-orange-200/80 whitespace-nowrap transition-all shrink-0 font-medium shadow-2xs cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>

            {/* Bottom Input Area */}
            <div className="p-3.5 bg-white border-t border-orange-100 shrink-0">
              <div className="bg-slate-50 hover:bg-white focus-within:bg-white border border-orange-200 focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/15 rounded-2xl p-2 transition-all shadow-2xs flex items-center gap-2">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask anything about permissions, attendance, login..."
                  className="flex-1 bg-transparent text-[13px] text-slate-800 placeholder-slate-400 outline-none px-2"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoadingMsg || !inputMsg.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
                  }}
                  className="w-8 h-8 rounded-xl text-white flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-40 transition-all active:scale-95 shrink-0"
                >
                  <ArrowUp size={16} />
                </button>
              </div>
              <p className="text-[10.5px] text-slate-400 text-center mt-1.5">
                Grounded on SRKR Engineering College attendance rules.
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
