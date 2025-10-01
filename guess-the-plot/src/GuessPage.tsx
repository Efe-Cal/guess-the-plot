import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import PrivacyPolicyContent from './PrivacyPolicyContent';

interface PlotGuessEvaluation {
  is_correct: boolean;
  accuracy: number;
  time: string;
  explanation: string;
  confidence: number;
}

interface FeedbackData {
  name: string;
  email: string;
  feedback: string;
}

const API_BASE_URL = (process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/$/, '') + "/api": "http://localhost:8000");

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
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [feedbackData, setFeedbackData] = useState<FeedbackData>({
    name: '',
    email: '',
    feedback: ''
  });
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

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

  useEffect(() => {
    // Close options menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.options-menu-container')) {
        setShowOptionsMenu(false);
      }
    };

    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionsMenu]);

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
      const res = await fetch(API_BASE_URL+ '/evaluate-guess', {
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

  const handleOptionClick = (option: string) => {
    setShowOptionsMenu(false);
    if (option === 'feedback') {
      setShowFeedbackModal(true);
    } else if (option === 'privacy') {
      setShowPrivacyModal(true);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackData.feedback.trim()) {
      alert('Please provide your feedback.');
      return;
    }

    setFeedbackSubmitting(true);
    try {
      console.log(feedbackData);
      await fetch(API_BASE_URL+ '/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });

      alert('Thank you for your feedback! We appreciate it.');
      setFeedbackData({ name: '', email: '', feedback: '' });
      setShowFeedbackModal(false);
    } catch (error) {
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const handleFeedbackChange = (field: keyof FeedbackData, value: string) => {
    setFeedbackData(prev => ({ ...prev, [field]: value }));
  };

  const handleModalClose = (modalType: 'feedback' | 'privacy') => {
    if (modalType === 'feedback') {
      setShowFeedbackModal(false);
    } else {
      setShowPrivacyModal(false);
    }
  };

  const handleRevealAll = () => {
    if (response) {
      const allKeys = (Object.keys(response) as Array<keyof PlotGuessEvaluation>)
        .filter(key => key !== 'confidence')
        .filter(key => (key === 'time' ? response.time !== null && response.time !== '' : true));
      setRevealedCards(new Set(allKeys));
    }
  };

  const handleNewGuess = () => {
    setSelectedSeries('');
    setSeriesInput('');
    setCurrentGuess('');
    setResponse(null);
    setRevealedCards(new Set());
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-slate-50 group/design-root overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans', sans-serif" }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 md:px-10 lg:px-20 xl:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[1280px] flex-1">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#e7eff3] px-4 sm:px-10 py-3">
              <div className="flex items-center gap-4 text-[#0d171b]">
                <div className="size-12 rounded-full bg-gradient-to-br from-[#e0f7fa] to-[#e8f5e9] flex items-center justify-center shadow-sm">
                  {/* <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <g clipPath="url(#clip0_6_535)">
                      <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd"></path>
                    </g>
                    <defs>
                      <clipPath id="clip0_6_535">
                        <rect fill="white" height="48" width="48"></rect>
                      </clipPath>
                    </defs>
                  </svg> */}
                  <img src="/logo512.png" alt="Guess the Plot Logo" className="w-8 h-8" />
                </div>
                <h2 className="text-[#0d171b] text-xl font-bold leading-tight tracking-[-0.015em]">Guess the Plot</h2>
              </div>
              <div className="flex flex-1 justify-end gap-8">
                <div className="flex items-center gap-5">
                  <button 
                    className="text-[#0d171b] text-sm font-medium leading-normal hover:text-[#13a4ec] transition-colors cursor-pointer"
                    onClick={() => handleOptionClick('feedback')}
                  >
                    Give Feedback
                  </button>
                </div>
              </div>
            </header>
            
            <main className="flex-1 px-4 sm:px-10 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Left Column: Guess Submission */}
                <div className="flex flex-col gap-8">
                  <div className="flex flex-wrap justify-between gap-3">
                    <p className="text-[#0d171b] text-4xl font-black leading-tight tracking-[-0.033em] min-w-72">Submit Your Guess</p>
                  </div>
                  <div className="flex flex-col gap-6">
                    <label className="flex flex-col flex-1">
                      <p className="text-[#0d171b] text-base font-medium leading-normal pb-2">Select a TV Series:</p>
                      <div className="relative">
                        <input
                          ref={seriesInputRef}
                          type="text"
                          value={seriesInput}
                          onChange={handleSeriesChange}
                          placeholder="Start typing a TV series..."
                          className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d171b] focus:outline-0 focus:ring-0 border border-[#cfdfe7] bg-white focus:border-[#13a4ec] h-14 placeholder:text-[#4c809a] p-[15px] text-base font-normal leading-normal"
                          autoComplete="off"
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
                        />
                        {selectedSeries && (
                          <div className="absolute inset-0 flex items-center px-[15px] bg-white border border-[#cfdfe7] rounded-lg pointer-events-none">
                            <span className="text-[#0d171b] text-base font-normal">{selectedSeries}</span>
                          </div>
                        )}
                        {showSuggestions && seriesSuggestions.length > 0 && !selectedSeries && (
                          <ul className="absolute top-full left-0 right-0 z-10 bg-white border border-[#cfdfe7] border-t-0 rounded-b-lg shadow-lg max-h-48 overflow-y-auto">
                            {seriesSuggestions.map(s => (
                              <li 
                                key={s} 
                                className="px-[15px] py-2 hover:bg-slate-50 cursor-pointer text-[#0d171b] text-base font-normal"
                                onMouseDown={() => handleSeriesSelect(s)}
                              >
                                {s}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </label>
                    <label className="flex flex-col flex-1">
                      <p className="text-[#0d171b] text-base font-medium leading-normal pb-2">Your Plot Guess:</p>
                      <textarea 
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d171b] focus:outline-0 focus:ring-2 focus:ring-[#13a4ec]/50 border border-[#cfdfe7] bg-white focus:border-[#13a4ec] min-h-48 placeholder:text-[#4c809a] p-[15px] text-base font-normal leading-normal" 
                        placeholder="Enter your plot guess here..."
                        disabled={loading}
                        maxLength={1000}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                      />
                    </label>
                    <p className="text-xs text-gray-500">Our evaluation is conducted by AI; therefore, spoiler-freeness cannot be guaranteed. However, you are unlikely to encounter any spoilers.</p>
                    <div className="flex justify-start">
                      <button 
                        onClick={handleSubmit}
                        disabled={loading || !input.trim() || !selectedSeries}
                        className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-[#13a4ec] text-slate-50 text-base font-bold leading-normal tracking-[0.015em] hover:bg-[#0f8ac9] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Analyzing...
                          </span>
                        ) : (
                          <span className="truncate">Submit Guess</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Right Column: Evaluation */}
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-[#0d171b] text-4xl font-black leading-tight tracking-[-0.033em]">Your Guess Evaluation</p>
                    <button 
                      onClick={handleNewGuess}
                      className="flex items-center gap-2 text-sm font-medium text-[#13a4ec] hover:text-[#0f8ac9] transition-colors self-start sm:self-auto"
                    >
                      <span className="material-symbols-outlined">restart_alt</span>
                      New Guess
                    </button>
                  </div>
                  
                  {!response && !loading && !currentGuess && (
                    <div className="flex items-center justify-center h-64 text-gray-500 text-center">
                      <div>
                        <div className="text-4xl mb-4">🎬</div>
                        <p>Submit your guess to see the evaluation results here</p>
                      </div>
                    </div>
                  )}
                  
                  {loading && (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#13a4ec] mx-auto mb-4"></div>
                        <p className="text-gray-600">Analyzing your guess...</p>
                      </div>
                    </div>
                  )}
                  
                  {response && !loading && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Correctness Card */}
                        <div className="group bg-white rounded-lg shadow-sm border border-transparent hover:border-green-300 hover:shadow-md transition-all duration-300 p-5 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <h3 className="text-lg font-bold text-[#0d171b]">Correctness</h3>
                              <p className="text-sm text-gray-500">Right or Wrong?</p>
                            </div>
                            <div className="p-2 rounded-full bg-green-100 text-green-500">
                              <span className="material-symbols-outlined">checklist</span>
                            </div>
                          </div>
                          <div className={`${revealedCards.has('is_correct') ? 'block' : 'hidden group-hover:block'} transition-all duration-300`}>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-700">{formatCardValue('is_correct', response.is_correct)}</p>
                              {response.is_correct && (
                                <div className="relative group/tooltip">
                                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center cursor-help">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" className="text-blue-600" viewBox="0 0 16 16">
                                      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                      <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                                    </svg>
                                  </div>
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                    This doesn’t necessarily mean you’re completely right
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <button 
                            className={`mt-auto text-sm font-bold text-green-600 self-start ${revealedCards.has('is_correct') ? 'hidden' : 'group-hover:hidden'}`}
                            onClick={() => handleCardClick('is_correct')}
                          >
                            Click to Reveal
                          </button>
                        </div>
                        
                        {/* Accuracy Card */}
                        <div className="group bg-white rounded-lg shadow-sm border border-transparent hover:border-blue-300 hover:shadow-md transition-all duration-300 p-5 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <h3 className="text-lg font-bold text-[#0d171b]">Accuracy Score</h3>
                              <p className="text-sm text-gray-500">The Big Picture</p>
                            </div>
                            <div className="p-2 rounded-full bg-blue-100 text-blue-500">
                              <span className="material-symbols-outlined">pie_chart</span>
                            </div>
                          </div>
                          <div className={`${revealedCards.has('accuracy') ? 'block' : 'hidden group-hover:block'} transition-all duration-300`}>
                            <p className="text-gray-700">{formatCardValue('accuracy', response.accuracy)}</p>
                          </div>
                          <button 
                            className={`mt-auto text-sm font-bold text-blue-600 self-start ${revealedCards.has('accuracy') ? 'hidden' : 'group-hover:hidden'}`}
                            onClick={() => handleCardClick('accuracy')}
                          >
                            Click to Reveal
                          </button>
                        </div>
                        
                        {/* Time Card */}
                        {response.time && response.time.trim() !== '' && (
                          <div className="group bg-white rounded-lg shadow-sm border border-transparent hover:border-orange-300 hover:shadow-md transition-all duration-300 p-5 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <h3 className="text-lg font-bold text-[#0d171b]">Time Period</h3>
                                <p className="text-sm text-gray-500">When It Happens</p>
                              </div>
                              <div className="p-2 rounded-full bg-orange-100 text-orange-500">
                                <span className="material-symbols-outlined">schedule</span>
                              </div>
                            </div>
                            <div className={`${revealedCards.has('time') ? 'block' : 'hidden group-hover:block'} transition-all duration-300`}>
                              <p className="text-gray-700">{formatCardValue('time', response.time)}</p>
                            </div>
                            <button 
                              className={`mt-auto text-sm font-bold text-orange-600 self-start ${revealedCards.has('time') ? 'hidden' : 'group-hover:hidden'}`}
                              onClick={() => handleCardClick('time')}
                            >
                              Click to Reveal
                            </button>
                          </div>
                        )}
                        
                        {/* Explanation Card */}
                        <div className="group bg-white rounded-lg shadow-sm border border-transparent hover:border-purple-300 hover:shadow-md transition-all duration-300 p-5 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <h3 className="text-lg font-bold text-[#0d171b]">Explanation</h3>
                              <p className="text-sm text-gray-500">Detailed Analysis</p>
                            </div>
                            <div className="p-2 rounded-full bg-purple-100 text-purple-500">
                              <span className="material-symbols-outlined">psychology</span>
                            </div>
                          </div>
                          <div className={`${revealedCards.has('explanation') ? 'block' : 'hidden group-hover:block'} transition-all duration-300`}>
                            <p className="text-gray-700">{formatCardValue('explanation', response.explanation)}</p>
                          </div>
                          <button 
                            className={`mt-auto text-sm font-bold text-purple-600 self-start ${revealedCards.has('explanation') ? 'hidden' : 'group-hover:hidden'}`}
                            onClick={() => handleCardClick('explanation')}
                          >
                            Click to Reveal
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <button 
                          onClick={handleRevealAll}
                          className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-slate-200 text-slate-800 text-base font-bold leading-normal tracking-[0.015em] hover:bg-slate-300 transition-colors duration-200"
                        >
                          <span className="truncate">Reveal All</span>
                        </button>
                        {response.confidence && (
                          <span className="text-xs text-gray-400 italic">
                            AI Confidence: {Math.round(response.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </main>
          </div>
        </div>
        
        {/* Footer */}
        <footer className="bg-white border-t border-[#e7eff3] px-4 md:px-10 lg:px-20 xl:px-40 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-[1280px] mx-auto">
            <p className="text-[#4c809a] text-sm">
              © 2025 Guess the Plot. All rights reserved.
            </p>
            <button 
              className="text-[#4c809a] text-sm font-medium leading-normal hover:text-[#13a4ec] transition-colors cursor-pointer"
              onClick={() => handleOptionClick('privacy')}
            >
              Privacy Policy
            </button>
          </div>
        </footer>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="modal-overlay" onClick={() => handleModalClose('feedback')}>
          <div className="modal-content feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Give Feedback</h2>
              <button 
                className="modal-close"
                onClick={() => handleModalClose('feedback')}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleFeedbackSubmit} className="feedback-form">
              <div className="form-group">
                <label htmlFor="feedback-name">Name (optional)</label>
                <input
                  id="feedback-name"
                  type="text"
                  value={feedbackData.name}
                  onChange={(e) => handleFeedbackChange('name', e.target.value)}
                  className="form-input"
                  placeholder="Your name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="feedback-email">Email (optional)</label>
                <input
                  id="feedback-email"
                  type="email"
                  value={feedbackData.email}
                  onChange={(e) => handleFeedbackChange('email', e.target.value)}
                  className="form-input"
                  placeholder="your.email@example.com"
                />
              </div>
              <div className="form-group">
                <label htmlFor="feedback-message">Feedback *</label>
                <textarea
                  id="feedback-message"
                  value={feedbackData.feedback}
                  onChange={(e) => handleFeedbackChange('feedback', e.target.value)}
                  className="form-textarea"
                  placeholder="Share your thoughts, suggestions, or report issues..."
                  rows={6}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="submit-button"
                disabled={feedbackSubmitting || !feedbackData.feedback.trim()}
              >
                {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => handleModalClose('privacy')}>
          <div className="modal-content privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Privacy Policy</h2>
              <button 
                className="modal-close"
                onClick={() => handleModalClose('privacy')}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
                </svg>
              </button>
            </div>
            <PrivacyPolicyContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default GuessPage;
