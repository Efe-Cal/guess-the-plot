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

SYSTEM_MESSAGE = (
    "You are an expert in TV shows and their plots. Your task is to evaluate a guess "
    "about a TV show plot and provide feedback on its accuracy, events' time in the show, "
    "your confidence level, and an explanation. Leave the time empty if the guess is incorrect A guess is correct even if it is not 100% accurate, "
    "as long as it captures the main events and themes of the plot. If the event in the guess occurs even "
    "once in the show, it is considered correct, even if it is not the final resolution of the plot.\n"
    "You are given access to a web search tool to look up information about the TV show and its plot. Use this tool if you NEED more information to evaluate the guess. "

)

USER_MESSAGE = """
Please evaluate the following guess about a TV show plot.
TV Show Name: {tv_show_name}
Guess: {guess}
"""

WEB_SEARCHER_INSTRUCTION = (
    "User has a guess about a TV show plot. Your job is to create exactly 5 search queries that will help you determine whether the guess is correct or not. "
    "Each query should be a single line, and should be specific to the TV show and the guess. "
    """Here is how to write good search queries:
- Write queries short and direct.
- Do not use full sentences or questions.
- Use only the most important words.
- Start with the main topic, then add context.
- Keep queries three to six words long.
- Put specific words close together in a clear phrase.
- Avoid extra words like "how" or "what is" or "Did ... ?".
- DO NOT use bullet points or numbered lists\n"""
    "Your answer should be a list of 5 search queries, each on a new line. "
)
WEB_SEARCHER_MESSAGE = (
    "The TV show is: {tv_show_name}. "
    "The guess is: {guess}. "
    "Create 5 specific search queries to find information about the TV show and the guess."
)


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

tools = [tool(web_search, description="Useful for when you need to look up information about a TV show or its plot.")]

# LLM that directly returns structured output
if os.getenv("USE_OPENAI", "false").lower() == "true":
    model = ChatOpenAI(model="gpt-4.1-mini")
else:
    model = init_chat_model("gemini-2.5-flash", model_provider="google_genai")

model_with_response_tool = model.bind_tools(tools, tool_choice="auto")
model_with_structured_output = model_with_response_tool.with_structured_output(PlotGuessEvaluation)

def web_searcher(state: AgentState):
    response = model.invoke(
        [
            SystemMessage(content=WEB_SEARCHER_INSTRUCTION),
            HumanMessage(content=WEB_SEARCHER_MESSAGE.format(tv_show_name=state["tv_show_name"],guess=state["guess"]))
        ]
    )
    # We return a list, because this will get added to the existing list
    queries = [line.strip() for line in response.content.split("\n") if line.strip()]
    for query in queries:
        search_results = web_search(query)
        state["search_results"] = state.get("search_results", "") + f"\nSearch results for '{query}':\n{search_results}\n"
    return {"messages": [HumanMessage(content="Here is some additional information, web search results, on the TV series that may be related to the guess:\n"+state["search_results"])]}

def call_model(state: AgentState):
    response = model_with_structured_output.invoke(state["messages"])

    return {"final_response": response}


# # Define the function that responds to the user
# def respond(state: AgentState):
#     # Construct the final answer from the arguments of the last tool call
#     response_tool_call = state["messages"][-1].tool_calls[0]
#     response = PlotGuessEvaluation(**response_tool_call["args"])
#     # Since we're using tool calling to return structured output,
#     # we need to add  a tool message corresponding to the WeatherResponse tool call,
#     # This is due to LLM providers' requirement that AI messages with tool calls
#     # need to be followed by a tool message for each tool call
#     tool_message = {
#         "type": "tool",
#         "content": "Here is your structured response",
#         "tool_call_id": response_tool_call["id"],
#     }
#     # We return the final answer
#     return {"final_response": response, "messages": [tool_message]}


# # Define the function that determines whether to continue or not
# def should_continue(state: AgentState):
#     last_message = state["messages"][-1]
#     # If there is only one tool call and it is the response tool call we respond to the user
#     if (
#         len(last_message.tool_calls) == 1
#         and last_message.tool_calls[0]["name"] == "PlotGuessEvaluation"
#     ):
#         return "respond"
#     # Otherwise we will use the tool node again
#     else:
#         return "continue"


# Define a new graph
workflow = StateGraph(AgentState)

# Define the two nodes we will cycle between
workflow.add_node("agent", call_model)
workflow.add_node("web_searcher", web_searcher)

# Set the entrypoint as `agent`
# This means that this node is the first one called
workflow.set_entry_point("web_searcher")

workflow.add_edge("web_searcher", "agent")

workflow.add_edge("agent", END)
# # We now add a conditional edge
# workflow.add_conditional_edges(
#     "agent",
#     should_continue,
#     {
#         "continue": "tools",
#         "respond": "respond",
#     },
# )

# workflow.add_edge("tools", "agent")
# workflow.add_edge("respond", END)
graph = workflow.compile()


# response = graph.invoke(input={
#     "tv_show_name":"House MD",
#     "guess":"House and cuddy will get married at the end of the series",
#     "messages": [
#             SystemMessage(content=SYSTEM_MESSAGE),
#             HumanMessage(content=USER_MESSAGE.format(tv_show_name="House MD", guess="House and cuddy will get married at the end of the series"))
#         ]
# }
# )


class GuessRequest(BaseModel):
    tv_show_name: str
    guess: str

class FeedbackRequest(BaseModel):
    name: str = ""
    email: str = ""
    feedback: str

@app.post("/api/feedback")
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

@app.post("/api/evaluate-guess")
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
