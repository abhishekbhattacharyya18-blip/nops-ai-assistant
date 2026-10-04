import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit}
      className="relative flex items-end gap-2 bg-navy-800 border border-navy-700 rounded-2xl p-2 shadow-lg focus-within:ring-1 focus-within:ring-cyan-500/50 focus-within:border-cyan-500/50 transition-all"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Query acoustic models, oceanographic data, or NOPS roadmap..."
        className="w-full max-h-[150px] bg-transparent text-slate-100 placeholder-slate-500 resize-none outline-none py-2 px-3 text-sm md:text-base"
        rows={1}
        disabled={isLoading}
      />
      <button
        type="submit"
        disabled={!input.trim() || isLoading}
        className={`flex-shrink-0 p-3 rounded-xl flex items-center justify-center transition-colors ${
          input.trim() && !isLoading
            ? 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-md shadow-cyan-900/50'
            : 'bg-navy-900 text-slate-600 cursor-not-allowed'
        }`}
        aria-label="Send message"
      >
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Send size={20} className={input.trim() ? 'translate-x-0.5' : ''} />
        )}
      </button>
    </form>
  );
};