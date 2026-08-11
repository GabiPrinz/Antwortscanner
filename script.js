// script.js
let video = document.getElementById("video");
let overlay = document.getElementById("overlay");
let overlayCtx = overlay.getContext("2d");
let info = document.getElementById("info");
let last = document.getElementById("last");

let counts = { A: 0, B: 0, C: 0, D: 0 };
let scanning = false;
let stream = null;
let scanInterval = null;

// Chart
let chartOverlay = document.getElementById("chartOverlay");
let barChart = null;

// Buttons
document.getElementById("startBtn").addEventListener("click", startCamera);
document.getElementById("stopBtn").addEventListener("click", stopCamera);
document.getElementById("resetBtn").addEventListener("click", resetCounts);
document.getElementById("closeChart").addEventListener("click", hideChart);
document.getElementById("continueScan").addEventListener("click", () => { hideChart(); resumeScanning(); });

// Shortcut B
document.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "b") {
    showChart();
  }
});

// Start camera
async function startCamera() {
  if (scanning) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    await video.play();
    resizeOverlay();
    scanning = true;
    scanInterval = setInterval(scanFrame, 150);
    info.textContent = "Kamera läuft. Scanne Karten...";
  } catch (err) {
    info.textContent = "Kamera konnte nicht gestartet werden.";
    console.error(err);
  }
}

// Stop camera
function stopCamera() {
  if (!scanning) return;
  clearInterval(scanInterval);
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  scanning = false;
  info.textContent = "Kamera gestoppt.";
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
}

// Resize overlay canvas to video size
function resizeOverlay() {
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  overlay.style.width = video.offsetWidth + "px";
}

// Reset counts
function resetCounts() {
  counts = { A: 0, B: 0, C: 0, D: 0 };
  updateCountsUI();
  info.textContent = "Zähler zurückgesetzt.";
}

// Scan a frame
function scanFrame() {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

  let tmp = document.createElement("canvas");
  tmp.width = video.videoWidth;
  tmp.height = video.videoHeight;
  let tctx = tmp.getContext("2d");
  tctx.drawImage(video, 0, 0, tmp.width, tmp.height);

  let imageData = tctx.getImageData(0, 0, tmp.width, tmp.height);

  let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "attemptBoth" });

  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

  if (code) {
    drawLine(code.location.topLeftCorner, code.location.topRightCorner, "#FF3B58");
    drawLine(code.location.topRightCorner, code.location.bottomRightCorner, "#FF3B58");
    drawLine(code.location.bottomRightCorner, code.location.bottomLeftCorner, "#FF3B58");
    drawLine(code.location.bottomLeftCorner, code.location.topLeftCorner, "#FF3B58");

    let data = code.data || "unknown";

    let angle = computeAngle(code.location.topLeftCorner, code.location.topRightCorner);

    let answer = angleToOption(angle);

    counts[answer]++;
    updateCountsUI();

    last.textContent = `${data} → ${answer} (Winkel ${Math.round(angle)}°)`;
    info.textContent = `Erkannt: ${data} → ${answer}`;

    let cx = (code.location.topLeftCorner.x + code.location.bottomRightCorner.x) / 2;
    let cy = (code.location.topLeftCorner.y + code.location.bottomRightCorner.y) / 2;
    overlayCtx.fillStyle = "rgba(0,200,0,0.6)";
    overlayCtx.beginPath();
    overlayCtx.arc(cx, cy, 6, 0, Math.PI * 2);
    overlayCtx.fill();

    pauseScanningShort();
  } else {
    info.textContent = "Kein QR-Code erkannt";
  }
}

function drawLine(a, b, color) {
  overlayCtx.strokeStyle = color;
  overlayCtx.lineWidth = 3;
  overlayCtx.beginPath();
  overlayCtx.moveTo(a.x, a.y);
  overlayCtx.lineTo(b.x, b.y);
  overlayCtx.stroke();
}

function computeAngle(a, b) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let rad = Math.atan2(dy, dx);
  let deg = rad * 180 / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function angleToOption(angle) {
  if (inSector(angle, 315, 45)) return "A";
  if (inSector(angle, 45, 135)) return "B";
  if (inSector(angle, 135, 225)) return "C";
  return "D";
}

function inSector(angle, start, end) {
  if (start <= end) return angle >= start && angle < end;
  return angle >= start || angle < end;
}

function updateCountsUI() {
  document.getElementById("countA").textContent = counts.A;
  document.getElementById("countB").textContent = counts.B;
  document.getElementById("countC").textContent = counts.C;
  document.getElementById("countD").textContent = counts.D;
}

function pauseScanningShort() {
  clearInterval(scanInterval);
  setTimeout(() => {
    if (scanning) scanInterval = setInterval(scanFrame, 150);
  }, 700);
}

function showChart() {
  clearInterval(scanInterval);

  chartOverlay.classList.remove("overlayHidden");
  chartOverlay.classList.add("overlayVisible");

  const data = {
    labels: ["A", "B", "C", "D"],
    datasets: [{
      label: "Anzahl",
      data: [counts.A, counts.B, counts.C, counts.D],
      backgroundColor: [
        "rgba(75, 192, 192, 0.7)",
        "rgba(255, 205, 86, 0.7)",
        "rgba(255, 99, 132, 0.7)",
        "rgba(201, 203, 207, 0.7)"
      ],
      borderColor: [
        "rgba(75, 192, 192, 1)",
        "rgba(255, 205, 86, 1)",
        "rgba(255, 99, 132, 1)",
        "rgba(201, 203, 207, 1)"
      ],
      borderWidth: 1
    }]
  };

  const config = {
    type: "bar",
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Antwortverteilung" }
      },
      scales: {
        y: { beginAtZero: true, precision: 0 }
      }
    }
  };

  const ctx = document.getElementById("barChart").getContext("2d");
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, config);
}

function hideChart() {
  chartOverlay.classList.remove("overlayVisible");
  chartOverlay.classList.add("overlayHidden");
}

function resumeScanning() {
  if (!scanning) return;
  clearInterval(scanInterval);
  scanInterval = setInterval(scanFrame, 150);
}

window.addEventListener("resize", () => {
  if (video.videoWidth) resizeOverlay();
});

window.addEventListener("beforeunload", () => {
  if (stream) stream.getTracks().forEach(t => t.stop());
});
