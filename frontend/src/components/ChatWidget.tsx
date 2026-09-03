import { FormEvent, useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Bot, User as UserIcon, X, MessageCircle, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import type { Department } from '../types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

// Suggested questions the AI can genuinely answer, tailored to what each department's data
// actually contains. Two general/company ones are always shown too, since general knowledge is
// available to everyone regardless of department.
const DEPARTMENT_SUGGESTIONS: Record<Department, string[]> = {
  ALL: [
    'Which candidates have been waiting the longest?',
    'What is currently blocked or at risk across the whole company?',
    'Summarize the sales pipeline right now',
    'What is overdue this week across every workflow?',
  ],
  RECRUITMENT: [
    'Which candidates have been waiting the longest?',
    'Who is stuck in the Interview stage?',
    'Which candidates are overdue for a decision?',
    'Summarize where every open candidate stands',
  ],
  SALES: [
    'Which deals are closing soonest?',
    'What is the highest-value deal in the pipeline?',
    'Which leads have gone quiet?',
    'Summarize the sales pipeline right now',
  ],
  INTERNAL_TASKS: [
    'What tasks are overdue?',
    'What is currently in Review or Testing?',
    'Who has the most tasks assigned right now?',
    'What is blocking the team this week?',
  ],
  CLIENT_PROJECTS: [
    'Which client projects are closest to their deadline?',
    'What is the status of the Globex ERP Integration?',
    'Which projects are still in Planning or Kickoff?',
    'Summarize project delivery risk right now',
  ],
  PROCUREMENT: [
    'What purchase requests are still waiting on approval?',
    'What has been ordered but not received yet?',
    'What is the total estimated cost of open requests?',
    'What was rejected recently and why?',
  ],
};

const GENERAL_SUGGESTIONS = ['What services does DigitalSofts offer?', 'Who is the CEO of DigitalSofts?'];

const DEPARTMENT_LABEL: Record<Department, string> = {
  ALL: 'All departments',
  RECRUITMENT: 'Recruitment only',
  SALES: 'Sales only',
  INTERNAL_TASKS: 'Internal Tasks only',
  CLIENT_PROJECTS: 'Client Projects only',
  PROCUREMENT: 'Procurement only',
};

const WELCOME: ChatMessage = { role: 'assistant', text: "Ask me anything about your workflows, I read the live data before answering." };

// Floating AI chatbot bubble, present on every page (mounted once in Layout so it survives
// navigation). Click the bubble to open the panel; it answers questions about live operational
// data, e.g. "Which candidates have been waiting the longest?"
export default function ChatWidget() {
  const department = useAuth((s) => s.user?.department) || 'ALL';
  const suggestions = [...DEPARTMENT_SUGGESTIONS[department], ...GENERAL_SUGGESTIONS];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    // Send the last few turns of this open chat so follow-ups like "what about the second one"
    // actually work, this only lives in the browser tab, it resets on refresh, it's not saved.
    const history = messages
      .filter((m) => m !== WELCOME)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { question, history });
      setMessages((m) => [...m, { role: 'assistant', text: res.data.answer }]);
      if (!open) setUnread(true);
    } catch {
      toast.error('Chat failed');
      setMessages((m) => [...m, { role: 'assistant', text: 'Sorry, I could not process that question.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end">
      {open && (
        <div className="mb-3 w-[380px] max-w-[calc(100vw-2.5rem)] h-[520px] max-h-[calc(100vh-8rem)] card shadow-2xl flex flex-col overflow-hidden chat-widget-enter">
          {/* Header */}
          <div className="bg-brand-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <div>
                <div className="text-sm font-semibold leading-tight">AI Operations Assistant</div>
                <div className="text-[11px] text-brand-100 leading-tight flex items-center gap-1">
                  <Lock size={9} /> Access: {DEPARTMENT_LABEL[department]} + company info
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-brand-100 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-xs max-w-[78%] whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 border border-slate-100'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    <UserIcon size={12} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <Bot size={12} />
                </div>
                <div className="rounded-xl px-3 py-2 text-xs bg-white border border-slate-100 text-slate-400">Reading live data...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only before the first real question) */}
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-slate-100 shrink-0">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="text-[11px] rounded-full border border-slate-200 px-2.5 py-1 hover:bg-slate-50"
                  onClick={() => ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={onSubmit} className="flex gap-2 p-2.5 border-t border-slate-100 shrink-0">
            <input
              ref={inputRef}
              className="input text-sm"
              placeholder="Ask about your operations..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn-primary px-3" disabled={loading || !input.trim()}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* Floating bubble */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-14 w-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
        title="AI Operations Assistant"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread && <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-white" />}
      </button>
    </div>
  );
}
