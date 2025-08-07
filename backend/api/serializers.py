from rest_framework import serializers

class GuessThePlotSerializer(serializers.Serializer):
    tv_show_name = serializers.CharField(max_length=50, required=True)
    guess = serializers.CharField(max_length=300, required=True)