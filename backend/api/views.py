from typing import Optional
from rest_framework.views import APIView, Response

from .models import GuessRequest
from .serializers import GuessThePlotSerializer
from openai import OpenAI
import openai
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(timeout=30)

SYSTEM_MESSAGE="You are an expert in TV shows and their plots. Your task is to evaluate a guess about a TV show plot and provide feedback on its accuracy, events' time in the show, your confidence level, and an explanation of your evaluation. A guess is correct even if it is not 100% accurate, as long as it captures the main events and themes of the plot. If the event in the guess occurs even once in the show, it is considered correct, even if it is not the final resolution of the plot."
USER_MESSAGE="""
You are given a TV show name and a guess about its plot. Your task is to evaluate the guess and provide feedback.
TV Show Name: {tv_show_name}
Guess: {guess}

"""

class PlotGuessEvaluation(BaseModel):
    is_correct: bool = Field(..., description="Whether the guess is correct or not")
    accuracy: float = Field(..., description="Accuracy of the guess. 0-1 scale. Be optimistic in your evaluation, even if the guess is not 100% correct. If the guess is completely wrong, set accuracy to 0.")
    time: Optional[str] = Field(..., description="The time in the tv show when the guessed plot occurs. Be percise and specific. If the guess is incorrect leave this field empty.")
    explanation: str = Field(..., description="Explanation of your evaluation. Why is the guess correct or incorrect?")
    confidence: float = Field(..., description="Confidence level of your response. 0-1 scale")

# Create your views here.
class GuessThePlotView(APIView):    
    def post(self, request):
        serializer = GuessThePlotSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            tv_show_name = data['tv_show_name']
            guess = data['guess']
            try:
                response = client.chat.completions.parse(
                    model="gpt-4.1-mini",
                    messages=[
                        {"role": "system", "content": SYSTEM_MESSAGE},
                        {"role": "user", "content": USER_MESSAGE.format(tv_show_name=tv_show_name, guess=guess)}
                    ],
                    timeout=30,
                    response_format=PlotGuessEvaluation,
                    max_tokens=200
                )
                GuessRequest.objects.create(
                    tv_show_name=tv_show_name,
                    guess=guess,
                    response=response.choices[0].message.parsed.dict()
                )
                print(response)
                return Response({"response":response.choices[0].message.parsed.dict()}, status=200)
                
            except openai.RateLimitError:
                return Response({"error": "High demand"}, status=429)
        else:
            return Response(serializer.errors, status=400)
        