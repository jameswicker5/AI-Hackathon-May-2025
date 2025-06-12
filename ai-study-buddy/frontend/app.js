// OCR using Tesseract.js
async function processImage(imageData) {
    try {
        const result = await Tesseract.recognize(imageData, 'eng', {
            logger: m => console.log(m),
        });
        const extractedText = result.data.text || "No text found.";

        // Save OCR text
        await fetch('http://localhost:3000/save-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'raw_texts_ocr.txt',
                text: extractedText
            })
        });

        return extractedText;
    } catch (error) {
        console.error('OCR error:', error);
        throw new Error('Failed to process image');
    }
}

// Handle image capture from camera
async function captureImage() {
    const resultElement = document.getElementById('aiOutput');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Stop camera
        stream.getTracks().forEach(track => track.stop());

        // Get image data
        const imageData = canvas.toDataURL('image/jpeg');

        // Process image
        resultElement.innerHTML = `
            <div style="color: #0c5460; background-color: #d1ecf1; padding: 10px; border-radius: 5px;">
                Processing image... Please wait.
            </div>
        `;

        const text = await processImage(imageData);

        resultElement.innerHTML = `
            <div style="color: #155724; background-color: #d4edda; padding: 10px; border-radius: 5px;">
                <p><strong>Image processed successfully!</strong></p>
                <p>${text}</p>
            </div>
        `;
    } catch (error) {
        resultElement.innerHTML = `
            <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
    }
}

// Web scraping
async function scrapeWebsite(url) {
    const resultElement = document.getElementById('aiOutput');
    resultElement.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i> Scraping website... Please wait.
        </div>
    `;

    try {
        console.log('Scraping URL:', url);
        const response = await fetch(`http://localhost:3000/scrape?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to scrape website');
        }

        // Save scraped text
        console.log('Saving scraped text...');
        const saveResponse = await fetch('http://localhost:3000/save-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'raw_texts_scraped.txt',
                text: data.text
            })
        });

        if (!saveResponse.ok) {
            throw new Error('Failed to save scraped text');
        }

        // Add the scraped text to the URL list
        const urlList = document.getElementById('urlList');
        const textElement = document.createElement('div');
        textElement.className = 'url-item scraped-content';
        textElement.innerHTML = `
            <div class="url-content">
                <span class="url-text">${data.text}</span>
            </div>
            <button class="delete-button" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        urlList.appendChild(textElement);

        resultElement.innerHTML = `
            <div class="success">
                <i class="fas fa-check-circle"></i> Website scraped successfully!
            </div>
        `;
    } catch (error) {
        console.error('Scraping error:', error);
        resultElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
            </div>
        `;
    }
}

// Get YouTube transcript
async function getYouTubeTranscript(url) {
    const resultElement = document.getElementById('aiOutput');
    resultElement.innerHTML = `
        <div style="color: #0c5460; background-color: #d1ecf1; padding: 10px; border-radius: 5px;">
            Getting transcript... Please wait.
        </div>
    `;

    try {
        const response = await fetch(`http://localhost:3000/youtube-transcript?url=${encodeURIComponent(url)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to get transcript');
        }

        resultElement.innerHTML = `
            <div style="color: #155724; background-color: #d4edda; padding: 10px; border-radius: 5px;">
                <p><strong>Transcript successfully retrieved!</strong></p>
                <p>${data.text}</p>
            </div>
        `;
    } catch (error) {
        resultElement.innerHTML = `
            <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                <p><strong>Error:</strong> ${error.message}</p>
                <p>Make sure the video has captions available.</p>
            </div>
        `;
    }
}

// Audio recording variables
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let transcriptionInterval;

// Stop recording function
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        // Stop all audio tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        // Hide recording controls
        const recordingControls = document.getElementById('recordingControls');
        recordingControls.style.display = 'none';
    }
}

// Handle audio recording
async function handleAudioUpload() {
    console.log('handleAudioUpload called');
    if (!isRecording) {
        try {
            // Initialize speech recognition
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            let finalTranscript = '';
            let interimTranscript = '';
            let restartAttempts = 0;
            const MAX_RESTART_ATTEMPTS = 10;

            // Show recording controls
            const recordingControls = document.getElementById('recordingControls');
            const recordingStatus = document.getElementById('recordingStatus');
            recordingControls.style.display = 'flex';
            recordingStatus.textContent = 'Recording...';

            // Show transcript container
            const transcriptContainer = document.getElementById('transcriptContainer');
            const transcriptText = document.getElementById('transcriptText');
            transcriptContainer.style.display = 'block';
            transcriptText.innerHTML = '<div class="recording-status">Listening...</div>';

            recognition.onresult = (event) => {
                interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                // Update the transcript display
                transcriptText.innerHTML = `
                    <div style="background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 15px;">
                        <p style="white-space: pre-wrap;">${finalTranscript}</p>
                        <p style="color: #666; font-style: italic;">${interimTranscript}</p>
                    </div>
                `;

                // Only auto-scroll if we're still recording
                if (isRecording) {
                    transcriptText.scrollTop = transcriptText.scrollHeight;
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);

                // Handle specific errors
                if (event.error === 'no-speech') {
                    // This is a common error that we can ignore and continue
                    return;
                }

                if (event.error === 'network') {
                    transcriptText.innerHTML = `
                        <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                            Network error. Attempting to reconnect...
                        </div>
                    `;
                    // Try to restart recognition
                    if (isRecording && restartAttempts < MAX_RESTART_ATTEMPTS) {
                        setTimeout(() => {
                            recognition.start();
                            restartAttempts++;
                        }, 1000);
                    }
                    return;
                }

                // For other errors, show the error message
                transcriptText.innerHTML = `
                    <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                        Error: ${event.error}
                    </div>
                `;

                // Only stop recording for critical errors
                if (event.error === 'aborted' || event.error === 'audio-capture' || event.error === 'not-allowed') {
                    stopRecording();
                }
            };

            recognition.onend = () => {
                if (isRecording && restartAttempts < MAX_RESTART_ATTEMPTS) {
                    console.log('Recognition ended, restarting...');
                    setTimeout(() => {
                        try {
                            recognition.start();
                            restartAttempts++;
                        } catch (error) {
                            console.error('Error restarting recognition:', error);
                        }
                    }, 100);
                } else if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                    console.log('Max restart attempts reached');
                    stopRecording();
                }
            };

            // Start recording
            recognition.start();
            isRecording = true;
            restartAttempts = 0;

            // Update the stop recording function
            window.stopRecording = () => {
                if (isRecording) {
                    recognition.stop();
                    isRecording = false;
                    recordingControls.style.display = 'none';

                    // Show transcript and automatically save
                    const transcriptContainer = document.getElementById('transcriptContainer');
                    const transcriptText = document.getElementById('transcriptText');
                    transcriptContainer.style.display = 'block';
                    transcriptText.innerHTML = `
                        <div style="background-color: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 15px;">
                            <p style="white-space: pre-wrap;">${finalTranscript}</p>
                        </div>
                        <div style="color: #0c5460; background-color: #d1ecf1; padding: 10px; border-radius: 5px;">
                            <i class="fas fa-spinner fa-spin"></i> Saving transcript... Please wait.
                        </div>
                    `;

                    // Add a delay before saving to ensure all audio is processed
                    setTimeout(async () => {
                        try {
                            // Automatically save the transcript
                            await saveTranscript(finalTranscript);

                            // Show success message
                            transcriptText.innerHTML = `
                                <div style="color: #155724; background-color: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                                    <p><strong>Transcript saved successfully!</strong></p>
                                    <p>${finalTranscript}</p>
                                </div>
                            `;

                            // Keep the container visible for a few seconds before hiding
                            setTimeout(() => {
                                transcriptContainer.style.display = 'none';
                            }, 3000);
                        } catch (error) {
                            console.error('Error saving transcript:', error);
                            transcriptText.innerHTML = `
                                <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                                    <p><strong>Error saving transcript:</strong> ${error.message}</p>
                                </div>
                            `;
                        }
                    }, 1000); // 1 second delay before saving
                }
            };

        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Error accessing microphone. Please make sure you have granted microphone permissions.');
        }
    }
}

// Save transcript function
async function saveTranscript(transcript) {
    try {
        // Save to text file on server
        const saveResponse = await fetch('http://localhost:3000/save-text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: 'raw_texts_transcription.txt',
                text: transcript
            })
        });

        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.details || errorData.error || 'Failed to save transcript');
        }

        // Add the transcribed text to the URL list
        const urlList = document.getElementById('urlList');
        const textElement = document.createElement('div');
        textElement.className = 'url-item';
        const timestamp = new Date().toLocaleString();
        textElement.innerHTML = `
            <div class="url-content">
                <div class="url-header">
                    <span class="url-source">Audio Transcript - ${timestamp}</span>
                    <button class="delete-button" onclick="this.closest('.url-item').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="url-text">${transcript}</div>
            </div>
        `;
        urlList.appendChild(textElement);

        // Update the saved texts list
        await updateSavedTextsList();

        // Show success message in the transcript container
        const transcriptContainer = document.getElementById('transcriptContainer');
        const transcriptText = document.getElementById('transcriptText');
        transcriptText.innerHTML = `
            <div style="color: #155724; background-color: #d4edda; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <p><strong>Transcript saved successfully!</strong></p>
                <p><small>Recording session: ${timestamp}</small></p>
                <p>${transcript}</p>
            </div>
        `;

        // Keep the container visible for a few seconds before hiding
        setTimeout(() => {
            transcriptContainer.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error saving transcript:', error);
        const transcriptText = document.getElementById('transcriptText');
        transcriptText.innerHTML = `
            <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
    }
}

function discardTranscript() {
    // Clear the transcript container
    const transcriptContainer = document.getElementById('transcriptContainer');
    transcriptContainer.style.display = 'none';
}

// Make functions available globally
window.handleAudioUpload = handleAudioUpload;
window.stopRecording = stopRecording;
window.saveTranscript = saveTranscript;
window.discardTranscript = discardTranscript;

// Handle URL input
async function handleUrlInput() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    if (!url) return;

    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await getYouTubeTranscript(url);
        } else {
            await scrapeWebsite(url);
        }
        urlInput.value = '';
        await updateSavedTextsList();
    } catch (error) {
        console.error('Error processing URL:', error);
        const resultElement = document.getElementById('aiOutput');
        resultElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
            </div>
        `;
    }
}

// Update saved texts dropdown
async function updateSavedTextsList() {
    try {
        const response = await fetch('http://localhost:3000/list-saved-texts');
        const data = await response.json();

        const dropdown = document.getElementById('savedTextsDropdown');
        dropdown.innerHTML = '<option value="">Select a saved text...</option>';

        data.files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file;
            dropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating saved texts list:', error);
    }
}

// Load saved text content
async function loadSavedText() {
    const dropdown = document.getElementById('savedTextsDropdown');
    const selectedFile = dropdown.value;
    const contentDiv = document.getElementById('savedTextContent');
    const deleteButton = document.getElementById('deleteSavedText');

    if (!selectedFile) {
        contentDiv.textContent = '';
        deleteButton.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/get-saved-text?file=${encodeURIComponent(selectedFile)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load text');
        }

        contentDiv.textContent = data.text;
        deleteButton.style.display = 'flex';
    } catch (error) {
        console.error('Error loading saved text:', error);
        contentDiv.textContent = `Error loading text: ${error.message}`;
        deleteButton.style.display = 'none';
    }
}

// Delete saved text
async function deleteSavedText() {
    const dropdown = document.getElementById('savedTextsDropdown');
    const selectedFile = dropdown.value;

    if (!selectedFile) {
        return;
    }

    if (!confirm(`Are you sure you want to delete "${selectedFile}"?`)) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/delete-saved-text?file=${encodeURIComponent(selectedFile)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete file');
        }

        // Clear the content and update the dropdown
        document.getElementById('savedTextContent').textContent = '';
        document.getElementById('deleteSavedText').style.display = 'none';
        await updateSavedTextsList();
    } catch (error) {
        console.error('Error deleting saved text:', error);
        alert(`Error deleting file: ${error.message}`);
    }
}

// Make functions available globally
window.deleteSavedText = deleteSavedText;

// Generate notes function
async function generateNotes() {
    const resultElement = document.getElementById('aiOutput');
    resultElement.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i> Generating notes... Please wait.
        </div>
    `;

    try {
        // Get selected sources
        const selectedSources = Array.from(document.querySelectorAll('input[name="noteSource"]:checked'))
            .map(checkbox => checkbox.value);

        if (selectedSources.length === 0) {
            throw new Error('Please select at least one source for note generation');
        }

        const response = await fetch(`http://localhost:3000/generate-notes?source=${selectedSources.join(',')}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate notes');
        }

        resultElement.innerHTML = `
            <div class="success">
                <h3>Generated Notes</h3>
                <div class="content-box">
                    ${data.notes}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error generating notes:', error);
        resultElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
            </div>
        `;
    }
}

// Generate quiz function
async function generateQuiz() {
    const resultElement = document.getElementById('aiOutput');
    resultElement.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i> Generating quiz... Please wait.
        </div>
    `;

    try {
        // Get selected sources
        const selectedSources = Array.from(document.querySelectorAll('input[name="quizSource"]:checked'))
            .map(checkbox => checkbox.value);

        if (selectedSources.length === 0) {
            throw new Error('Please select at least one source for quiz generation');
        }

        const response = await fetch(`http://localhost:3000/generate-quiz?source=${selectedSources.join(',')}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate quiz');
        }

        // Create quiz HTML
        const quizHTML = `
            <div class="success">
                <h3>Generated Quiz</h3>
                <div class="interactive-quiz">
                    ${data.questions.map((q, index) => `
                        <div class="question-container">
                            <p class="question-text">${index + 1}. ${q.question}</p>
                            <div class="options">
                                ${Object.entries(q.options).map(([key, value]) => `
                                    <div class="option">
                                        <label class="option-label">
                                            <input type="radio" name="q${index}" value="${key}" onchange="checkSingleAnswer(${index}, '${key}', '${q.correct}')">
                                            <span class="option-text">${key}) ${value}</span>
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="feedback" id="feedback${index}" style="display: none;"></div>
                        </div>
                    `).join('')}
                    <div class="quiz-summary" id="quizSummary" style="display: none;">
                        <h4>Quiz Summary</h4>
                        <p>Score: <span id="score">0</span> out of ${data.questions.length} (<span id="percentage">0</span>%)</p>
                    </div>
                </div>
            </div>
        `;

        resultElement.innerHTML = quizHTML;
    } catch (error) {
        console.error('Error generating quiz:', error);
        resultElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-circle"></i> Error: ${error.message}
            </div>
        `;
    }
}

// Check single answer function
function checkSingleAnswer(questionIndex, selectedAnswer, correctAnswer) {
    const feedbackElement = document.getElementById(`feedback${questionIndex}`);
    const quizSummary = document.getElementById('quizSummary');
    const scoreElement = document.getElementById('score');
    const percentageElement = document.getElementById('percentage');

    if (selectedAnswer === correctAnswer) {
        feedbackElement.innerHTML = `
            <div class="feedback-correct">
                <i class="fas fa-check-circle"></i> Correct!
            </div>
        `;
    } else {
        feedbackElement.innerHTML = `
            <div class="feedback-incorrect">
                <i class="fas fa-times-circle"></i> Incorrect. The correct answer is ${correctAnswer}
            </div>
        `;
    }
    feedbackElement.style.display = 'block';

    // Update score
    const totalQuestions = document.querySelectorAll('.question-container').length;
    const correctAnswers = document.querySelectorAll('.feedback-correct').length;
    const score = correctAnswers;
    const percentage = Math.round((score / totalQuestions) * 100);

    scoreElement.textContent = score;
    percentageElement.textContent = percentage;
    quizSummary.style.display = 'block';
}

// Make functions available globally
window.generateNotes = generateNotes;
window.generateQuiz = generateQuiz;
window.checkSingleAnswer = checkSingleAnswer;

// Handle file upload for OCR
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const resultElement = document.getElementById('aiOutput');
    resultElement.innerHTML = `
        <div style="color: #0c5460; background-color: #d1ecf1; padding: 10px; border-radius: 5px;">
            Processing image... Please wait.
        </div>
    `;

    try {
        // Create a FileReader to read the image
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imageData = e.target.result;
                const text = await processImage(imageData);

                // Add the OCR text to the URL list
                const urlList = document.getElementById('urlList');
                const textElement = document.createElement('div');
                textElement.className = 'url-item';
                textElement.innerHTML = `
                    <div class="url-content">
                        <div class="url-header">
                            <span class="url-source">OCR Text</span>
                            <button class="delete-button" onclick="this.closest('.url-item').remove()">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="url-text">${text}</div>
                    </div>
                `;
                urlList.appendChild(textElement);

                // Update the saved texts list
                await updateSavedTextsList();

                resultElement.innerHTML = `
                    <div style="color: #155724; background-color: #d4edda; padding: 10px; border-radius: 5px;">
                        <p><strong>Image processed successfully!</strong></p>
                        <p>${text}</p>
                    </div>
                `;
            } catch (error) {
                resultElement.innerHTML = `
                    <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                        <p><strong>Error:</strong> ${error.message}</p>
                    </div>
                `;
            }
        };

        reader.onerror = () => {
            resultElement.innerHTML = `
                <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                    <p><strong>Error:</strong> Failed to read the image file.</p>
                </div>
            `;
        };

        // Read the image as data URL
        reader.readAsDataURL(file);
    } catch (error) {
        resultElement.innerHTML = `
            <div style="color: #721c24; background-color: #f8d7da; padding: 10px; border-radius: 5px;">
                <p><strong>Error:</strong> ${error.message}</p>
            </div>
        `;
    }
}

// Make functions available globally
window.handleFileUpload = handleFileUpload;

// Initialize saved texts list when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateSavedTextsList();
    // Add event listener for saved texts dropdown
    const savedTextsDropdown = document.getElementById('savedTextsDropdown');
    if (savedTextsDropdown) {
        savedTextsDropdown.addEventListener('change', loadSavedText);
    }
});