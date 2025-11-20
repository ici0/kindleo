// looks like this isnt working on kindle (works in chrome though)
 document.addEventListener('DOMContentLoaded', function() {

// KEYBOARD not needed too
      // KEYBOARD
      document.addEventListener('keydown', function(event) {
          if (event.key === "ArrowLeft") {
              document.getElementById('forgotBtn').click();
          } else if (event.key === "ArrowRight") {
              document.getElementById('knowBtn').click();
          }
      });
 });
full_dictionary = []
function parseCSV(data) {
    const lines = data.split('\n');
    full_dictionary = lines.map(line => {
        const [word, translation, transcription] = line.split(',');
        return { word, translation, transcription, score: 0 };
    });
    play_dictionary = getDictionarySubset();
    currentIndex = 0;
    showWord();
}

fetch('../csv/selected_columns_file.csv')
    .then(response => response.text())
    .then(text => parseCSV(text))
    .catch(error => console.error('Error loading the CSV:', error));


function getDictionarySubset(){
    const N = 10;
    return full_dictionary.slice(0, N);
}

function showWord() {
    document.getElementById('word').innerHTML = play_dictionary[currentIndex].word;
    document.getElementById('forgotBtn').style.display = 'inline';
    document.getElementById('knowBtn').style.display = 'inline';
    document.getElementById('answer').style.visibility = 'hidden';
    document.getElementById('checkMark').style.visibility = 'hidden';
}


function nextWord() {
    currentIndex++;
    if (currentIndex >= play_dictionary.length) {
        // TODO: goto victory page
        currentIndex = 0;
        victory()
    }
    showWord();
}

function victory(){
    window.location.href = 'https://ddg.gg';
}

function showAnswer() {
    document.getElementById('forgotBtn').style.display = 'none';
    document.getElementById('knowBtn').style.display = 'none'; 
    // Using innerHTML instead of textContent for `<br>`
    document.getElementById('answer').innerHTML = play_dictionary[currentIndex].translation +
        "<br>" +
        play_dictionary[currentIndex].transcription
    document.getElementById('answer').style.visibility = 'visible';
}


document.getElementById('knowBtn').addEventListener('click', function() {
    document.getElementById('checkMark').style.visibility = 'visible';
    setTimeout(function() {
        document.getElementById('checkMark').style.visibility = 'hidden';
        nextWord();
    }, 500);
});


document.getElementById('forgotBtn').addEventListener('click', function() {
    play_dictionary[currentIndex].score++  // TODO: select words to train by score
    showAnswer()
    setTimeout(nextWord, 2000);
});