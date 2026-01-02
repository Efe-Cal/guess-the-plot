# Guess the Plot

A web application that lets users test their guesses about TV series plots using AI evaluation without getting any unintended spoilers.


🌐 **Live App**: [guesstheplot.app](https://guesstheplot.app)

## 🎯 What is Guess the Plot?

Guess the Plot is an interactive game where users:
1. Pick a TV series from a searchable database
2. Make guesses about the show's plot
3. Receive detailed AI feedback with accuracy scores, timing information, and explanations
4. Get step-by-step revelations without unintended spoilers

## 🚀 Features

- **TV Series Search**: Powered by OMDB API for comprehensive series database
- **AI Evaluation**: Advanced AI analysis of plot guesses 
- **Progressive Reveal**: Click-to-reveal cards showing different aspects of your guess
- **Web Search Integration**: AI can search for additional information to improve accuracy

## 🛠️ Tech Stack

### Frontend
- **React** with TypeScript
- **React Router** for navigation
- **CSS3** with modern responsive design
- **OMDB API** for TV series data


#### Backend v2 (FastAPI - Current)
- **FastAPI** for modern Python API
- **LangChain** for AI orchestration
- **OpenAI GPT** and **Google Gemini** models
- **DuckDuckGo** search integration
- **LangGraph** for workflow management

## 📁 Project Structure

```
guess-the-plot/
├── src/                    # React frontend source
│   ├── App.tsx            # Main app component with routing
│   ├── LandingPage.tsx    # Welcome page
│   ├── GuessPage.tsx      # Main game interface
│   ├── PrivacyPolicyContent.tsx
│   └── App.css            # Styling
├── public/                # Static assets
├── backend/               # Django backend (deprecated)
└── backend/             # FastAPI backend (v2)
    └── main.py           # Main FastAPI application
```

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js (v14+)
- Python (v3.8+)
- OpenAI API key
- Google AI API key (optional)
- OMDB API key

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd guess-the-plot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your API keys:
```env
REACT_APP_OMDB_API_KEY=your_omdb_api_key
REACT_APP_API_URL=http://localhost:8000
```

4. Start the development server:
```bash
npm start
```

The app will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install fastapi uvicorn langchain-openai langchain-core langgraph python-dotenv pydantic duckduckgo-search langchain
```

3. Create a `.env` file:
```env
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_google_api_key
USE_OPENAI=true  # Set to false to use Google Gemini
```

4. Start the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## 🎮 How to Use

1. **Visit the Landing Page**: Start at the welcome screen
2. **Select a TV Series**: Use the search to find your show
3. **Make Your Guess**: Type your plot prediction
4. **Review Results**: Click cards to reveal different aspects of the evaluation:
   - ✓ Correctness
   - 🎯 Accuracy Score
   - 📅 Time Period (when events occur)
   - 💡 Detailed Explanation
   - 🤖 AI Confidence Level

## 🔧 Available Scripts

### Frontend
- `npm start` - Development server
- `npm build` - Production build
- `npm test` - Run tests

### Backend
- `uvicorn main:app --reload` - Development server

## 🔒 Privacy & Data Handling

- User inputs are processed by AI services (OpenAI/Google) for evaluation
- TV series data is fetched from OMDB API
- Feedback is stored temporarily and reviewed by developers
- No persistent user data storage
- Google Analytics for usage statistics

See the full [Privacy Policy](guess-the-plot/src/PrivacyPolicyContent.tsx) for details.