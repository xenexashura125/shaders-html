const container = document.querySelector('#container')
const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d");

let audioSource = null;
let analyser = null;
let audio1 = new Audio();
audio1.src = "music.mp3";
audio1.volume = 0.3
audio1.crossOrigin = "anonymous ";

container.addEventListener("click", function () {
  const audioCtx = new AudioContext(); // for safari browser

  audio1.play();
  audioSource = audioCtx.createMediaElementSource(audio1); // creates an audio node from the audio source
  analyser = audioCtx.createAnalyser(); // creates an audio node for analysing the audio data for time and frequency
  audioSource.connect(analyser); // connects the audio source to the analyser. Now this analyser can explore and analyse the audio data for time and frequency
  analyser.connect(audioCtx.destination); // connects the analyser to the destination. This is the speakers
  analyser.fftSize = 256; // controls the size of the FFT. The FFT is a fast fourier transform. Basically the number of sound samples. Will be used to draw bars in the canvas
  const bufferLength = analyser.frequencyBinCount; // the number of data values that dictate the number of bars in the canvas. Always exactly one half of the fft size
  const dataArray = new Uint8Array(bufferLength); // coverting to unsigned 8-bit integer array format because that's the format we need

  const barWidth = canvas.width / 2 / bufferLength; // the width of each bar in the canvas

  let x = 0; // used to draw the bars one after another. This will get increased by the width of one bar

  function animate() {
    x = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // clears the canvas
    analyser.getByteFrequencyData(dataArray); // copies the frequency data into the dataArray in place. Each item contains a number between 0 and 255
    drawVisualizer({ bufferLength, dataArray, barWidth });
    requestAnimationFrame(animate); // calls the animate function again. This method is built in
  }

  const drawVisualizer = ({ bufferLength, dataArray, barWidth }) => {
    let barHeight;
    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i]; // the height of the bar is the dataArray value. Larger sounds will have a higher value and produce a taller bar
      ctx.fillStyle = `rgb(255,255,255)`;
      ctx.fillRect(
        canvas.width / 2 - x * 2, // this will start the bars at the center of the canvas and move from right to left
        canvas.height - barHeight * 2.5,
        barWidth * 2,
        barHeight * 2.5
      ); // draws the bar. the reason we're calculating Y weird here is because the canvas starts at the top left corner. So we need to start at the bottom left corner and draw the bars from there
      x += barWidth; // increases the x value by the width of the bar
    }

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i]; // the height of the bar is the dataArray value. Larger sounds will have a higher value and produce a taller bar
      ctx.fillStyle = `rgb(255,255,255)`;
      ctx.fillRect(x, canvas.height - barHeight * 2.5, barWidth * 2, barHeight * 4.5); // this will continue moving from left to right
      x += barWidth * 2; // increases the x value by the width of the bar
    }
  };
  animate();
});