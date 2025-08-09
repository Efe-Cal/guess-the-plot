from langchain_openai import ChatOpenAI
from langchain_community.tools import DuckDuckGoSearchResults
from langchain_core.tools import tool
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import Optional
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import MessagesState
from langgraph.prebuilt import ToolNode
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:3000",
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
    "You are given access to a web search tool to find information about the TV show. "
    "You MUST use the web search tool at least once before finalizing your evaluation."
)

USER_MESSAGE = """
TV Show Name: {tv_show_name}
Guess: {guess}
"""


class PlotGuessEvaluation(BaseModel):
    is_correct: bool = Field(..., description="Whether the guess is correct or not")
    accuracy: float = Field(..., description="Accuracy of the guess (0-1 scale, optimistic if partially correct)")
    time: Optional[str] = Field(None, description="When in the show the event occurs, leave empty if incorrect")
    explanation: str = Field(..., description="Explanation of the guess's correctness or incorrectness")
    confidence: float = Field(..., description="Your confidence level (0-1 scale)")

class AgentState(MessagesState):
    # Final structured response from the agent
    final_response: PlotGuessEvaluation

# Web search tool
search_tool = DuckDuckGoSearchResults()

@tool("web_search",description="Perform a web search to find information about the TV show.")
def web_search(query: str) -> str:
    """Perform a web search using DuckDuckGo."""
    print(f"Performing web search for: {query}")
    results = search_tool.invoke(query)
    return str(results)

tools = [web_search, PlotGuessEvaluation]

# LLM that directly returns structured output
model = ChatOpenAI(model="gpt-4.1-mini")

model_with_response_tool = model.bind_tools(tools, tool_choice="any")

def call_model(state: AgentState):
    response = model_with_response_tool.invoke(state["messages"])
    # We return a list, because this will get added to the existing list
    return {"messages": [response]}


# Define the function that responds to the user
def respond(state: AgentState):
    # Construct the final answer from the arguments of the last tool call
    response_tool_call = state["messages"][-1].tool_calls[0]
    response = PlotGuessEvaluation(**response_tool_call["args"])
    # Since we're using tool calling to return structured output,
    # we need to add  a tool message corresponding to the WeatherResponse tool call,
    # This is due to LLM providers' requirement that AI messages with tool calls
    # need to be followed by a tool message for each tool call
    tool_message = {
        "type": "tool",
        "content": "Here is your structured response",
        "tool_call_id": response_tool_call["id"],
    }
    # We return the final answer
    return {"final_response": response, "messages": [tool_message]}


# Define the function that determines whether to continue or not
def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    # If there is only one tool call and it is the response tool call we respond to the user
    if (
        len(last_message.tool_calls) == 1
        and last_message.tool_calls[0]["name"] == "PlotGuessEvaluation"
    ):
        return "respond"
    # Otherwise we will use the tool node again
    else:
        return "continue"


# Define a new graph
workflow = StateGraph(AgentState)

# Define the two nodes we will cycle between
workflow.add_node("agent", call_model)
workflow.add_node("respond", respond)
workflow.add_node("tools", ToolNode(tools))

# Set the entrypoint as `agent`
# This means that this node is the first one called
workflow.set_entry_point("agent")

# We now add a conditional edge
workflow.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "tools",
        "respond": "respond",
    },
)

workflow.add_edge("tools", "agent")
workflow.add_edge("respond", END)
graph = workflow.compile()

# response = graph.invoke(input={"messages": [
#     SystemMessage(content=SYSTEM_MESSAGE),
#     HumanMessage(content=USER_MESSAGE.format(**{"tv_show_name": "House", "guess": "House and Cuddy will end up together at the end of the show"})) 
#     ]}
# )["final_response"]
# print(response)

class GuessRequest(BaseModel):
    tv_show_name: str
    guess: str
    
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
        "messages": [
            SystemMessage(content=SYSTEM_MESSAGE),
            HumanMessage(content=USER_MESSAGE.format(tv_show_name=request.tv_show_name, guess=request.guess))
        ]
    }
    
    response = graph.invoke(input=input_data)
    
    return response["final_response"].dict()