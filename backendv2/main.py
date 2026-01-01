import os
import json
import datetime
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
from fastapi.middleware.cors import CORSMiddleware
import ddgs
from langchain.chat_models import init_chat_model

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

4. **Explain Thoroughly**  
   - Compare the guess to the actual show’s **core themes**, **twists**, and **character development**.  
   - If uncertain, **explicitly cite your uncertainty** and note where additional research is needed.  

5. **Use the Web Search Tool**  
   - Conduct multiple searches (via `web_search`) if needed to verify minor details, character roles, or lesser-known plot points.  
   - **Prioritize canonical sources** (e.g., showrunners, official synopses) for accuracy.  

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


def web_search(query: str) -> str:
    """Perform a web search using DuckDuckGo."""
    print(f"Performing web search for: {query}")
    results = ddgs.DDGS().text(query, max_results=3, safesearch='off')
    result_string = "\n".join([f"- {result['title']}: {result['body']}\n" for result in results])
    return result_string if result_string else "No results found."

web_search_tool = tool(web_search, description="Useful for when you need to look up information about a TV show or its plot. Use this to verify plot details, character arcs, or events in the show.")
tools = [web_search_tool]

# LLM setup
if os.getenv("USE_OPENAI", "false").lower() == "true":
    model = ChatOpenAI(model="gpt-5-mini")
else:
    model = init_chat_model("gemini-2.5-flash", model_provider="google_genai")

# Model with tools for the agent loop
model_with_tools = model.bind_tools(tools)
# Model for final structured output (no tools)
model_structured = model.with_structured_output(PlotGuessEvaluation)

def call_model(state: AgentState):
    """Call the model and let it decide whether to use tools."""
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
    
    # Save to file (append to existing feedback)
    feedback_file = "feedback.json"
    try:
        # Read existing feedback
        if os.path.exists(feedback_file):
            with open(feedback_file, 'r', encoding='utf-8') as f:
                feedback_data = json.load(f)
        else:
            feedback_data = []
        
        # Add new feedback
        feedback_data.append(feedback_entry)
        
        # Write back to file
        with open(feedback_file, 'w', encoding='utf-8') as f:
            json.dump(feedback_data, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"Error saving feedback to file: {e}")
        # Continue anyway - don't fail the request if file saving fails
    
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
    
    # Save to file (append to existing ratings)
    rating_file = "ratings.json"
    try:
        # Read existing ratings
        if os.path.exists(rating_file):
            with open(rating_file, 'r', encoding='utf-8') as f:
                rating_data = json.load(f)
        else:
            rating_data = []
        
        # Add new rating
        rating_data.append(rating_entry)
        
        # Write back to file
        with open(rating_file, 'w', encoding='utf-8') as f:
            json.dump(rating_data, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"Error saving rating to file: {e}")
        # Continue anyway - don't fail the request if file saving fails
    
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
    input_data = {
        "tv_show_name":request.tv_show_name,
        "guess":request.guess,
        "messages": [
                SystemMessage(content=SYSTEM_MESSAGE),
                HumanMessage(content=USER_MESSAGE.format(tv_show_name=request.tv_show_name, guess=request.guess))
            ]
    }
    
    with open("count.txt","r") as f:
        count = int(f.read().strip())
    count += 1
    with open("count.txt","w") as f:
        f.write(str(count))
    
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

