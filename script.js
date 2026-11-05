// Database Pengguna Terdaftar Smart Locker IoT
const registeredUsers = {
    "1": "Ahmad Yusuf Musthofa",
    "2": "Alfian Juliano Wardana",
    "3": "Hasna Karima",
    "4": "Hisyam Hibatulloh",
    "5": "Zaky Atha Ramadhan"
};

let systemStatus = "Standby";
let sensorStatus = "Ready";
let fingerprintID = null;
let userName = "-";
let accessGranted = false;
let doorStatus = "Locked";
let lockStatus = true;
let servoAngle = 0;
let scanDuration = 1500;
let lastAccessTime = null;
let successfulAccess = 0;
let failedAccess = 0;
let accessLogs = [];
let doorOpenDuration = 3000;
let autoLockEnabled = true;
let isProcessing = false;

// Audio Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'denied') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
    }
}

const dom = {
    navBadge: document.getElementById('nav-system-badge'),
    navStatusText: document.getElementById('nav-status-text'),
    dashArduino: document.getElementById('dash-arduino'),
    dashSensor: document.getElementById('dash-sensor'),
    dashAuth: document.getElementById('dash-auth'),
    dashDoor: document.getElementById('dash-door'),
    dashLock: document.getElementById('dash-lock'),
    dashSuccess: document.getElementById('dash-success-count'),
    dashFailed: document.getElementById('dash-failed-count'),
    scannerBox: document.getElementById('scanner-box'),
    fpIcon: document.getElementById('fp-icon'),
    btnScan: document.getElementById('btn-scan'),
    userSelect: document.getElementById('user-select'),
    autoLockToggle: document.getElementById('auto-lock-toggle'),
    doorElement: document.getElementById('door-element'),
    doorStatusText: document.getElementById('door-status-text'),
    servoArm: document.getElementById('servo-arm'),
    ledGreen: document.getElementById('led-green'),
    ledRed: document.getElementById('led-red'),
    buzzerIcon: document.getElementById('buzzer-icon'),
    servoHwIcon: document.getElementById('servo-hw-icon'),
    logTableBody: document.getElementById('log-table-body'),
    lcdLine1: document.getElementById('lcd-line1'),
    lcdLine2: document.getElementById('lcd-line2')
};

window.onload = () => { updateUI(); };

dom.autoLockToggle.addEventListener('change', (e) => {
    autoLockEnabled = e.target.checked;
});

function startScan() {
    if (isProcessing) return;
    isProcessing = true;

    resetHardwareIndicators();

    systemStatus = "Scanning";
    sensorStatus = "Scanning";
    dom.scannerBox.classList.add('scanning');
    dom.fpIcon.style.color = "var(--accent)";
    dom.btnScan.disabled = true;

    dom.lcdLine1.innerText = "Memindai Jari...";
    dom.lcdLine2.innerText = "Mohon Tunggu";

    updateUI();

    setTimeout(() => {
        dom.scannerBox.classList.remove('scanning');
        verifyFingerprint();
    }, scanDuration);
}

function verifyFingerprint() {
    systemStatus = "Verifying";
    const selectedValue = dom.userSelect.value;
    lastAccessTime = new Date().toLocaleTimeString('id-ID');

    if (selectedValue !== "invalid" && registeredUsers[selectedValue]) {
        accessGranted = true;
        fingerprintID = parseInt(selectedValue);
        userName = registeredUsers[selectedValue];
        successfulAccess++;
        sensorStatus = "Success";
        
        playSound('success');

        dom.ledGreen.classList.add('active-green');
        dom.buzzerIcon.classList.add('active');
        dom.fpIcon.style.color = "var(--success)";
        
        dom.lcdLine1.innerText = "Akses Diterima!";
        dom.lcdLine2.innerText = userName.substring(0, 16);

        setTimeout(() => dom.buzzerIcon.classList.remove('active'), 300);

        openDoorSequence();

    } else {
        accessGranted = false;
        fingerprintID = 99;
        userName = "Jari Tidak Terdaftar";
        failedAccess++;
        sensorStatus = "Failed";

        playSound('denied');

        dom.ledRed.classList.add('active-red');
        dom.buzzerIcon.classList.add('active');
        dom.fpIcon.style.color = "var(--danger)";
        
        dom.lcdLine1.innerText = "Akses Ditolak!";
        dom.lcdLine2.innerText = "Jari Tak Dikenal";

        setTimeout(() => dom.buzzerIcon.classList.remove('active'), 600);

        systemStatus = "Standby";
        addLogRecord();
        updateUI();
        
        setTimeout(() => {
            resetHardwareIndicators();
            isProcessing = false;
            dom.btnScan.disabled = false;
            sensorStatus = "Ready";
            dom.lcdLine1.innerText = "Tempelkan Jari";
            dom.lcdLine2.innerText = "Untuk Akses";
            updateUI();
        }, 2000);
    }
}

function openDoorSequence() {
    doorStatus = "Unlocking";
    lockStatus = false;
    servoAngle = 90;
    
    dom.servoHwIcon.classList.add('active');
    dom.servoArm.classList.add('unlocked');
    updateUI();

    setTimeout(() => {
        doorStatus = "Open";
        dom.doorElement.classList.add('open');
        updateUI();
        addLogRecord();

        setTimeout(() => {
            if (autoLockEnabled) {
                closeDoorSequence();
            } else {
                systemStatus = "Standby";
                isProcessing = false;
                dom.btnScan.disabled = false;
                updateUI();
            }
        }, doorOpenDuration);

    }, 800);
}

function closeDoorSequence() {
    doorStatus = "Locking";
    updateUI();

    dom.doorElement.classList.remove('open');

    setTimeout(() => {
        doorStatus = "Locked";
        lockStatus = true;
        servoAngle = 0;
        
        dom.servoHwIcon.classList.remove('active');
        dom.servoArm.classList.remove('unlocked');
        
        systemStatus = "Standby";
        sensorStatus = "Ready";
        
        dom.lcdLine1.innerText = "Tempelkan Jari";
        dom.lcdLine2.innerText = "Untuk Akses";

        resetHardwareIndicators();
        isProcessing = false;
        dom.btnScan.disabled = false;
        updateUI();
    }, 1200);
}

function resetHardwareIndicators() {
    dom.ledGreen.classList.remove('active-green');
    dom.ledRed.classList.remove('active-red');
    dom.buzzerIcon.classList.remove('active');
    dom.fpIcon.style.color = "var(--text-gray)";
}

function updateUI() {
    dom.navStatusText.innerText = systemStatus;
    dom.navBadge.className = `system-badge ${systemStatus.toLowerCase()}`;

    dom.dashSensor.innerText = sensorStatus;
    dom.dashSensor.className = `status-val ${sensorStatus === 'Success' ? 'text-green' : sensorStatus === 'Failed' ? 'text-red' : sensorStatus === 'Scanning' ? 'text-yellow' : 'text-gray'}`;

    dom.dashAuth.innerText = accessGranted && systemStatus !== "Standby" ? `Granted (${userName})` : (!accessGranted && sensorStatus === "Failed") ? "Denied" : "Standby";
    dom.dashAuth.className = `status-val ${accessGranted && systemStatus !== "Standby" ? 'text-green' : (!accessGranted && sensorStatus === "Failed") ? 'text-red' : 'text-gray'}`;

    dom.dashDoor.innerText = doorStatus === 'Open' ? 'Terbuka' : 'Terkunci';
    dom.dashDoor.className = `status-val ${doorStatus === 'Open' ? 'text-green' : doorStatus === 'Locked' ? 'text-red' : 'text-yellow'}`;

    dom.dashLock.innerText = `${servoAngle}° (${lockStatus ? 'Pengait Menahan' : 'Pengait Terlepas'})`;
    dom.dashLock.className = `status-val ${lockStatus ? 'text-red' : 'text-green'}`;

    dom.dashSuccess.innerText = successfulAccess;
    dom.dashFailed.innerText = failedAccess;

    dom.doorStatusText.innerText = `Pintu: ${doorStatus} | Servo SG90: ${servoAngle}°`;
}

function addLogRecord() {
    const logData = {
        no: accessLogs.length + 1,
        time: lastAccessTime,
        id: fingerprintID,
        name: userName,
        result: accessGranted ? "Granted" : "Denied",
        doorState: `Pintu ${doorStatus} / Servo ${servoAngle}°`
    };

    accessLogs.unshift(logData);
    renderLogs();
}

function renderLogs() {
    if (accessLogs.length === 0) {
        dom.logTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-gray">Belum ada riwayat aktivitas pemindaian.</td></tr>`;
        return;
    }

    dom.logTableBody.innerHTML = accessLogs.map(log => `
        <tr>
            <td>${log.no}</td>
            <td>${log.time}</td>
            <td>ID #${log.id}</td>
            <td><strong>${log.name}</strong></td>
            <td><span class="${log.result === 'Granted' ? 'text-green' : 'text-red'}"><strong>${log.result}</strong></span></td>
            <td>${log.doorState}</td>
        </tr>
    `).join('');
}

function clearLogs() {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh log aktivitas?")) {
        accessLogs = [];
        renderLogs();
    }
}

function resetSystem() {
    if (confirm("Reset seluruh simulasi ke kondisi awal?")) {
        systemStatus = "Standby";
        sensorStatus = "Ready";
        fingerprintID = null;
        userName = "-";
        accessGranted = false;
        doorStatus = "Locked";
        lockStatus = true;
        servoAngle = 0;
        successfulAccess = 0;
        failedAccess = 0;
        accessLogs = [];
        isProcessing = false;
        dom.btnScan.disabled = false;
        dom.doorElement.classList.remove('open');

        dom.lcdLine1.innerText = "Tempelkan Jari";
        dom.lcdLine2.innerText = "Untuk Akses";

        resetHardwareIndicators();
        renderLogs();
        updateUI();
    }
}