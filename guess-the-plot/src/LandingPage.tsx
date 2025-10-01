import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PrivacyPolicyContent from './PrivacyPolicyContent';

const LandingPage: React.FC = () => {
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleModalClose = () => {
    setShowPrivacyModal(false);
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-slate-50 group/design-root overflow-x-hidden" style={{fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif'}}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 md:px-20 lg:px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-b-[#e7eff3] px-4 md:px-10 py-3">
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
                <h2 className="text-[#0d171b] text-lg font-bold leading-tight tracking-[-0.015em]">Guess the Plot</h2>
              </div>
              {/* <div className="flex flex-1 justify-end gap-8">
                <div className="flex items-center gap-9">
                  <button 
                    onClick={() => setShowPrivacyModal(true)}
                    className="text-[#0d171b] text-sm font-medium leading-normal hover:underline"
                  >
                    About
                  </button>
                </div>
              </div> */}
            </header>
            <div className="@container">
              <div className="@[480px]:p-4">
                <div className="flex min-h-[600px] flex-col gap-6 bg-cover bg-center bg-no-repeat @[480px]:gap-8 @[480px]:rounded-lg items-center justify-center p-4" 
                     data-alt="Abstract background with a subtle blue and green gradient" 
                     style={{backgroundImage: "linear-gradient(rgba(19, 164, 236, 0.05) 0%, rgba(10, 10, 10, 0) 100%), linear-gradient(to right, #e0f7fa, #e8f5e9)"}}>
                  <div className="flex flex-col gap-4 text-center max-w-2xl">
                    <h1 className="text-slate-900 text-5xl font-black leading-tight tracking-[-0.033em] @[480px]:text-6xl @[480px]:font-black @[480px]:leading-tight @[480px]:tracking-[-0.033em]">
                      Guess the Plot
                    </h1>
                    <h2 className="text-slate-600 text-lg font-normal leading-normal @[480px]:text-xl @[480px]:font-normal @[480px]:leading-normal">
                      Welcome to Guess the Plot! Have you ever watched a TV show and thought you knew exactly what was going to happen next? This is your chance to put your theories to the test, without ever accidentally stumbling upon a spoiler.
                    </h2>
                  </div>
                  <Link to="/guess" className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 @[480px]:h-14 @[480px]:px-8 bg-[#13a4ec] text-slate-50 text-base font-bold leading-normal tracking-[0.015em] @[480px]:text-lg @[480px]:font-bold @[480px]:leading-normal @[480px]:tracking-[0.015em] transition-transform duration-200 hover:scale-105 no-underline">
                    <span className="truncate">Start Guessing</span>
                  </Link>
                </div>
              </div>
            </div>
            <footer className="flex flex-col gap-4 px-5 py-10 text-center @container">
              <p className="text-slate-500 text-sm font-normal leading-normal">© 2025 Guess the Plot. All rights reserved.</p>
                <button
                onClick={() => setShowPrivacyModal(true)}
                className="text-slate-500 text-sm font-normal leading-normal hover:underline"
                >
                Privacy Policy
                </button>
            </footer>
          </div>
        </div>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6 relative">
            <button
              onClick={handleModalClose}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <PrivacyPolicyContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
