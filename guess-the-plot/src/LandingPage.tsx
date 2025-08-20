import React from 'react';
import './App.css';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="landing-container">
      <div className="landing-content">
        <h1 className="app-title">Guess the Plot</h1>
        <p className="tagline">Test your TV series knowledge by guessing a show's plot and let the AI evaluate how close you are!</p>
        <ul className="landing-features">
          <li>Pick a TV series</li>
            <li>Make a guess about its plot</li>
            <li>Reveal AI feedback step-by-step with no unintended spoilers</li>
        </ul>
        <Link to="/guess" className="start-button">Start Guessing</Link>
      </div>
      <footer className="landing-footer">Made with ❤️ by Efe-Cal</footer>
    </div>
  );
};

export default LandingPage;
