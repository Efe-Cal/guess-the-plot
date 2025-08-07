from django.urls import path
from .views import GuessThePlotView

urlpatterns = [
    
    path('guess-ai/', GuessThePlotView.as_view(), name='guess_the_plot'),
]
