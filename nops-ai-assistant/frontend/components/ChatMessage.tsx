import React from 'react';
import { User, Crosshair } from 'lucide-react';
import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  // A very basic markdown parser for bold and code blocks to keep it lightweight
  const renderText = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```|\*\*.*?\*\*|`.*?`)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^[\w-]+\n/, ''); // Strip language tag if present
        return (
          <pre key={index} className="bg-navy-950 p-3 rounded-md my-2 overflow-x-auto text-sm font-mono text-cyan-300 border border-navy-800">
            <code>{code}</code>
          </pre>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={index} className="bg-navy-900 px-1.5 py-0.5 rounded text-sm font-mono text-cyan-400">{part.slice(1, -1)}</code>;
      }
      
      // Handle newlines
      return <span key={index}>{part.split('\n').map((line, i, arr) => (
        <React.Fragment key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </React.Fragment>
      ))}</span>;
    });
  };

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 shadow-lg ${
          isUser ? 'bg-cyan-700' : 'bg-navy-800 border border-cyan-500/30'
        }`}>
          {isUser ? <User size={18} className="text-white" /> : <Crosshair size={18} className="text-cyan-400" />}
        </div>

        {/* Message Bubble */}
        <div className={`px-5 py-3.5 rounded-2xl shadow-md ${
          isUser 
            ? 'bg-cyan-700 text-white rounded-tr-sm' 
            : 'bg-navy-800 text-slate-200 border border-navy-700 rounded-tl-sm'
        }`}>
          <div className="leading-relaxed whitespace-pre-wrap break-words">
            {renderText(message.text)}
          </div>
          <div className={`text-[10px] mt-2 ${isUser ? 'text-cyan-200 text-right' : 'text-slate-500 text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};