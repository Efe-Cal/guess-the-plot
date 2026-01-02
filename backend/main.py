import os
import json
import datetime
import re
import unicodedata
import logging
from collections import deque
from functools import lru_cache
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import MessagesState
from langgraph.errors import GraphRecursionError 
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from langchain.chat_models import init_chat_model
import requests

app = FastAPI()

origins = [
    "http://localhost:3000",
    "https://guesstheplot.app",
    "https://efecal.hackclub.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger("guess-the-plot-backend")

# Stateless (in-memory) telemetry. Railway containers are ephemeral; do not rely on disk.
REQUEST_COUNT = 0
RECENT_FEEDBACK = deque(maxlen=200)
RECENT_RATINGS = deque(maxlen=500)

SYSTEM_MESSAGE = """
You are an expert TV show plot analyst with deep knowledge of narrative structures, character arcs, and television history. Your task is to evaluate a proposed plot guess for a TV show by analyzing its accuracy, timing of events, and thematic consistency.
"""

USER_MESSAGE = """
### Given the TV show name and a guess about its plot, evaluate the guess based on the following criteria:

1. **Evaluate Accuracy**  
   - Identify correct and incorrect plot elements. **Partial correctness** is acceptable if the guess captures major events or themes.  
   - **Wrong elements must be flagged** even if they appear once in the series.  

2. **Timestamp Events**  
   - Specify the **season/episode** when each event occurs (e.g., *Season 3, Episode 2*).  
   - Leave blank if an event is entirely inaccurate.  

3. **Confidence Level**  
   - Assign a percentage (0%–100%) based on the guess’s alignment with the actual plot.  
   - **Justify** the confidence score with specific examples.  

4. **Explain Breifly**  
   - Compare the guess to the actual show’s **core themes**, **twists**, and **character development**.  
   - Keep your explanation **concise** (2-3 sentences).

5. **Use the Web Search Tool**  
   - Conduct multiple searches (via `web_search`) if needed to verify minor details, character roles, or lesser-known plot points.  
   - **Prioritize canonical sources** (e.g., showrunners, official synopses) for accuracy.  
   - Make a maximum of 5 web searches to gather necessary information.

Ensure responses are **structured, concise**, and **actionable**. Avoid jargon or tangential details.

###

**Example Input Guess**:  
*"In 'The Mandalorian,' Din Djarin recovers a mysterious dragon from a fiery planet to defeat the Sith."*  

**Example Output**:  
**Evaluation Summary**  
- Accuracy: 60%  
- Timestamped Events:  
  ✓ "Mysterious dragon" -> Season 1, Episode 1 (Grogu introduced on a dark, fire-ravaged planet, theorized as a dragon in fan culture).  
  ✗ "Defeat the Sith" -> Not original plot (no Sith in S1; introduced in later seasons).  
- Confidence: 60%  
- Explanation: The guess accurately identifies Grogu’s introduction but misattributes the antagonist. The "Sith" conflict occurs in Season 2 (Empire), not the initial series. Themes of protectorship align, but the guess lacks nuance on Mandalorian mythology.  

###

**Now evaluate the following guess:**
```
TV Show Name: {tv_show_name}
Guess: {guess}
```
"""


class PlotGuessEvaluation(BaseModel):
    is_correct: bool = Field(..., description="Whether the guess is correct or not")
    accuracy: float = Field(..., description="Accuracy of the guess (0-1 scale, optimistic if partially correct)")
    time: Optional[str] = Field(None, description="When in the show the event occurs. Try to be as specific and precise as possible, e.g., 'Season 2' or 'Final season'. MUST be left empty if the guess is incorrect")
    explanation: str = Field(..., description="Explanation of the guess's correctness or incorrectness")
    confidence: float = Field(..., description="Your confidence level (0-1 scale)")

class AgentState(MessagesState):
    # Final structured response from the agent
    final_response: PlotGuessEvaluation
    search_results: str
    tv_show_name: str
    guess: str

def clean_text_for_llm(text):
    # Normalize Unicode
    text = unicodedata.normalize('NFKC', text)
    
    # Remove control characters except newlines/tabs
    text = ''.join(c for c in text if unicodedata.category(c)[0] != 'C' or c in '\n\r\t')
    
    # Remove zero-width characters
    text = re.sub(r'[\u200b-\u200d\ufeff]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def web_search(query: str) -> str:
    print(f"Performing web search for query: {query}")
    response = requests.get(
        'https://search.hackclub.com/res/v1/web/search',
        params={
            'q': query,
            'count': 3,
            'safesearch': 'off',},
        headers={'Authorization': f'Bearer {os.getenv("HACKCLUB_SEARCH_API_KEY", "")}'},
    )
    response.raise_for_status()
    data = response.json()
    
    # Extract titles and snippets
    data = [(item["title"], "\n".join(item["extra_snippets"]) if "extra_snippets" in item else item["description"]) for item in data["web"]["results"]]

    # Clean text for LLM compatibility
    data = [(clean_text_for_llm(title), clean_text_for_llm(snippets)) for title, snippets in data]

    data_str = "\n".join([f"- {title}\n{snippets}\n----------" for title, snippets in data])
    
    return data_str
web_search_tool = tool(web_search, description="Useful for when you need to look up information about a TV show or its plot. Use this to verify plot details, character arcs, or events in the show.")
tools = [web_search_tool]


def _build_models():
    """Create model instances based on env vars.

    NOTE: This is intentionally lazy to avoid crashing the web process at import time
    when API keys are missing or misconfigured.
    """
    use_openai = os.getenv("USE_OPENAI", "false").lower() == "true"
    if use_openai:
        openai_model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
        base_model = ChatOpenAI(model=openai_model)
    else:
        gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        base_model = init_chat_model(gemini_model, model_provider="google_genai")

    model_with_tools = base_model.bind_tools(tools)
    model_structured = base_model.with_structured_output(PlotGuessEvaluation)
    return model_with_tools, model_structured

def call_model(state: AgentState):
    """Call the model and let it decide whether to use tools."""
    model_with_tools, _ = get_models()
    response = model_with_tools.invoke(state["messages"])
    return {"messages": [response]}

def execute_tools(state: AgentState):
    """Execute any tool calls from the last message."""
    last_message = state["messages"][-1]
    tool_results = []
    
    for tool_call in last_message.tool_calls:
        if tool_call["name"] == "web_search":
            result = web_search(tool_call["args"]["query"])
            tool_results.append({
                "type": "tool",
                "content": result,
                "tool_call_id": tool_call["id"],
            })
    
    return {"messages": tool_results}

def should_continue(state: AgentState):
    """Determine if we should continue with tools or get final response."""
    last_message = state["messages"][-1]
    # If the last message has tool calls, execute them
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "final"

def get_final_response(state: AgentState):
    """Get the final structured response from the model."""
    # Add instruction to provide final evaluation
    final_prompt = state["messages"] + [
        HumanMessage(content="Based on the information gathered, please provide your final evaluation of the guess.")
    ]
    _, model_structured = get_models()
    response = model_structured.invoke(final_prompt)
    return {"final_response": response}


# Define a new graph
workflow = StateGraph(AgentState)

# Define the nodes
workflow.add_node("agent", call_model)
workflow.add_node("tools", execute_tools)
workflow.add_node("final", get_final_response)

# Set the entrypoint
workflow.set_entry_point("agent")

# Add conditional edge from agent
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "tools": "tools",
        "final": "final",
    },
)

# After tools, go back to agent
workflow.add_edge("tools", "agent")

# Final node ends the graph
workflow.add_edge("final", END)

graph = workflow.compile()


@lru_cache(maxsize=1)
def get_models():
    try:
        return _build_models()
    except Exception as e:
        # Don't crash startup; surface as a request-time error instead.
        logger.exception("Failed to initialize LLM models")
        raise RuntimeError(
            "LLM models failed to initialize. Check env vars like USE_OPENAI, OPENAI_API_KEY/GOOGLE_API_KEY, and OPENAI_MODEL/GEMINI_MODEL."
        ) from e


class GuessRequest(BaseModel):
    tv_show_name: str
    guess: str

class FeedbackRequest(BaseModel):
    name: str = ""
    email: str = ""
    feedback: str

class RatingRequest(BaseModel):
    rating: str  # 'positive', 'negative-spoiler', 'negative-incorrect-evaluation', 'negative-inaccurate-time', 'negative-inaccurate-explanation', 'negative-other'
    tv_show_name: str
    guess: str
    evaluation: PlotGuessEvaluation

@app.post("/feedback")
async def submit_feedback(request: FeedbackRequest):
    """
    Endpoint to receive and store user feedback.
    
    Args:
        request (FeedbackRequest): The feedback data containing name, email, and feedback message.
    
    Returns:
        dict: Success message
    """
    # Create feedback entry with timestamp
    feedback_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "name": request.name,
        "email": request.email,
        "feedback": request.feedback
    }
    
    # Stateless logging only (Railway containers are ephemeral)
    RECENT_FEEDBACK.append(feedback_entry)
    logger.info("Feedback received", extra={"feedback": feedback_entry})
    
    return {"message": "Feedback received successfully", "status": "success"}

@app.post("/rating")
async def submit_rating(request: RatingRequest):
    """
    Endpoint to receive and store user ratings for evaluations.
    
    Args:
        request (RatingRequest): The rating data containing rating type, tv show name, and guess.
    
    Returns:
        dict: Success message
    """
    # Create rating entry with timestamp
    rating_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "rating": request.rating,
        "tv_show_name": request.tv_show_name,
        "guess": request.guess
    }
    
    # Stateless logging only (Railway containers are ephemeral)
    RECENT_RATINGS.append(rating_entry)
    logger.info("Rating received", extra={"rating": rating_entry})
    
    return {"message": "Rating received successfully", "status": "success"}

@app.post("/evaluate-guess")
async def evaluate_guess(request: GuessRequest) -> PlotGuessEvaluation:
    """
    Endpoint to evaluate a guess about a TV show plot.
    
    Args:
        tv_show_name (str): Name of the TV show.
        guess (str): The guess about the plot.
    
    Returns:
        PlotGuessEvaluation: The evaluation of the guess.
    """
    global REQUEST_COUNT
    REQUEST_COUNT += 1

    input_data = {
        "tv_show_name":request.tv_show_name,
        "guess":request.guess,
        "messages": [
                SystemMessage(content=SYSTEM_MESSAGE),
                HumanMessage(content=USER_MESSAGE.format(tv_show_name=request.tv_show_name, guess=request.guess))
            ]
    }

    try:
        _ = get_models()
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    c = 0
    while c < 3:
        try:
            response = graph.invoke(input=input_data)
            break
        except GraphRecursionError:
            print("Recursion limit reached, retrying...")
            c += 1
            continue
    else:
        return PlotGuessEvaluation(
            is_correct=False,
            accuracy=0.0,
            time=None,
            explanation="Could not evaluate the guess due to an error. Please try again later.",
            confidence=0.0
        )
        
    return response["final_response"].model_dump()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "requestCount": REQUEST_COUNT,
    }

