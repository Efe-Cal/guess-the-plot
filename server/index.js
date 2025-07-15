const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.post('/api/ai', (req, res) => {
  const { message, series } = req.body;
  // Mock AI response
  const aiResponse = `AI: (Pretend response for "${message}" about "${series || 'unknown series'}")`;
  res.json({ response: aiResponse });
});

app.listen(PORT, () => {
  console.log(`AI backend listening on port ${PORT}`);
}); 