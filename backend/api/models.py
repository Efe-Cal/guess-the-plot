from django.db import models

# Create your models here.
class GuessRequest(models.Model):
    tv_show_name = models.CharField(max_length=50, help_text="Name of the TV show")
    guess = models.CharField(max_length=300, help_text="Your guess of the plot")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Timestamp when the guess was made")
    response = models.JSONField(null=True, blank=True, help_text="Response from the AI model")

    def __str__(self):
        return f"{self.tv_show_name} - {self.guess[:50]}..."  # Display first 50 characters of the guess