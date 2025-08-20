import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import GuessPage from './GuessPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/guess" element={<GuessPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
