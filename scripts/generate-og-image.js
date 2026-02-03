const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create canvas with OG image dimensions
const width = 1200;
const height = 630;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

// Background color
const bgColor = '#080520';
ctx.fillStyle = bgColor;
ctx.fillRect(0, 0, width, height);

// Create subtle gradient overlay for depth
const gradient = ctx.createRadialGradient(600, 315, 0, 600, 315, 600);
gradient.addColorStop(0, 'rgba(100, 50, 150, 0.15)');
gradient.addColorStop(0.5, 'rgba(50, 30, 100, 0.08)');
gradient.addColorStop(1, 'rgba(8, 5, 32, 0)');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);

// Add nebula-like glow effects
function drawNebulaGlow(x, y, radius, color, opacity) {
  const nebulaGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  nebulaGradient.addColorStop(0, `rgba(${color}, ${opacity})`);
  nebulaGradient.addColorStop(0.5, `rgba(${color}, ${opacity * 0.3})`);
  nebulaGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = nebulaGradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

// Add subtle nebula glows
drawNebulaGlow(200, 150, 250, '130, 80, 200', 0.12);
drawNebulaGlow(1000, 500, 300, '60, 100, 180', 0.1);
drawNebulaGlow(600, 400, 400, '80, 50, 150', 0.06);

// Draw stars
function drawStar(x, y, size, brightness) {
  const starGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
  starGradient.addColorStop(0, `rgba(255, 255, 255, ${brightness})`);
  starGradient.addColorStop(0.3, `rgba(200, 210, 255, ${brightness * 0.6})`);
  starGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = starGradient;
  ctx.beginPath();
  ctx.arc(x, y, size * 2, 0, Math.PI * 2);
  ctx.fill();

  // Core of star
  ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
}

// Seed random for consistent results
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Add scattered stars
for (let i = 0; i < 80; i++) {
  const x = seededRandom(i * 3.14159) * width;
  const y = seededRandom(i * 2.71828) * height;
  const size = seededRandom(i * 1.41421) * 1.5 + 0.5;
  const brightness = seededRandom(i * 1.73205) * 0.5 + 0.2;
  drawStar(x, y, size, brightness);
}

// Add a few brighter stars
for (let i = 0; i < 15; i++) {
  const x = seededRandom(i * 7.5 + 100) * width;
  const y = seededRandom(i * 8.3 + 100) * height;
  const size = seededRandom(i * 9.1 + 100) * 2 + 1.5;
  const brightness = 0.7 + seededRandom(i * 10.7 + 100) * 0.3;
  drawStar(x, y, size, brightness);
}

// Add subtle light rays from top
const rayGradient = ctx.createLinearGradient(600, 0, 600, 400);
rayGradient.addColorStop(0, 'rgba(150, 130, 200, 0.03)');
rayGradient.addColorStop(1, 'rgba(150, 130, 200, 0)');
ctx.fillStyle = rayGradient;
ctx.beginPath();
ctx.moveTo(400, 0);
ctx.lineTo(800, 0);
ctx.lineTo(700, 400);
ctx.lineTo(500, 400);
ctx.closePath();
ctx.fill();

// Main title "Fuzion Webz"
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

// Title shadow/glow
ctx.shadowColor = 'rgba(130, 100, 200, 0.5)';
ctx.shadowBlur = 40;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 0;

// Main title
ctx.font = 'bold 96px "Arial", sans-serif';
ctx.fillStyle = '#ffffff';
ctx.fillText('Fuzion Webz', width / 2, height / 2 - 40);

// Reset shadow for subtitle
ctx.shadowBlur = 20;
ctx.shadowColor = 'rgba(130, 100, 200, 0.3)';

// Hebrew subtitle
ctx.font = '36px "Arial", sans-serif';
ctx.fillStyle = 'rgba(200, 190, 230, 0.9)';
ctx.fillText('בניית אתרים מתקדמים', width / 2, height / 2 + 60);

// Add subtle decorative line
ctx.shadowBlur = 0;
const lineGradient = ctx.createLinearGradient(400, 0, 800, 0);
lineGradient.addColorStop(0, 'rgba(130, 100, 200, 0)');
lineGradient.addColorStop(0.5, 'rgba(130, 100, 200, 0.5)');
lineGradient.addColorStop(1, 'rgba(130, 100, 200, 0)');
ctx.strokeStyle = lineGradient;
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(400, height / 2 + 110);
ctx.lineTo(800, height / 2 + 110);
ctx.stroke();

// Add subtle brand accent dots
ctx.fillStyle = 'rgba(130, 100, 200, 0.6)';
ctx.beginPath();
ctx.arc(380, height / 2 + 110, 4, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.arc(820, height / 2 + 110, 4, 0, Math.PI * 2);
ctx.fill();

// Save the image
const outputPath = path.join(__dirname, '..', 'public', 'og-image.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);

console.log(`OG image generated successfully at: ${outputPath}`);
console.log(`Dimensions: ${width}x${height} pixels`);
