import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface PlotGuessEvaluation {
  is_correct: boolean;
  accuracy: number;
  time: string;
  explanation: string;
  confidence: number;
}

const GuessPage: React.FC = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [seriesInput, setSeriesInput] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [seriesSuggestions, setSeriesSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const seriesInputRef = useRef<HTMLInputElement | null>(null);
  const [currentGuess, setCurrentGuess] = useState<string>('');
  const [response, setResponse] = useState<PlotGuessEvaluation | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentGuess) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentGuess]);

  useEffect(() => {
    // Focus on series input when component mounts or when series is cleared
    if (!selectedSeries && seriesInputRef.current) {
      seriesInputRef.current.focus();
    }
  }, [selectedSeries]);

  const fetchSeriesSuggestions = (query: string) => {
    if (!query.trim()) {
      setSeriesSuggestions([]);
      return;
    }
    fetch(`https://www.omdbapi.com/?apikey=${process.env.REACT_APP_OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=series`)
      .then(res => res.json())
      .then(data => {
        if (data && data.Search) {
          const uniqueTitles = Array.from(new Set(data.Search.map((item: any) => item.Title))) as string[];
          if (uniqueTitles.length < 2 && !uniqueTitles.includes(query.trim())) {
            setSeriesSuggestions(uniqueTitles.concat(["Use \""+query.trim()+"\""])); // Include the query if not enough suggestions
          }else{
            setSeriesSuggestions(uniqueTitles.slice(0, 5));
          }
        } else {
          setSeriesSuggestions(["Use \""+query.trim()+"\""]);
        }
      })
      .catch(() => setSeriesSuggestions([]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!selectedSeries) {
      alert('Please select a TV series first.');
      return;
    }
    const newGuess = input.trim();
    setCurrentGuess(newGuess);
    setLoading(true);
    setInput('');
    setResponse(null);
    setRevealedCards(new Set());

    if (textareaRef.current) {
      textareaRef.current.style.height = '2.5em';
    }

    try {
      const res = await fetch(process.env.REACT_APP_API_URL || 'http://localhost:8000/evaluate-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: newGuess, tv_show_name: selectedSeries })
      });
      const data = await res.json();
      setResponse(data as PlotGuessEvaluation);
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
      if (newSet.has(cardKey)) newSet.delete(cardKey); else newSet.add(cardKey);
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
      {selectedSeries && (
        <div onClick={() => {setSelectedSeries('');setSeriesInput('');setCurrentGuess('');setResponse(null)}} className="top-series-bar">
          <span className="series-title">
            Guess the Plot: {selectedSeries}
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="reload-icon bi bi-arrow-clockwise" viewBox="0 0 16 16" strokeWidth="0.5" stroke="currentColor">
              <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
              <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
            </svg>
          </span>
        </div>
      )}
      <header className="App-header">
        {!selectedSeries && <h1>Guess the Plot</h1>}
        {!selectedSeries && (
          <div className="series-picker">
            <label htmlFor="series-input">Pick a TV Series:</label>
            <input
              ref={seriesInputRef}
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
          </div>
        )}
      </header>
      <main>
        {currentGuess && (
          <div className="current-guess">
            <h2>Your Guess:</h2>
            <p>"{currentGuess}"</p>
          </div>
        )}
        {loading && (
          <div className="loading-container">
            <p>Analyzing your guess<span className="animated-dots"></span></p>
          </div>
        )}
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
                .filter(key => key !== 'confidence')
                .filter(key => (key === 'time' ? response.time !== null && response.time !== '' : true))
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
                            {formatCardValue(key, (response as any)[key])}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-hourglass-split" viewBox="0 0 16 16">
              <path d="M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1zm2-13v1c0 .537.12 1.045.337 1.5h6.326c.216-.455.337-.963.337-1.5V2zm3 6.35c0 .701-.478 1.236-1.011 1.492A3.5 3.5 0 0 0 4.5 13s.866-1.299 3-1.48zm1 0v3.17c2.134.181 3 1.48 3 1.48a3.5 3.5 0 0 0-1.989-3.158C8.978 9.586 8.5 9.052 8.5 8.351z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-arrow-right" viewBox="0 0 16 16">
              <path fillRule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8"/>
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default GuessPage;
