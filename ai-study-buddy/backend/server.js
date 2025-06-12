const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { YoutubeTranscript } = require('youtube-transcript');
const speech = require('@google-cloud/speech');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for audio uploads
const upload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            const dir = path.join(__dirname, 'temp');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: function (req, file, cb) {
            cb(null, 'audio-' + Date.now() + '.wav');
        }
    })
});

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Initialize Speech-to-Text client
const speechClient = new speech.SpeechClient();

// Helper function to sanitize filename
function sanitizeFileName(fileName) {
    // Remove any characters that aren't alphanumeric, dash, or underscore
    // But preserve the .txt extension
    const baseName = fileName.replace(/\.txt$/, '');
    return baseName.replace(/[^a-zA-Z0-9-_]/g, '_') + '.txt';
}

// Helper function to read text from a specific file
function getTextFromFile(filename) {
    try {
        const filePath = path.join(__dirname, 'saved_texts', filename);
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filename}:`, error);
        return '';
    }
}

// Helper function to generate text using Google AI
async function generateText(prompt) {
    try {
        // Get the model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Generate content
        const result = await model.generateContent(prompt);
        const response = await result.response;

        return response.text();
    } catch (error) {
        console.error('Google AI error:', error);
        throw new Error(`Google AI error: ${error.message}`);
    }
}

// Helper function to save text to file
function saveTextToFile(filename, text) {
    try {
        console.log('Attempting to save text to file:', filename);
        const dir = path.join(__dirname, 'saved_texts');
        console.log('Target directory:', dir);

        if (!fs.existsSync(dir)) {
            console.log('Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }

        // Sanitize the filename
        const sanitizedFilename = sanitizeFileName(filename);
        const filepath = path.join(dir, sanitizedFilename);
        console.log('Full filepath:', filepath);

        // Add timestamp to the text
        const timestamp = new Date().toLocaleString();
        const textWithTimestamp = `\n\n[Recording Session - ${timestamp}]\n${text}`;

        // Append to file if it exists, otherwise create new file
        if (fs.existsSync(filepath)) {
            fs.appendFileSync(filepath, textWithTimestamp);
        } else {
            fs.writeFileSync(filepath, textWithTimestamp);
        }

        console.log(`Text successfully saved to ${sanitizedFilename}`);
        return filepath;
    } catch (error) {
        console.error('Error saving text to file:', error);
        throw error;
    }
}

// Direct chat endpoint
app.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'No prompt provided' });
        }

        const response = await generateText(prompt);
        res.json({ response });
    } catch (error) {
        console.error('Text generation error:', error);
        res.status(500).json({
            error: 'Failed to generate response',
            details: error.message
        });
    }
});

// Generate notes endpoint
app.get('/generate-notes', async (req, res) => {
    try {
        const source = req.query.source || 'ocr';
        let text = '';

        const sources = source.split(',');
        const sourceFiles = {
            ocr: 'raw_texts_ocr.txt',
            scrape: 'raw_texts_scraped.txt',
            audio: 'raw_texts_transcription.txt',
            youtube: 'raw_texts_youtube.txt'
        };

        // Read and combine text from selected sources
        for (const s of sources) {
            const filename = sourceFiles[s];
            if (filename) {
                const filePath = path.join(__dirname, 'saved_texts', filename);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    if (fileContent) {
                        text += fileContent + '\n\n';
                    }
                }
            }
        }

        if (!text || text.trim().length < 50) {
            return res.status(400).json({
                error: 'Insufficient text content to generate notes',
                details: 'Please add more content from at least one source'
            });
        }

        // Truncate text if it's too long (Gemini has a context limit)
        const maxLength = 30000; // Adjust this based on your needs
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '...';
        }

        const prompt = `Create concise, well-organized study notes from the following text. Use bullet points or numbered lists for clarity. Keep the wording close to the original—do not add explanations or examples. The notes should be simple, skimmable, and easy to review:\n\n${text}`;

        const notes = await generateText(prompt);
        res.json({ notes });
    } catch (error) {
        console.error('Notes generation error:', error);
        res.status(500).json({
            error: 'Failed to generate notes',
            details: error.message
        });
    }
});

// Generate quiz endpoint
app.get('/generate-quiz', async (req, res) => {
    try {
        const source = req.query.source || 'ocr';
        let text = '';

        const sources = source.split(',');
        const sourceFiles = {
            ocr: 'raw_texts_ocr.txt',
            scrape: 'raw_texts_scraped.txt',
            audio: 'raw_texts_transcription.txt',
            youtube: 'raw_texts_youtube.txt'
        };

        // Read and combine text from selected sources
        for (const s of sources) {
            const filename = sourceFiles[s];
            if (filename) {
                const filePath = path.join(__dirname, 'saved_texts', filename);
                if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                    const fileContent = fs.readFileSync(filePath, 'utf8');
                    if (fileContent) {
                        text += fileContent + '\n\n';
                    }
                }
            }
        }

        if (!text || text.trim().length < 50) {
            return res.status(400).json({
                error: 'Insufficient text content to generate quiz',
                details: 'Please add more content from at least one source'
            });
        }

        // Truncate text if it's too long
        const maxLength = 30000; // Adjust this based on your needs
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '...';
        }

        const prompt = `Create a quiz with 5 multiple choice questions based on the following text. For each question, provide 4 options (A, B, C, D) and indicate the correct answer. Format the response as JSON with the following structure:
        {
            "questions": [
                {
                    "question": "Question text",
                    "options": {
                        "A": "Option A",
                        "B": "Option B",
                        "C": "Option C",
                        "D": "Option D"
                    },
                    "correct": "A"
                }
            ]
        }

        Guidelines for questions:
        1. Create questions that test understanding of key concepts from the text
        2. Each question should have one clearly correct answer
        3. Make options plausible but distinct
        4. Cover different aspects of the text
        5. Use clear, concise language
        6. Ensure the JSON format is strictly followed

        Text: ${text}`;

        const quizResponse = await generateText(prompt);

        try {
            // Clean the response to ensure it's valid JSON
            const cleanedResponse = quizResponse.replace(/```json\n?|\n?```/g, '').trim();
            const quiz = JSON.parse(cleanedResponse);

            // Validate the quiz structure
            if (!quiz.questions || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
                throw new Error('Invalid quiz structure');
            }

            // Validate each question
            quiz.questions = quiz.questions.map(q => {
                if (!q.question || !q.options || !q.correct) {
                    throw new Error('Invalid question structure');
                }
                return q;
            });

            res.json(quiz);
        } catch (parseError) {
            console.error('Failed to parse quiz response:', parseError);
            console.error('Raw response:', quizResponse);
            res.status(500).json({
                error: 'Failed to generate valid quiz format',
                details: parseError.message
            });
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({
            error: 'Failed to generate quiz',
            details: error.message
        });
    }
});

// YouTube transcript endpoint
app.get('/youtube-transcript', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'No YouTube URL provided' });
        }

        // Extract video ID from URL
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube video URL.' });
        }

        try {
            // Get transcript
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);

            if (!transcript || transcript.length === 0) {
                return res.status(404).json({
                    error: 'No transcript found for this video. The video might not have captions available.'
                });
            }

            // Combine all transcript parts
            const fullTranscript = transcript
                .map(part => part.text)
                .join(' ');

            // Save transcript to file
            saveTextToFile('raw_texts_youtube.txt', fullTranscript);

            res.json({ text: fullTranscript });
        } catch (transcriptError) {
            console.error('Transcript fetch error:', transcriptError);
            if (transcriptError.message.includes('Could not get the transcript')) {
                return res.status(404).json({
                    error: 'This video does not have captions available. Please try a different video with captions.'
                });
            }
            throw transcriptError;
        }
    } catch (error) {
        console.error('YouTube transcript error:', error);
        res.status(500).json({
            error: 'Failed to get transcript',
            details: error.message,
            suggestion: 'Please make sure the video has captions available and try again.'
        });
    }
});

// Helper function to extract video ID from YouTube URL
function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Keep existing endpoints for OCR and web scraping
app.get('/scrape', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        console.error('Missing URL in scrape request');
        return res.status(400).json({ error: 'Missing URL' });
    }

    console.log('Attempting to scrape URL:', url);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 10000 // 10 second timeout
        });

        const $ = cheerio.load(response.data);
        let scrapedText = '';

        // Remove unwanted elements
        $('script, style, nav, footer, header, iframe, noscript, meta, link').remove();

        // Get text from main content areas
        const contentSelectors = [
            'article', 'main', '.content', '#content', '.main-content', '#main-content',
            '.article-content', '.post-content', '.entry-content', '.post-body',
            'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'
        ];

        contentSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text().trim();
                if (text) {
                    // Add appropriate spacing based on element type
                    if (selector.startsWith('h')) {
                        scrapedText += '\n\n' + text + '\n\n';
                    } else if (selector === 'li') {
                        scrapedText += '• ' + text + '\n';
                    } else if (selector === 'blockquote') {
                        scrapedText += '\n> ' + text + '\n\n';
                    } else {
                        scrapedText += text + '\n\n';
                    }
                }
            });
        });

        // Clean up the text
        scrapedText = scrapedText
            .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();

        if (!scrapedText) {
            console.log('No text content found in the page');
            return res.status(404).json({ error: 'No text content found in the page' });
        }

        console.log('Successfully scraped text from URL');
        res.json({ text: scrapedText });
    } catch (error) {
        console.error('Scrape error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
            return res.status(error.response.status).json({
                error: 'Error scraping the page',
                details: `Server returned status ${error.response.status}`,
                message: error.response.data
            });
        } else if (error.code === 'ECONNABORTED') {
            return res.status(408).json({
                error: 'Request timeout',
                details: 'The website took too long to respond'
            });
        } else if (error.code === 'ENOTFOUND') {
            return res.status(404).json({
                error: 'Website not found',
                details: 'The URL could not be resolved'
            });
        }
        res.status(500).json({
            error: 'Error scraping the page',
            details: error.message
        });
    }
});

// Save text endpoint
app.post('/save-text', (req, res) => {
    console.log('Received save-text request:', req.body);
    const { filename, text } = req.body;

    if (!filename || !text) {
        console.error('Missing filename or text in request');
        return res.status(400).json({ error: 'Missing filename or text' });
    }

    try {
        const savedPath = saveTextToFile(filename, text);
        console.log('File saved at:', savedPath);
        res.json({
            message: 'File saved successfully',
            file: savedPath
        });
    } catch (error) {
        console.error('File write error:', error);
        res.status(500).json({
            error: 'Error saving file',
            details: error.message
        });
    }
});

// Add transcribeAudio function
async function transcribeAudio(audioPath) {
    try {
        console.log('Starting audio transcription for file:', audioPath);

        // Get the model
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // Read the audio file
        const audioData = fs.readFileSync(audioPath);
        console.log('Audio file read successfully, size:', audioData.length);

        // Create a prompt that focuses on accurate transcription
        const prompt = `Please transcribe the following audio accurately. Focus on capturing the exact words spoken, maintaining proper punctuation and formatting. If there are any unclear parts, indicate them with [unclear]. Do not add any interpretation or commentary, just provide the transcription:`;

        console.log('Sending audio to Gemini for transcription...');

        // Generate content from audio
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "audio/wav",
                    data: audioData.toString('base64')
                }
            }
        ]);

        const response = await result.response;
        const transcript = response.text();
        console.log('Received transcript:', transcript);

        // Clean up the transcript
        if (!transcript || transcript.toLowerCase().includes("no speech detected") || transcript.toLowerCase().includes("snoring")) {
            console.log('Invalid transcript detected');
            return "Unable to transcribe audio. Please try speaking more clearly and ensure there is no background noise.";
        }

        return transcript;
    } catch (error) {
        console.error('Detailed transcription error:', error);
        if (error.message.includes('API key')) {
            return "Error: Invalid or missing Google API key. Please check your .env file.";
        } else if (error.message.includes('timeout')) {
            return "Error: Request timed out. Please try again.";
        } else if (error.message.includes('file')) {
            return "Error: Could not read audio file. Please try recording again.";
        }
        return "Error transcribing audio. Please try again.";
    }
}

// Update transcribe endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('No audio file provided in request');
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('Received audio file:', req.file.path);
        const transcript = await transcribeAudio(req.file.path);

        // Clean up the temporary file
        try {
            fs.unlinkSync(req.file.path);
            console.log('Temporary audio file cleaned up');
        } catch (cleanupError) {
            console.error('Error cleaning up temporary file:', cleanupError);
        }

        // Only save if we got a valid transcript
        if (transcript && !transcript.includes("Unable to transcribe audio")) {
            try {
                saveTextToFile('raw_texts_transcription.txt', transcript);
                console.log('Transcript saved successfully');
            } catch (saveError) {
                console.error('Error saving transcript:', saveError);
            }
        }

        res.json({ transcript });
    } catch (error) {
        console.error('Transcription endpoint error:', error);
        res.status(500).json({
            error: 'Failed to transcribe audio',
            details: error.message
        });
    }
});

// Update real-time transcription endpoint
app.post('/transcribe-realtime', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const transcript = await transcribeAudio(req.file.path);

        // Clean up the temporary file
        fs.unlinkSync(req.file.path);

        res.json({ transcript });
    } catch (error) {
        console.error('Error in real-time transcription:', error);
        res.status(500).json({ error: 'Error processing audio' });
    }
});

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// List saved texts
app.get('/list-saved-texts', (req, res) => {
    const savedTextsDir = path.join(__dirname, 'saved_texts');
    fs.readdir(savedTextsDir, (err, files) => {
        if (err) {
            console.error('Error reading saved texts directory:', err);
            return res.status(500).json({ error: 'Failed to list saved texts' });
        }
        res.json({ files: files.filter(file => file.endsWith('.txt')) });
    });
});

// Get saved text content
app.get('/get-saved-text', (req, res) => {
    const filename = req.query.file;
    if (!filename) {
        return res.status(400).json({ error: 'No filename provided' });
    }

    const filePath = path.join(__dirname, 'saved_texts', filename);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading saved text:', err);
            return res.status(500).json({ error: 'Failed to read saved text' });
        }
        res.json({ text: data });
    });
});

// Delete saved text endpoint
app.delete('/delete-saved-text', (req, res) => {
    const filename = req.query.file;
    if (!filename) {
        return res.status(400).json({ error: 'No filename provided' });
    }

    const filePath = path.join(__dirname, 'saved_texts', filename);
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting saved text:', err);
            return res.status(500).json({ error: 'Failed to delete saved text' });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});