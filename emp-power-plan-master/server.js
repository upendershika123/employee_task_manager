import express from 'express';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SendGrid
sgMail.setApiKey(process.env.VITE_SENDGRID_API_KEY);

// Store task progress in memory (replace with database in production)
const taskProgress = new Map();
const referenceTexts = new Map();

// Helper function to normalize text
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Updated progress calculation function
function calculateProgress(inputText, referenceText) {
  if (!inputText || !referenceText) return 0;

  const normalizedInput = normalizeText(inputText);
  const normalizedReference = normalizeText(referenceText);

  const inputWords = normalizedInput.split(/\s+/);
  const referenceWords = normalizedReference.split(/\s+/);

  let maxMatchLength = 0;
  
  // Use sliding window approach to find best matching sequence
  for (let i = 0; i <= referenceWords.length - inputWords.length; i++) {
    let currentMatches = 0;
    for (let j = 0; j < inputWords.length; j++) {
      if (referenceWords[i + j] === inputWords[j]) {
        currentMatches++;
      }
    }
    maxMatchLength = Math.max(maxMatchLength, currentMatches);
  }

  return (maxMatchLength / referenceWords.length) * 100;
}

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;
    
    const msg = {
      to,
      from: process.env.VITE_FROM_EMAIL,
      subject,
      html,
    };

    await sgMail.send(msg);
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get reference text content
app.get('/api/tasks/:taskId/reference', async (req, res) => {
  try {
    const { taskId } = req.params;
    const filePath = path.join(__dirname, 'reference_texts', `${taskId}.txt`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    referenceTexts.set(taskId, content);
    
    res.json({ totalWords: content.trim().split(/\s+/).length });
  } catch (error) {
    console.error('Error reading reference text:', error);
    res.status(404).json({ error: 'Reference text not found' });
  }
});

// Get task progress
app.get('/api/tasks/:taskId/progress', (req, res) => {
  const { taskId } = req.params;
  const { userId } = req.query;
  
  const key = `${taskId}-${userId}`;
  const progress = taskProgress.get(key) || {
    currentText: '',
    progress: 0,
    lastSaved: new Date().toISOString(),
    isCompleted: false
  };
  
  res.json(progress);
});

// Check task progress
app.post('/api/tasks/check-progress', (req, res) => {
  const { taskId, userId, text } = req.body;
  
  const referenceText = referenceTexts.get(taskId);
  if (!referenceText) {
    return res.status(404).json({ error: 'Reference text not found' });
  }
  
  // Always recalculate progress
  const progress = calculateProgress(text, referenceText);
  const key = `${taskId}-${userId}`;
  
  const progressData = {
    currentText: text,
    progress,
    lastSaved: new Date().toISOString(),
    isCompleted: progress === 100
  };
  
  // Update progress regardless of previous state
  taskProgress.set(key, progressData);
  res.json(progressData);
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    emailService: 'SendGrid',
    version: '1.0.0'
  });
});

// Serve static files from the appropriate directory based on environment
const staticDir = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'dist')
  : path.join(__dirname, 'public');

app.use(express.static(staticDir));

// For any route not handled by API, serve index.html
// Using a more compatible approach for catch-all routes
app.use((req, res, next) => {
  // Skip if the request is for an API endpoint
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip if the request is for a static file
  if (req.path.includes('.')) {
    return next();
  }
  
  // Serve index.html for all other routes
  const indexPath = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'dist', 'index.html')
    : path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Serving static files from: ${staticDir}`);
}); 