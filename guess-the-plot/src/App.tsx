import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

const OMDB_API_KEY = '1eee483'; 

function App() {
  const [input, setInput] = useState('');
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [seriesInput, setSeriesInput] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [seriesSuggestions, setSeriesSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (chatHistoryRef.current) {
      // Scroll the chat history to the bottom
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
    // Also scroll the page to the bottom to keep the input visible if needed
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, [chat]);

  const fetchSeriesSuggestions = (query: string) => {
    if (!query.trim()) {
      setSeriesSuggestions([]);
      return;
    }
    fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=series`)
      .then(res => res.json())
      .then(data => {
        if (data && data.Search) {
          const uniqueTitles = Array.from(new Set(data.Search.map((item: any) => item.Title))) as string[];
          setSeriesSuggestions(uniqueTitles.slice(0, 5));
        } else {
          setSeriesSuggestions([]);
        }
      })
      .catch(() => setSeriesSuggestions([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMessage: ChatMessage = { sender: 'user', text: input };
    setChat(prev => [...prev, userMessage]);
    setLoading(true);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '2.5em';
    }
    // focus on the input
    const inputElement = document.querySelector('.chat-input');
    if (inputElement) {
      (inputElement as HTMLInputElement).focus();
    }
    // Call backend API
    fetch('http://localhost:5000/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage.text, series: selectedSeries })
    })
      .then(res => res.json())
      .then(data => {
        const aiMessage: ChatMessage = { sender: 'ai', text: data.response };
        setChat(prev => [...prev, aiMessage]);
        setLoading(false);
      })
      .catch(() => {
        const aiMessage: ChatMessage = { sender: 'ai', text: 'AI: (Error getting response from server)' };
        setChat(prev => [...prev, aiMessage]);
        setLoading(false);
      });
  };

  const handleSeriesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSeriesInput(value);
    setShowSuggestions(true);
    setSelectedSeries('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSeriesSuggestions(value.trim());
    }, 300);
  };

  const handleSeriesSelect = (series: string) => {
    setSeriesInput(series);
    setSelectedSeries(series);
    setShowSuggestions(false);
  };

  return (
    <div className="App">
      {/* Top bar for selected series */}
      {selectedSeries && (
        <div onClick={() => setSelectedSeries('')} className="top-series-bar">
          <span className="series-title">Guess the Plot: {selectedSeries}</span>
        </div>
      )}
      <header className="App-header">
        {/* Hide title if series is picked */}
        {!selectedSeries && <h1>Guess the Plot</h1>}
        {!selectedSeries && <div className="series-picker">
          <label htmlFor="series-input">Pick a TV Series:</label>
          <input
            id="series-input"
            type="text"
            value={seriesInput}
            onChange={handleSeriesChange}
            placeholder="Start typing a TV series..."
            className="series-input"
            autoComplete="off"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
          />
          {showSuggestions && seriesSuggestions.length > 0 && (
            <ul className="series-suggestions">
              {seriesSuggestions.map(s => (
                <li key={s} onMouseDown={() => handleSeriesSelect(s)}>{s}</li>
              ))}
            </ul>
          )}
        </div>}
      </header>
      <main>
        {/* Chat container for history only */}
        <div className="chat-container">
          <div className="chat-history" ref={chatHistoryRef}>
            {chat.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.sender}`}>
                {msg.sender === 'ai' && (
                  <span className="sender-label">AI</span>
                )}
                <span>{msg.text}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* Fixed chat form at the bottom of the page */}
      <form onSubmit={handleSubmit} className="chat-form fixed-chat-form">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your guess..."
          className="chat-input large chat-textarea"
          disabled={loading}
          autoFocus
          rows={1}
          style={{ resize: 'none', overflow: 'hidden', minHeight: '3em', maxHeight: '8em' }}
          onInput={e => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = '2.5em';
            target.style.height = Math.min(target.scrollHeight, 8 * parseFloat(getComputedStyle(target).lineHeight || '20')) + 'px';
          }}
          maxLength={1000}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
        />
        <button type="submit" className="chat-submit" disabled={loading || !input.trim()} aria-label="Send">
          {loading ? (
            <span className="arrow-loading">...</span>
          ) : (
            <span className="arrow-icon">→</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default App;
