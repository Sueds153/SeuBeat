const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegStatic);

const inputPath = 'C:\\Users\\Pagora\\Videos\\TeuSom criativos\\SeuBeat.mp4';
const outputDir = path.join(__dirname, 'public', 'assets');
const outputPath = path.join(outputDir, 'SeuBeat.mp4');

// Create directory if it doesn't exist
if (!fs.existsSync(outputDir)){
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Iniciando compressão do vídeo. Por favor, aguarde alguns instantes...');

ffmpeg(inputPath)
  .outputOptions([
    '-c:v libx264',
    '-crf 28',          // Quality parameter: 28 provides great compression with minimal visible loss
    '-preset faster',
    '-vf scale=-2:1280', // Scale down to 720p/1080p height maintaining aspect ratio
    '-c:a aac',
    '-b:a 128k'         // Compress audio as well
  ])
  .save(outputPath)
  .on('end', () => {
    const stats = fs.statSync(outputPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`Compressão finalizada com sucesso! Novo tamanho: ${sizeInMB} MB`);
  })
  .on('error', (err) => {
    console.error('Ocorreu um erro durante a compressão:', err);
  });
