import { FormEvent, useRef, useState } from 'react';
import { Sparkles, Send, Bot, User as UserIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Which candidates have been waiting the longest?',
  'What is currently blocked or at risk?',
  'Summarize the sales pipeline right now',
  'What is overdue across all workflows?',
];

// AI chatbot that answers natural-language questions about live operational data, backed by a
// real database snapshot on every question (never hallucinated), e.g. "Which candidates have
// been waiting the longest?"
export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: "Ask me anything about your workflows, I read the live data before answering." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', { question });
      setMessages((m) => [...m, { role: 'assistant', text: res.data.answer }]);
    } catch (e: any) {
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
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles size={18} className="text-brand-500" /> AI Operations Assistant
        </h1>
        <p className="text-sm text-slate-500">Ask questions about candidates, deals, tasks, and risk, in plain English.</p>
      </div>

      <div className="flex-1 overflow-y-auto card p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="h-7 w-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
            )}
            <div
              className={`rounded-xl px-3.5 py-2.5 text-sm max-w-[80%] whitespace-pre-wrap leading-relaxed ${
                m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {m.text}
            </div>
            {m.role === 'user' && (
              <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                <UserIcon size={14} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="h-7 w-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <Bot size={14} />
            </div>
            <div className="rounded-xl px-3.5 py-2.5 text-sm bg-slate-100 text-slate-400">Reading live data and thinking...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="text-xs rounded-full border border-slate-200 px-3 py-1.5 hover:bg-slate-50" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2 mt-3">
        <input
          className="input"
          placeholder="Ask about your operations..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
