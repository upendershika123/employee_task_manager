import express from 'express';
import cors from 'cors';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SendGrid
sgMail.setApiKey(process.env.VITE_SENDGRID_API_KEY);

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
    
    // Get reference text from tasks table
    const { data: task, error } = await supabase
      .from('tasks')
      .select('description')
      .eq('id', taskId)
      .single();
    
    if (error) throw error;
    if (!task?.description) {
      return res.status(404).json({ error: 'Reference text not found' });
    }
    
    res.json({ 
      content: task.description,
      totalWords: task.description.trim().split(/\s+/).length 
    });
  } catch (error) {
    console.error('Error reading reference text:', error);
    res.status(404).json({ error: 'Reference text not found' });
  }
});

// Get task progress
app.get('/api/tasks/:taskId/progress', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.query;
    
    // Get the latest progress entry
    const { data, error } = await supabase
      .from('task_input_history')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }
    
    const progress = data || {
      input_text: '',
      progress: 0,
      created_at: new Date().toISOString()
    };
    
    res.json({
      currentText: progress.input_text,
      progress: progress.progress,
      lastSaved: progress.created_at,
      isCompleted: progress.progress === 100
    });
  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Check task progress
app.post('/api/tasks/check-progress', async (req, res) => {
  try {
    const { taskId, userId, text } = req.body;
    
    // Get reference text from tasks table
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('description')
      .eq('id', taskId)
      .single();
    
    if (taskError) throw taskError;
    if (!task?.description) {
      return res.status(404).json({ error: 'Reference text not found' });
    }
    
    // Calculate progress
    const progress = calculateProgress(text, task.description);
    
    // Save progress to database
    const { error: saveError } = await supabase
      .from('task_input_history')
      .upsert({
        task_id: taskId,
        input_text: text,
        progress: Math.round(progress),
        created_at: new Date().toISOString()
      });
    
    if (saveError) throw saveError;
    
    const progressData = {
      currentText: text,
      progress,
      lastSaved: new Date().toISOString(),
      isCompleted: progress === 100
    };
    
    res.json(progressData);
  } catch (error) {
    console.error('Error checking progress:', error);
    res.status(500).json({ error: 'Failed to check progress' });
  }
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
