import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface PlotGuessEvaluation {
  is_correct: boolean;
  accuracy: number;
  time: string;
  explanation: string;
  confidence: number;
}

const OMDB_API_KEY = '1eee483'; 

function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [seriesInput, setSeriesInput] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [seriesSuggestions, setSeriesSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [response, setResponse] = useState<PlotGuessEvaluation | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Scroll to top when a new guess is made
    if (currentGuess) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentGuess]);

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
    
    setCurrentGuess(input.trim());
    setLoading(true);
    setInput('');
    setResponse(null);
    setRevealedCards(new Set());
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '2.5em';
    }
    
    // Call backend API
    try {
      const res = await fetch('http://localhost:8000/api/guess-ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: currentGuess || input.trim(), tv_show_name: selectedSeries })
      });
      const data = await res.json();
      console.log('AI response:', data);
      setResponse(data.response);
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
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

  const handleCardClick = (cardKey: string) => {
    setRevealedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardKey)) {
        newSet.delete(cardKey);
      } else {
        newSet.add(cardKey);
      }
      return newSet;
    });
  };

  const getCardInfo = (key: keyof PlotGuessEvaluation) => {
    const cardInfoMap = {
      is_correct: { title: 'Correctness', icon: '✓' },
      accuracy: { title: 'Accuracy Score', icon: '🎯' },
      time: { title: 'Time Period', icon: '📅' },
      explanation: { title: 'Explanation', icon: '💡' },
      confidence: { title: 'AI Confidence', icon: '🤖' }
    };
    return cardInfoMap[key];
  };

  const formatCardValue = (key: keyof PlotGuessEvaluation, value: any) => {
    switch (key) {
      case 'is_correct':
        return value ? 'Correct! 🎉' : 'Incorrect ❌';
      case 'accuracy':
        return `${Math.round(value * 100)}%`;
      case 'confidence':
        return `${Math.round(value * 100)}%`;
      default:
        return value?.toString() || '';
    }
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
        {/* Display current guess */}
        {currentGuess && (
          <div className="current-guess">
            <h2>Your Guess:</h2>
            <p>"{currentGuess}"</p>
          </div>
        )}

        {/* Loading indicator */}
        {loading && (
          <div className="loading-container">
            <p>Analyzing your guess...</p>
          </div>
        )}

        {/* Response cards */}
        {response && !loading && (
          <div className="response-cards">
            <div className="results-header">
              <h3>Results</h3>
              {response.confidence && (
                <span className="confidence-indicator">
                  AI Confidence: {Math.round(response.confidence * 100)}%
                </span>
              )}
            </div>
            <div className="cards-grid">
              {(Object.keys(response) as Array<keyof PlotGuessEvaluation>)
                .filter(key => key !== 'confidence') // Exclude confidence from cards
                .map((key) => {
                const cardInfo = getCardInfo(key);
                const isRevealed = revealedCards.has(key);
                return (
                  <div
                    key={key}
                    className={`result-card ${isRevealed ? 'revealed' : 'hidden'}`}
                    onClick={() => handleCardClick(key)}
                  >
                    <div className="card-header">
                      <span className="card-icon">{cardInfo.icon}</span>
                      <span className="card-title">{cardInfo.title}</span>
                    </div>
                    <div className="card-content">
                      {isRevealed ? (
                        <span className="card-value">
                          {formatCardValue(key, response[key])}
                        </span>
                      ) : (
                        <span className="card-placeholder">Click to reveal</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
