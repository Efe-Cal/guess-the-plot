import React, { useState } from 'react';
import './App.css';
import { Link } from 'react-router-dom';
import PrivacyPolicyContent from './PrivacyPolicyContent';

const LandingPage: React.FC = () => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleModalClose = () => {
    setShowPrivacyModal(false);
  };

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
      <footer className="landing-footer">
        Made with ❤️ by Efe-Cal
        <br />
        <button 
          onClick={() => setShowPrivacyModal(true)}
          className="privacy-link"
        >
          Privacy Policy
        </button>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div className="modal-content privacy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Privacy Policy</h2>
              <button 
                className="modal-close"
                onClick={handleModalClose}
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

export default LandingPage;
