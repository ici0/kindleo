// looks like this isnt working on kindle (works in chrome though)
// document.addEventListener('DOMContentLoaded', function() {

// KEYBOARD not needed too
//     // // KEYBOARD
//     // document.addEventListener('keydown', function(event) {
//     //     if (event.key === "ArrowLeft") {
//     //         document.getElementById('forgotBtn').click();
//     //     } else if (event.key === "ArrowRight") {
//     //         document.getElementById('knowBtn').click();
//     //     }
//     // });

// });



const dictionary = [
    { word: "amigo", translation: 'friend', transcription: "[aˈmiɣo]", score: 0 },
    { word: "casa", translation: "house", transcription: "[ˈkasa]", score: 0},
    { word: "perro", translation: "dog", transcription: "[ˈpero]", score: 0 },
    { word: "gato", translation: "cat", transcription: "[ˈɡato]" },
    { word: "libro", translation: "book", transcription: "[ˈlibɾo]" },
    { word: "manzana", translation: "apple", transcription: "[manˈθana]" },
    { word: "agua", translation: "water", transcription: "[ˈaɣwa]" },
    { word: "sol", translation: "sun", transcription: "[sol]" },
    { word: "luna", translation: "moon", transcription: "[ˈluna]" },
    { word: "estrella", translation: "star", transcription: "[esˈtɾeʎa]" },
    { word: "cielo", translation: "sky", transcription: "[ˈθjelo]" },
    { word: "mar", translation: "sea", transcription: "[mar]" },
    { word: "montaña", translation: "mountain", transcription: "[monˈtaɲa]" },
    { word: "río", translation: "river", transcription: "[ˈri.o]" },
    { word: "bosque", translation: "forest", transcription: "[ˈboske]" },
    { word: "camino", translation: "path", transcription: "[kaˈmino]" },
    { word: "flor", translation: "flower", transcription: "[flor]" },
    { word: "pájaro", translation: "bird", transcription: "[ˈpa.xa.ɾo]" },
    { word: "pez", translation: "fish", transcription: "[peθ]" },
    { word: "ciudad", translation: "city", transcription: "[θjuˈðað]" }
];

currentIndex = 0;

function showWord() {
    document.getElementById('word').innerHTML = dictionary[currentIndex].word;
    document.getElementById('forgotBtn').style.display = 'inline';
    document.getElementById('knowBtn').style.display = 'inline';
    document.getElementById('answer').style.visibility = 'hidden';
    document.getElementById('checkMark').style.visibility = 'hidden';
}


function nextWord() {
    currentIndex++;
    // TODO: goto victory page
    if (currentIndex >= dictionary.length) currentIndex = 0;
    showWord();
}


function showAnswer() {
    document.getElementById('forgotBtn').style.display = 'none';
    document.getElementById('knowBtn').style.display = 'none'; 
    // Using innerHTML instead of textContent for `<br>`
    document.getElementById('answer').innerHTML = dictionary[currentIndex].translation +
        "<br>" +
        dictionary[currentIndex].transcription
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
    dictionary[currentIndex].score++  // TODO: select words to train by score
    showAnswer()
    setTimeout(nextWord, 2000);
});


showWord();