// Kindle-compatible ES5 JavaScript for flashcard training
// No const/let, no arrow functions, no template literals

// =============================================================================
// CONFIGURATION
// =============================================================================

var CONFIG = {
    REMOTE_URL: null,  // Set to API endpoint URL or null for offline-only
    LOCAL_PATH: '../lingualeo-export/all_words.json',
    SESSION_SIZE: 3,
    KNOW_DELAY: 500,
    FORGOT_DELAY: 4000,
    NETWORK_TIMEOUT: 3000
};

// =============================================================================
// DATA MANAGER - Handles loading and persistence
// =============================================================================

// Helper to strip surrounding quotes from strings
function stripQuotes(str) {
    if (!str) return '';
    // Remove leading quotes
    while (str.charAt(0) === '"') {
        str = str.substring(1);
    }
    // Remove trailing quotes
    while (str.charAt(str.length - 1) === '"') {
        str = str.substring(0, str.length - 1);
    }
    return str;
}

var DataManager = {
    fullDictionary: [],

    // Load dictionary from remote or local source
    loadDictionary: function(callback) {
        var self = this;

        if (CONFIG.REMOTE_URL) {
            this._tryRemote(function(success, data) {
                if (success) {
                    self._processDictionary(data);
                    callback();
                } else {
                    self._loadLocal(callback);
                }
            });
        } else {
            this._loadLocal(callback);
        }
    },

    // Try loading from remote endpoint with timeout
    _tryRemote: function(callback) {
        var xhr = new XMLHttpRequest();
        var timedOut = false;

        var timeout = setTimeout(function() {
            timedOut = true;
            xhr.abort();
            callback(false, null);
        }, CONFIG.NETWORK_TIMEOUT);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && !timedOut) {
                clearTimeout(timeout);
                if (xhr.status === 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        callback(true, data);
                    } catch (e) {
                        callback(false, null);
                    }
                } else {
                    callback(false, null);
                }
            }
        };

        xhr.open('GET', CONFIG.REMOTE_URL, true);
        xhr.send();
    },

    // Load from local file
    _loadLocal: function(callback) {
        var self = this;
        var xhr = new XMLHttpRequest();

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200 || xhr.status === 0) {  // 0 for file://
                    try {
                        var data = JSON.parse(xhr.responseText);
                        self._processDictionary(data);
                        callback();
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        };

        xhr.open('GET', CONFIG.LOCAL_PATH, true);
        xhr.send();
    },

    // Process loaded dictionary and merge with localStorage
    _processDictionary: function(jsonData) {
        var savedProgress = this.loadProgress();

        for (var i = 0; i < jsonData.length; i++) {
            var item = jsonData[i];
            var wordId = item.id || i;

            var word = {
                id: wordId,
                word: item.wd || item.nwd || '',
                translation: stripQuotes(item.tr),
                transcription: '',  // JSON has audio URL, not text transcription
                context: stripQuotes(item.ctx),
                contextTranslation: item.ctx_tr || '',
                partOfSpeech: item.pos || '',
                score: item.sp || 0
            };

            // Override with localStorage if exists
            if (savedProgress[wordId]) {
                word.score = savedProgress[wordId].score;
                word.lastSeen = savedProgress[wordId].lastSeen;
            }

            this.fullDictionary.push(word);
        }
    },

    // Load progress from localStorage
    loadProgress: function() {
        try {
            var saved = localStorage.getItem('flashcard_progress');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    },

    // Save progress to localStorage
    saveProgress: function() {
        try {
            var progress = {};
            for (var i = 0; i < this.fullDictionary.length; i++) {
                var word = this.fullDictionary[i];
                progress[word.id] = {
                    score: word.score,
                    lastSeen: word.lastSeen || 0
                };
            }
            localStorage.setItem('flashcard_progress', JSON.stringify(progress));
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    },

    // Increment score for a word
    incrementScore: function(wordId) {
        for (var i = 0; i < this.fullDictionary.length; i++) {
            if (this.fullDictionary[i].id === wordId) {
                this.fullDictionary[i].score++;
                this.fullDictionary[i].lastSeen = Date.now();
                this.saveProgress();
                break;
            }
        }
    },

    // Mark word as seen (for "I know" action)
    markSeen: function(wordId) {
        for (var i = 0; i < this.fullDictionary.length; i++) {
            if (this.fullDictionary[i].id === wordId) {
                this.fullDictionary[i].lastSeen = Date.now();
                this.saveProgress();
                break;
            }
        }
    }
};

// =============================================================================
// WORD SELECTOR - Fast O(n) score-based selection
// =============================================================================

var WordSelector = {
    // Select words for a session using optimized bucketing
    selectSession: function(dictionary, sessionSize) {
        var highScore = [];  // score >= 2
        var medScore = [];   // score == 1
        var lowScore = [];   // score == 0

        // Single-pass bucketing - O(n)
        for (var i = 0; i < dictionary.length; i++) {
            var word = dictionary[i];
            if (word.score >= 2) {
                highScore.push(word);
            } else if (word.score === 1) {
                medScore.push(word);
            } else {
                lowScore.push(word);
            }
        }

        // Priority selection: high -> med -> low
        var selected = [];

        // Take from high score bucket
        var shuffledHigh = this._shuffle(highScore);
        for (var i = 0; i < shuffledHigh.length && selected.length < sessionSize; i++) {
            selected.push(shuffledHigh[i]);
        }

        // Fill remaining from medium score
        if (selected.length < sessionSize) {
            var shuffledMed = this._shuffle(medScore);
            for (var i = 0; i < shuffledMed.length && selected.length < sessionSize; i++) {
                selected.push(shuffledMed[i]);
            }
        }

        // Fill remaining from low score
        if (selected.length < sessionSize) {
            var shuffledLow = this._shuffle(lowScore);
            for (var i = 0; i < shuffledLow.length && selected.length < sessionSize; i++) {
                selected.push(shuffledLow[i]);
            }
        }

        // Final shuffle for variety in presentation order
        return this._shuffle(selected);
    },

    // Fisher-Yates shuffle - O(n)
    _shuffle: function(array) {
        var arr = array.slice(); // copy array
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }
};

// =============================================================================
// GAME CONTROLLER - UI logic and flow
// =============================================================================

var GameController = {
    sessionWords: [],
    currentIndex: 0,
    forgottenWords: [],
    isKindle: false,
    isProcessing: false,

    // Wait for user input (click, keypress, or touch) before executing callback
    waitForInput: function(callback, delay) {
        var actualDelay = delay || 0;

        setTimeout(function() {
            var handled = false;
            var handleInput = function(event) {
                if (!handled) {
                    handled = true;
                    // Remove all event listeners
                    document.removeEventListener('keydown', handleInput);
                    document.removeEventListener('click', handleInput);
                    document.removeEventListener('touchend', handleInput);
                    callback();
                }
            };

            // Add event listeners (Kindle-compatible without 'once' option)
            document.addEventListener('keydown', handleInput);
            document.addEventListener('click', handleInput);
            document.addEventListener('touchend', handleInput);
        }, actualDelay);
    },

    // Initialize the game
    init: function() {
        var self = this;

        // Detect Kindle
        this.isKindle = navigator.userAgent.indexOf('Kindle') > -1;

        // Apply Kindle-specific styles
        if (this.isKindle) {
            document.body.className = 'kindle-mode';
        }

        // Load dictionary
        DataManager.loadDictionary(function() {
            // Select session words
            self.sessionWords = WordSelector.selectSession(
                DataManager.fullDictionary,
                CONFIG.SESSION_SIZE
            );

            if (self.sessionWords.length === 0) {
                alert('No words available in dictionary!');
                return;
            }

            self.currentIndex = 0;
            self.forgottenWords = [];
            self.isProcessing = false;
            self.setupEventListeners();
            self.showWord();
        });
    },

    // Setup button click handlers
    setupEventListeners: function() {
        var self = this;

        document.getElementById('knowBtn').addEventListener('click', function() {
            self.handleKnow();
        });

        document.getElementById('forgotBtn').addEventListener('click', function() {
            self.handleForgot();
        });

        // Enable keyboard controls for non-Kindle browsers
        if (!this.isKindle) {
            document.addEventListener('keydown', function(event) {
                if (event.key === 'ArrowLeft') {
                    document.getElementById('forgotBtn').click();
                } else if (event.key === 'ArrowRight') {
                    document.getElementById('knowBtn').click();
                }
            });
        }
    },

    // Show current word
    showWord: function() {
        var word = this.sessionWords[this.currentIndex];

        document.getElementById('word').innerHTML = word.word;
        document.getElementById('forgotBtn').style.display = 'inline';
        document.getElementById('knowBtn').style.display = 'inline';
        document.getElementById('answer').style.visibility = 'hidden';
        document.getElementById('context').style.visibility = 'hidden';
        document.getElementById('checkMark').style.visibility = 'hidden';

        // Ready for user input
        this.isProcessing = false;
    },

    // Handle "I know" button
    handleKnow: function() {
        // Prevent multiple clicks during transitions
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;

        var self = this;
        var word = this.sessionWords[this.currentIndex];

        // Mark as seen but don't increment score
        DataManager.markSeen(word.id);

        // Show checkmark
        document.getElementById('checkMark').style.visibility = 'visible';

        // Move to next word after delay
        setTimeout(function() {
            document.getElementById('checkMark').style.visibility = 'hidden';
            self.nextWord();
        }, CONFIG.KNOW_DELAY);
    },

    // Handle "I forgot" button
    handleForgot: function() {
        // Prevent multiple clicks during transitions
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;

        var self = this;
        var word = this.sessionWords[this.currentIndex];

        // Track forgotten word for recap
        this.forgottenWords.push(word);

        // Increment score
        DataManager.incrementScore(word.id);

        // Show answer
        this.showAnswer();

        // Wait for user input to continue (with delay to prevent immediate trigger)
        this.waitForInput(function() {
            self.nextWord();
        }, 300);
    },

    // Show answer card
    showAnswer: function() {
        var word = this.sessionWords[this.currentIndex];

        // Hide buttons
        document.getElementById('forgotBtn').style.display = 'none';
        document.getElementById('knowBtn').style.display = 'none';

        // Show translation
        var answerHtml = '<strong>' + word.translation + '</strong>';
        if (word.transcription) {
            answerHtml += '<br>' + word.transcription;
        }

        document.getElementById('answer').innerHTML = answerHtml;
        document.getElementById('answer').style.visibility = 'visible';

        // Show context if available
        if (word.context && word.context !== '') {
            var contextHtml = '<em>"' + word.context + '"</em>';
            document.getElementById('context').innerHTML = contextHtml;
            document.getElementById('context').style.visibility = 'visible';
        }
    },

    // Move to next word
    nextWord: function() {
        this.currentIndex++;

        if (this.currentIndex >= this.sessionWords.length) {
            this.finishPlay();
        } else {
            this.showWord();
        }
    },

    // Finish play screen with recap
    finishPlay: function() {
        document.getElementById('word').innerHTML = 'Done!';
        document.getElementById('forgotBtn').style.display = 'none';
        document.getElementById('knowBtn').style.display = 'none';
        document.getElementById('checkMark').style.visibility = 'hidden';

        // Show recap if there are forgotten words
        if (this.forgottenWords.length > 0) {
            var recapHtml = '<strong>Words to review (' + this.forgottenWords.length + '):</strong><br><br>';

            for (var i = 0; i < this.forgottenWords.length; i++) {
                var word = this.forgottenWords[i];
                recapHtml += '<strong>' + word.word + '</strong> - ' + word.translation;
                if (word.context && word.context !== '') {
                    recapHtml += '<br><em>"' + word.context + '"</em>';
                }
                recapHtml += '<br><br>';
            }

            document.getElementById('answer').innerHTML = recapHtml;
            document.getElementById('answer').style.visibility = 'visible';
            document.getElementById('context').style.visibility = 'hidden';
        } else {
            // Perfect score - no forgotten words
            document.getElementById('answer').innerHTML = 'Perfect!';
            document.getElementById('answer').style.visibility = 'visible';
            document.getElementById('context').style.visibility = 'hidden';
        }

        // Wait for user input (keypress or tap) to reload
        this.waitForInput(function() {
            window.location.reload();
        });
    }
};

// =============================================================================
// INITIALIZATION
// =============================================================================

// Don't use DOMContentLoaded (doesn't work on Kindle)
// Script is at bottom of HTML, so DOM is ready when this runs
GameController.init();
