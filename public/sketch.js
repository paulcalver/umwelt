//const API_BASE = "https://umweltbackend-production.up.railway.app";


let heartRate = 0;
let smoothedHeartRate = 0; // Smoothed HR for stable visuals
let smoothedPulseBrightness = 40; // Smoothed brightness for pulse effect
let lastBeatTime = 0; // Track last heartbeat for flash timing
let beatInterval = 1000; // Time between beats in ms
let smoothedAudioLevel = 0; // Smoothed overall audio level for background color
let motionMagnitude = 0;

let textAlpha = 0.5;
let cursorVisible = true; // Toggle cursor visibility
let qrCodeImg; // QR code image
let audioStarted = false; // Track if audio has been started

let hrConnected = false;
// Bottom bar configuration
const BOTTOM_BAR_HEIGHT = 40;
let bottomBarVisible = true; // Toggle bottom bar visibility

// Emotion visualization variables
let emotionGraphics;
let emotionParticles = [];
let currentEmotion = 0;
let emotionBoxVisible = true; // Toggle emotion box visibility
const EMOTION_BOX_SIZE = 250; // Square size for emotion display

const EMOTIONS = [
  {
    id: "calm",
    label: "Calm",
    bg: [190, 70, 10, 8],        
    color: [200, 60, 75],        
    count: 120,                  
    baseRadius: 0.15,            
    noiseSpeed: 0.0005,          
    jitter: 0.02,                
    glow: 0.3,                   
    shape: "circle",             
    breathing: 0.003,            
    sizeVar: 0.2                 
  },
  {
    id: "indifferent",
    label: "Indifferent",
    bg: [250, 60, 12, 15],       
    color: [240, 70, 70, 270, 60, 75], 
    count: 80,                  
    baseRadius: 0.2,           
    noiseSpeed: 0.0003,        
    jitter: 0.01,                
    glow: 0.4,                 
    shape: "square",          
    breathing: 0.001,           
    sizeVar: 0.1                
  },
  {
    id: "comfortable",
    label: "Comfortable",
    bg: [340, 40, 12, 10],       
    color: [330, 70, 85],       
    count: 160,                  
    baseRadius: 0.22,           
    noiseSpeed: 0.0012,          
    jitter: 0.08,                
    glow: 0.7,                  
    shape: "ellipse",            
    breathing: 0.008,         
    sizeVar: 0.4                 
  },
  {
    id: "happy",
    label: "Happy",
    bg: [45, 60, 18, 15],        
    color: [30, 80, 95],         
    count: 200,               
    baseRadius: 0.25,            
    noiseSpeed: 0.0025,         
    jitter: 0.18,              
    glow: 1.1,                   
    shape: "star",            
    breathing: 0.012,           
    sizeVar: 0.6              
  },
  {
    id: "annoyed",
    label: "Annoyed",
    bg: [320, 60, 15, 20],       
    color: [350, 80, 85],        
    count: 240,                  
    baseRadius: 0.28,            
    noiseSpeed: 0.005,           
    jitter: 0.35,                
    glow: 1.4,                   
    shape: "triangle",        
    breathing: 0.018,          
    sizeVar: 0.8                 
  },
  {
    id: "angry",
    label: "Angry",
    bg: [0, 80, 8, 25],          
    color: [0, 100, 100],        
    count: 300,                 
    baseRadius: 0.32,           
    noiseSpeed: 0.01,         
    jitter: 0.7,                 
    glow: 1.8,                   
    shape: "irregular",
    breathing: 0.025,            
    sizeVar: 1.0               
  }
];

class EmotionParticle {
  constructor(cfg) {
    this.reset(cfg);
  }

  reset(cfg) {
    this.idx = random(1000);
    this.baseAngle = random(TWO_PI);
    this.dist = this.getDistribution(cfg);
    this.size = random(2, 6) * (1 + cfg.sizeVar) * 0.5; // Reduced particle size by 50%
    this.colorType = cfg.color.length > 3 ? floor(random(2)) : 0;
    this.rotation = random(TWO_PI);
  }

  getDistribution(cfg) {
    switch(cfg.shape) {
      case "circle": return random(0.7, 1.0);    
      case "square": return random(0.5, 1.2);    
      case "ellipse": return random(0.6, 1.3);   
      case "star": return random(0.8, 1.4);     
      case "triangle": return random(0.4, 1.6); 
      case "irregular": return random(0.3, 1.9); 
      default: return random(0.5, 1.2);
    }
  }

  update(cfg, g) {
    const noiseVal = noise(this.idx + frameCount * cfg.noiseSpeed);
    
    let angle = this.baseAngle;
    switch(cfg.shape) {
      case "circle":
        angle += map(noiseVal, 0, 1, -cfg.jitter, cfg.jitter);
        break;
      case "square":
        angle += noise(this.idx * 0.3) * cfg.jitter;
        break;
      case "star":
        angle += map(noiseVal, 0, 1, -cfg.jitter * 1.5, cfg.jitter * 1.5) + 
                 sin(frameCount * 0.01 + this.idx) * 0.1;
        break;
      case "triangle":
        angle += noise(this.idx + frameCount * 0.005) * cfg.jitter * 2;
        break;
      case "irregular":
        angle += noise(this.idx * 2 + frameCount * 0.01) * cfg.jitter * 3 + 
                 sin(frameCount * 0.03 + this.idx) * 0.2;
        break;
      default:
        angle += map(noiseVal, 0, 1, -cfg.jitter, cfg.jitter);
    }

    // Use heart rate for breathing if connected, otherwise use default animation
    let breathing = sin(frameCount * cfg.breathing + this.idx) * 0.2;
    
    // Add subtle heart rate pulse overlay when connected (doesn't replace base animation)
    if (hrConnected && smoothedHeartRate > 0 && beatInterval > 0) {
      let timeSinceLastBeat = millis() - lastBeatTime;
      let beatProgress = (timeSinceLastBeat % beatInterval) / beatInterval;
      
      // Create a subtle pulse that peaks at the beat and fades out
      let heartPulse = Math.pow(1 - beatProgress, 3); // Quick decay
      breathing += heartPulse * 0.05; // Add only 5% extra pulse on heartbeat
    }
    
    // Scale to fit nicely within the box without clipping
    const radius = cfg.baseRadius * EMOTION_BOX_SIZE * 0.85 * this.dist * (1 + breathing);
    
    this.x = cos(angle) * radius;
    this.y = sin(angle) * radius;
    this.sz = this.size * (0.5 + noiseVal * (1 + cfg.sizeVar));
    
    if (cfg.shape === "square" || cfg.shape === "triangle") {
      this.rotation += cfg.noiseSpeed * 10;
    } else if (cfg.shape === "irregular") {
      this.rotation += noise(this.idx) * cfg.noiseSpeed * 50;
    }
  }

  draw(cfg, g) {
    let h, s, b;
    if (cfg.color.length > 3) {
      const [h1, s1, b1, h2, s2, b2] = cfg.color;
      const mix = noise(this.idx + frameCount * 0.005);
      h = lerp(h1, h2, mix);
      s = lerp(s1, s2, mix);
      b = lerp(b1, b2, mix);
    } else {
      [h, s, b] = cfg.color;
    }

    let alpha = map(noise(this.idx * 2), 0, 1, 20, 80) * cfg.glow * 0.6; // Reduced glow for small box
    
    g.push();
    g.translate(this.x, this.y);
    
    if (cfg.shape !== "circle") {
      g.rotate(this.rotation);
    }
    
    g.noStroke();
    g.fill(h, s, b, alpha);

    switch(cfg.shape) {
      case "circle":
        g.ellipse(0, 0, this.sz, this.sz);
        break;
      case "square":
        g.rect(0, 0, this.sz, this.sz);
        break;
      case "ellipse":
        g.ellipse(0, 0, this.sz, this.sz * 0.6);
        break;
      case "star":
        this.drawStar(g, 0, 0, this.sz * 0.3, this.sz * 0.5, 5);
        break;
      case "triangle":
        g.triangle(0, -this.sz/2, -this.sz/2, this.sz/2, this.sz/2, this.sz/2);
        break;
      case "irregular":
        g.beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = TWO_PI * i / 6;
          const r = this.sz/2 * (0.7 + noise(this.idx + i) * 0.6);
          g.vertex(cos(angle) * r, sin(angle) * r);
        }
        g.endShape(CLOSE);
        break;
    }
    
    if (cfg.glow > 0.5) {
      const glowSize = this.sz * (1.5 + cfg.glow * 0.7);
      g.fill(h, s * 0.7, b, alpha * 0.15); // Reduced outer glow alpha
      
      if (cfg.shape === "circle" || cfg.shape === "ellipse") {
        g.ellipse(0, 0, glowSize, glowSize * (cfg.shape === "ellipse" ? 0.6 : 1));
      } else {
        g.ellipse(0, 0, glowSize, glowSize);
      }
    }
    
    g.pop();
  }
  
  drawStar(g, x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    g.beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = x + cos(a) * radius2;
      let sy = y + sin(a) * radius2;
      g.vertex(sx, sy);
      sx = x + cos(a + halfAngle) * radius1;
      sy = y + sin(a + halfAngle) * radius1;
      g.vertex(sx, sy);
    }
    g.endShape(CLOSE);
  }
}

function setEmotion(index) {
  currentEmotion = constrain(index, 0, EMOTIONS.length - 1);
  emotionParticles = [];
  const cfg = EMOTIONS[currentEmotion];
  for (let i = 0; i < cfg.count; i++) {
    emotionParticles.push(new EmotionParticle(cfg));
  }
}
// Location coordinates
const LAT = 51.5074;
const LON = -0.1278;

let motionX = 0;
let motionY = 0;
let motionZ = 0;
let motionConnected = false;
let lastMotionUpdate = 0;
const MOTION_TIMEOUT = 3000; // Consider disconnected if no update for 3 seconds
let motionIntensity = 0; // Normalized 0-1 value from motionY tilt (0=flat, 1=max tilt up)
let smoothedMotionIntensity = 0; // Smoothed version for gradual transitions
let smoothedBgColor = 200; // Smoothed background color for gradual transitions

let device, server, hrCharacteristic;

// -------- weather +24h state --------
let temp24 = null;
let cloud24 = null;
let rainProb24 = null;
let rain24 = null;
let wind24 = null;
let humidity24 = null;
let pressure24 = null;
let alpha24 = null;
let targetTime24 = '';
let shortwave24 = null;
let visibility24 = null;
let dewpoint24 = null;
let windDir24 = null;
let windGust24 = null;

// --------- Rain Variables ----------
let cols = 100;
let rows = cols * 0.6;

// Animation variables
let animatingNumbers = []; // Array to store numbers that are animating
let animationDuration = 2000; // 2 seconds in milliseconds
let baseRippleRadius = 15; // Base ripple radius (will be scaled by volume)

// Audio variables
let soundsPlaying = false; // Track if sounds should be playing
let soundLayers = {}; // Object to store all sound layers
let fft;
let audioThreshold = 0.005; // Lower threshold for better responsiveness
let lastTriggerTime = 0;
let minTimeBetweenDrops = 20; // Base time between drops (will be scaled by motion)

// Sound file mappings
// ES_Nature.mp3 = base ambient sound (always playing at consistent volume)
// Other rain sounds fade in with motion
const soundMappings = {
    'ES_Gentle_In_Water_On Wood_Drip_Quiet.mp3': {},
    'ES_Heavy Rain_Rainfall 02.mp3': {},
    'ES_Heavy Rain_Rainfall 03.mp3': {},
    'ES_Light Rain_Forest Brazil_Increasing Intensity_04.mp3': {},
    'ES_Light Rain_OnCement_Light Wind.mp3': {},
    'ES_Light Rain_Rainfall_01.mp3': {},
    'ES_Light_Rain_Rainfall 02.mp3': {}
};

const BASE_AMBIENT_SOUND = 'ES_Nature.mp3'; // Base sound that plays constantly
let baseAmbientLayer; // Separate variable for base ambient sound
let smoothedRainVolumes = {}; // Track smoothed volume for each rain sound layer

// -------- poll +24h weather from server --------
async function pollWeather24() {
    try {
        const res = await fetch('/weather24');
        //const res = await fetch(`${API_BASE}/weather24`);
        const data = await res.json();

        temp24 = data.temperature_24h;
        cloud24 = data.cloudcover_24h;
        rainProb24 = data.precip_prob_24h;
        rain24 = data.rain_24h;
        wind24 = data.windspeed_24h;
        humidity24 = data.humidity_24h;
        pressure24 = data.pressure_24h;

        shortwave24 = data.shortwave_24h;
        visibility24 = data.visibility_24h;
        dewpoint24 = data.dewpoint_24h;
        windDir24 = data.winddir_24h;
        windGust24 = data.windgusts_24h;

        alpha24 = data.alpha;
        targetTime24 = data.target_time;

        //console.log('[WEATHER24]', data);
    } catch (err) {
        //console.error('[WEATHER24] poll error', err);
    }
}

// --------- poll motion from server ----------
async function pollMotion() {
    try {
        const res = await fetch('/motion');
        //const res = await fetch(`${API_BASE}/motion`);
        const data = await res.json();

        motionX = data.x || 0;
        motionY = data.y || 0;
        motionZ = data.z || 0;

        // Update connection status if we have recent data
        if (data.t && Date.now() - data.t < MOTION_TIMEOUT) {
            motionConnected = true;
            lastMotionUpdate = Date.now();
        }

        // Remove gravity from Z axis (phone at rest shows -9.8 due to gravity)
        let adjustedZ = motionZ + 9.8;

        // Three-axis magnitude
        let rawMagnitude = Math.sqrt(
            motionX * motionX +
            motionY * motionY +
            adjustedZ * adjustedZ
        );

        // Dead zone: ignore small values (sensor noise when still)
        let deadZone = 0.0; // Smaller threshold now that gravity is removed
        motionMagnitude = rawMagnitude > deadZone ? rawMagnitude - deadZone : 0;

        //console.log('[VIEWER] motion data', data);

    } catch (err) {
        //console.error('[VIEWER] motion poll error', err);
    }
}

// --------- Web Bluetooth for Garmin HR ----------
async function connectHeartRate() {
    try {
        const serviceUuid = 'heart_rate';
        const characteristicUuid = 'heart_rate_measurement';

        device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [serviceUuid] }]
        });

        server = await device.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);
        hrCharacteristic = await service.getCharacteristic(characteristicUuid);

        await hrCharacteristic.startNotifications();
        hrCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRate);

        hrConnected = true;
        console.log('Connected to HR, waiting for data...');
    } catch (err) {
        console.error('Bluetooth error:', err);
        hrConnected = false;
    }
}

function handleHeartRate(event) {
    const data = event.target.value;
    const flags = data.getUint8(0);
    const hr16bit = flags & 0x01;

    if (hr16bit) {
        heartRate = data.getUint16(1, true);
    } else {
        heartRate = data.getUint8(1);
    }
}

function preload() {
    // Load QR code image
    qrCodeImg = loadImage('https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://lab.paulcalver.cc/umwelt/phone.html');

    // Load base ambient sound separately
    baseAmbientLayer = loadSound('assets/' + BASE_AMBIENT_SOUND);
    
    // Load all rain sound files from assets folder
    const soundFiles = [
        'ES_Gentle_In_Water_On Wood_Drip_Quiet.mp3',
        'ES_Heavy Rain_Rainfall 02.mp3',
        'ES_Heavy Rain_Rainfall 03.mp3',
        'ES_Light Rain_Forest Brazil_Increasing Intensity_04.mp3',
        'ES_Light Rain_OnCement_Light Wind.mp3',
        'ES_Light Rain_Rainfall_01.mp3',
        'ES_Light_Rain_Rainfall 02.mp3'
    ];

    soundFiles.forEach(filename => {
        soundLayers[filename] = loadSound('assets/' + filename);
    });
}

// Simple circle function - always draws a standard size circle at 0,0
function drawCircle(alpha = 1.0) {
    push();
    fill(0, alpha * 0.5); // alpha: 0-1 range
    noStroke();
    rectMode(CENTER);
    circle(0, 0, 20);  // 20px circle centered at origin
    pop();
}

// Function to draw intensity number - displays the audio intensity value
function drawIntensityNumber(alpha = 1, intensity = 1) {
    push();
    fill(0, alpha * 1); // Black text, alpha: 0-1 range
    textAlign(CENTER, CENTER); // Left align, vertically centered
    textSize(12); // Small text size

    // Display intensity as decimal with 4 decimal places
    let displayNumber = intensity.toFixed(4);
    // Position text to the right of the circle (circle radius is 10, so start at x=12)
    text(displayNumber, 0, 0);
    pop();
}

// --------- p5 ----------
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont('monospace');
    textSize(12);
    colorMode(HSB, 360, 100, 100, 1); // Alpha range: 0-1

    // Setup FFT for the first sound layer (for visualization)
    fft = new p5.FFT();
    let firstSound = Object.values(soundLayers)[0];
    if (firstSound) {
        fft.setInput(firstSound);
    }

    // Initialize emotion graphics buffer
    emotionGraphics = createGraphics(EMOTION_BOX_SIZE, EMOTION_BOX_SIZE);
    emotionGraphics.colorMode(HSB, 360, 100, 100, 100);
    emotionGraphics.rectMode(CENTER);
    setEmotion(0); // Start with first emotion

    // poll motion 10x per second
    setInterval(pollMotion, 100);

    // poll +24h weather every 30 seconds
    pollWeather24(); // initial call
    setInterval(pollWeather24, 30 * 1000);

    // Note: updateSoundVolumes() is now called in draw() for smooth transitions
}

// Update all sound layer volumes based on motionMagnitude
function updateSoundVolumes() {
    // Simple motion intensity from magnitude (movement speed)
    // 0 = no movement, 15+ = max movement
    motionIntensity = map(motionMagnitude, 0, 15, 0, 1, true);
    motionIntensity = constrain(motionIntensity, 0, 1);
    
    // MotionY controls volume boost/reduction
    // Tilt down (>0) = quieter, Tilt up (<0) = louder
    let volumeModifier = 1.0;
    if (motionY > 0) {
        // Tilt down: reduce to 10% minimum
        volumeModifier = map(motionY, 0, 10, 1.0, 0.1, true);
    } else if (motionY < 0) {
        // Tilt up: boost up to 3x for big volume shifts
        volumeModifier = map(motionY, 0, -20, 1.0, 3.0, true);
    }
    
    // Update base ambient sound - always at consistent volume
    if (baseAmbientLayer) {
        baseAmbientLayer.setVolume(0.5);
        if (soundsPlaying && !baseAmbientLayer.isPlaying()) {
            baseAmbientLayer.loop();
        }
    }

    // Update rain sound layers - direct volume from motion intensity
    Object.keys(soundMappings).forEach(filename => {
        const sound = soundLayers[filename];

        if (sound) {
            // Calculate volume directly from motion intensity and modifier
            let volume = motionIntensity * volumeModifier;
            volume = constrain(volume, 0, 1);
            
            // Set volume directly - no smoothing
            sound.setVolume(volume);

            // Playback rate shift based on motionX
            let playbackRate = map(motionX, -10, 10, 0.5, 2, true);
            playbackRate = constrain(playbackRate, 0.5, 2);
            sound.rate(playbackRate);

            // Start looping if sounds should be playing
            if (soundsPlaying && !sound.isPlaying()) {
                sound.loop();
            }
        }
    });
}

function startAudio() {
    // Ensure audio context is resumed (required for mobile)
    if (getAudioContext().state !== 'running') {
        getAudioContext().resume();
    }

    // Toggle all sound layers
    if (soundsPlaying) {
        // Stop all sounds
        soundsPlaying = false;
        Object.values(soundLayers).forEach(sound => sound.stop());
        if (baseAmbientLayer) baseAmbientLayer.stop();
        //console.log("All sounds stopped");
    } else {
        // Start all sounds and immediately update volumes
        soundsPlaying = true;
        updateSoundVolumes();
        //console.log("All sounds started (base ambient + rain layers)");
    }

    // Also trigger a test raindrop on click/touch
    let randomI = floor(random(rows));
    let randomJ = floor(random(cols));
    let crossId = randomI + "_" + randomJ;

    animatingNumbers.push({
        id: crossId,
        i: randomI,
        j: randomJ,
        initialI: randomI,
        initialJ: randomJ,
        startTime: millis()
    });
    //console.log("Test raindrop triggered at:", randomI, randomJ);
}

function draw() {
    // Update sound volumes every frame for smooth transitions
    updateSoundVolumes();

    const sw = shortwave24 != null ? shortwave24.toFixed(0) : '--';

    // Default color when no audio
    let swColour = 200; // Blue by default

    // Smooth heart rate changes to prevent jumps
    if (hrConnected && heartRate > 0) {
        smoothedHeartRate = lerp(smoothedHeartRate, heartRate, 0.1); // Smooth HR changes
    } else {
        smoothedHeartRate = lerp(smoothedHeartRate, 0, 0.05); // Fade out when disconnected
    }

    // Heart rate pulse effect on brightness when connected
    let baseBrightness = 40;
    
    // Map shortwave radiation to brightness when available
    // Shortwave typically ranges 0-1000 W/m², map to brightness 20-80
    if (shortwave24 !== null) {
        baseBrightness = map(shortwave24, 0, 1000, 5, 80, true);
        baseBrightness = constrain(baseBrightness, 20, 80);
    }

    let finalBrightness = baseBrightness;

    if (hrConnected && smoothedHeartRate > 0) {
        // Update beat interval based on heart rate
        beatInterval = (60 / smoothedHeartRate) * 1000; // Convert BPM to ms between beats

        // Calculate time since last beat
        let timeSinceLastBeat = millis() - lastBeatTime;

        // Trigger new beat when interval has passed
        if (timeSinceLastBeat >= beatInterval) {
            lastBeatTime = millis();
            timeSinceLastBeat = 0;
        }

        // Calculate fade progress (0 to 1)
        let fadeProgress = timeSinceLastBeat / beatInterval;
        fadeProgress = constrain(fadeProgress, 0, 1);

        // Ease-out fade: starts slow, speeds up (cubic easing)
        let easedProgress = 1 - Math.pow(1 - fadeProgress, 3);

        // Pulse modifier: add a flash on top of base brightness
        // Pulses from +10 (peak) down to +0 (rest)
        let pulseModifier = map(easedProgress, 0, 1, 10, 0);

        // Apply pulse on top of SW-based brightness
        finalBrightness = baseBrightness + pulseModifier;
    } else {
        // Reset beat timing when disconnected
        lastBeatTime = millis();
        // Fade back to SW/motion-based brightness when disconnected
        smoothedPulseBrightness = lerp(smoothedPulseBrightness, finalBrightness, 0.1);
        finalBrightness = smoothedPulseBrightness;
    }


    let gridSize = height * 1;
    let padding = 4; // Your desired padding
    let spacing = gridSize / rows; // Total space per grid cell
    let blockSize = spacing - padding; // Shape size after accounting for padding

    // Centering 
    let startX = width * 0.5 - (cols * spacing) * 0.5 + spacing * 0.5;
    let startY = height * 0.5 - (rows * spacing) * 0.5 + spacing * 0.5;


    // Audio-triggered raindrops
    let anySoundPlaying = Object.values(soundLayers).some(sound => sound.isPlaying());

    if (anySoundPlaying) {
        // Get spectrum analysis first
        let spectrum = fft.analyze();

        // Try multiple frequency ranges for rain sounds
        let lowFreq = fft.getEnergy(20, 200);    // Low frequencies
        let midFreq = fft.getEnergy(200, 2000);  // Mid frequencies  
        let highFreq = fft.getEnergy(2000, 8000); // High frequencies (rain hits)

        // Use the highest energy from any frequency range
        let audioLevel = max(lowFreq, midFreq, highFreq);
        let normalizedLevel = audioLevel / 255; // Normalize to 0-1

        // Calculate overall audio intensity for visual scaling
        let overallIntensity = (lowFreq + midFreq + highFreq) / (3 * 255);

        // Smooth audio level for reference
        smoothedAudioLevel = lerp(smoothedAudioLevel, overallIntensity, 0.15);
    }

    // Playful background color based on phone rotation
    // motionX (left/right tilt) controls hue, motionY (up/down tilt) modifies it
    if (!anySoundPlaying) {
        swColour = 200; // Blue when no sound
    } else {
        // Map motionX to full color spectrum (left = purple, center = blue, right = orange/red)
        let baseHue = map(motionX, -10, 10, 270, 30, true);
        
        // motionY shifts the hue further (tilt up = warmer, tilt down = cooler)
        let hueShift = map(motionY, -10, 10, 60, -60, true);
        
        swColour = baseHue + hueShift;
        // Wrap around color wheel (0-360)
        if (swColour < 0) swColour += 360;
        if (swColour > 360) swColour -= 360;
    }

    // Draw background with audio-reactive color
    //console.log('Audio level:', smoothedAudioLevel.toFixed(3), 'Color:', swColour.toFixed(0));
    background(swColour, 100, finalBrightness);

    if (anySoundPlaying) {
        // Continue with audio analysis already done above
        let spectrum = fft.analyze();
        let lowFreq = fft.getEnergy(20, 200);
        let midFreq = fft.getEnergy(200, 2000);
        let highFreq = fft.getEnergy(2000, 8000);
        let audioLevel = max(lowFreq, midFreq, highFreq);
        let normalizedLevel = audioLevel / 255;
        let overallIntensity = (lowFreq + midFreq + highFreq) / (3 * 255);

        // Debug: show audio level - More detailed
        push();
        fill(0);
        textSize(14);
        // text("Audio Level: " + normalizedLevel.toFixed(3), 10, 20);
        // text("Overall Intensity: " + overallIntensity.toFixed(3), 10, 40);
        // text("Active crosses: " + animatingNumbers.length, 10, 60);
        pop();

        // Multiple drops based on motion intensity
        // Dynamic frequency: higher motion = drops happen more frequently
        let dynamicMinTime = map(motionIntensity, 0, 1, 200, 10, true); // 200ms at rest to 10ms at max motion
        
        if (normalizedLevel > audioThreshold && millis() - lastTriggerTime > dynamicMinTime) {
            // Scale drops with audio intensity and motion
            let baseDrops = Math.floor(map(overallIntensity, 0, 1, 2, 15));
            let motionDropMultiplier = map(motionIntensity, 0, 1, 0.5, 3.0, true); // More drops with motion
            let numDrops = Math.floor(baseDrops * motionDropMultiplier);
            numDrops = constrain(numDrops, 1, 50); // Higher cap for more rain

            // Create multiple raindrops
            for (let drop = 0; drop < numDrops; drop++) {
                let randomJ;
                
                // 70% follow tilt bias, 30% distribute evenly
                if (random() < 0.7) {
                    // Use motionX to bias the horizontal position
                    // motionX: left tilt = negative, right tilt = positive
                    // Map motionX (-10 to +10) to column bias (0 to 1, where 0.5 is center)
                    let columnBias = map(motionX, -10, 10, 0, 1, true);
                    columnBias = constrain(columnBias, 0, 1);
                    
                    // Generate random column with Gaussian distribution centered on bias
                    // Use multiple random values for bell curve approximation
                    let gaussianRandom = (random() + random() + random()) / 3; // Approximates gaussian
                    let biasedColumn = gaussianRandom * 0.6 + columnBias * 0.4; // Mix gaussian with bias
                    randomJ = floor(biasedColumn * cols);
                    randomJ = constrain(randomJ, 0, cols - 1);
                } else {
                    // Fully random distribution across entire canvas
                    randomJ = floor(random(cols));
                }
                
                let randomI = floor(random(rows));
                let crossId = randomI + "_" + randomJ + "_" + millis() + "_" + drop; // Unique ID

                // Calculate ripple size based on audio intensity
                let rippleRadius = map(overallIntensity, 0, 1, baseRippleRadius * 0.1, baseRippleRadius * 1);

                animatingNumbers.push({
                    id: crossId,
                    i: randomI,
                    j: randomJ,
                    initialI: randomI,
                    initialJ: randomJ,
                    startTime: millis(),
                    intensity: overallIntensity,
                    rippleRadius: rippleRadius
                });
            }

            lastTriggerTime = millis();
            //console.log(`Created ${numDrops} raindrops with intensity: ${overallIntensity.toFixed(3)}`);
        }
    } else {
        // Show instruction when not playing
        fill(0);
        //text("Click to start rain", 10, 30);
    }

    // Calculate motion-based alpha multiplier
    let motionAlpha = map(motionMagnitude, 0, 15, 1, 1, true);

    // Process all raindrops and prepare data for rendering
    let activeDrops = [];
    
    animatingNumbers.forEach(drop => {
        let elapsed = millis() - drop.startTime;

        if (elapsed < animationDuration) {
            let progress = elapsed / animationDuration;
            
            // Calculate wind drift
            let windDriftX = 0;
            let windDriftY = 0;

            if (wind24 !== null && windDir24 !== null && windGust24 !== null) {
                let windAngle = (windDir24 + 180) * (PI / 180);
                let baseWindSpeed = wind24;
                let gustMultiplier = map(windGust24, 0, 60, 1.0, 8.0, true);
                let effectiveWindSpeed = baseWindSpeed * gustMultiplier;
                let driftDistance = map(effectiveWindSpeed, 0, 200, 0, 20, true) * progress;
                windDriftX = cos(windAngle) * driftDistance;
                windDriftY = sin(windAngle) * driftDistance;
            }

            // Calculate position
            let currentJ = drop.initialJ + windDriftX;
            let currentI = drop.initialI + windDriftY;
            let x = startX + currentJ * spacing;
            let y = startY + currentI * spacing;

            // Calculate scale and alpha
            let intensityScale = map(drop.intensity || 0.5, 0.05, 0.5, 0.5, 8.0, true);
            let easeOutSine = sin(progress * PI * 0.5);
            let shrinkScale = max(1 - easeOutSine, 0.3);
            let alpha = constrain(map(shrinkScale, 0.3, 1.0, 0, 1), 0, 1) * motionAlpha;
            let sizeScale = intensityScale * shrinkScale;
            let finalScale = constrain(abs(blockSize / 20 * sizeScale), 0.1, 10);

            activeDrops.push({
                x: x,
                y: y,
                alpha: alpha,
                intensity: drop.intensity || 0.5,
                scale: finalScale,
                intensityRounded: Math.round((drop.intensity || 0.5) * 10000) / 10000
            });
        }
    });

    // Draw connections between drops with matching intensities
    push();
    stroke(0, 0, 0);
    strokeWeight(1);
    drawingContext.setLineDash([3, 3]);
    
    for (let i = 0; i < activeDrops.length; i++) {
        for (let j = i + 1; j < activeDrops.length; j++) {
            if (activeDrops[i].intensityRounded === activeDrops[j].intensityRounded) {
                let lineAlpha = min(activeDrops[i].alpha, activeDrops[j].alpha) * 0.5;
                stroke(0, 0, 0, lineAlpha);
                line(activeDrops[i].x, activeDrops[i].y, activeDrops[j].x, activeDrops[j].y);
            }
        }
    }
    
    drawingContext.setLineDash([]);
    pop();

    // Draw all raindrops (circles and numbers)
    activeDrops.forEach(drop => {
        // Draw circle
        push();
        translate(drop.x, drop.y);
        scale(drop.scale);
        fill(0, drop.alpha * 0.5);
        noStroke();
        circle(0, 0, 20);
        pop();

        // Draw intensity number
        push();
        translate(drop.x, drop.y);
        fill(0, drop.alpha);
        textAlign(CENTER, CENTER);
        textSize(12);
        text(drop.intensity.toFixed(4), 0, 0);
        pop();
    });

    // Clean up completed animations
    animatingNumbers = animatingNumbers.filter(drop => {
        return (millis() - drop.startTime) < animationDuration;
    });

    // Update and draw emotion visualization
    updateEmotionVisualization();
    drawEmotionBox();

    // Draw bottom black bar
    if (bottomBarVisible) {
        fill(0, 0, 0, 0); // Black
        noStroke();
        rect(0, height - BOTTOM_BAR_HEIGHT, width, BOTTOM_BAR_HEIGHT);

        // Prepare weather data
        const py = rainProb24 != null ? rainProb24.toFixed(0) : '--';
        const vis = visibility24 != null ? (visibility24 / 1000).toFixed(1) : '--';
        const dew = dewpoint24 != null ? dewpoint24.toFixed(1) : '--';
        const wy = wind24 != null ? wind24.toFixed(1) : '--';
        const wdir = windDir24 != null ? windDir24.toFixed(0) : '--';
        const wgust = windGust24 != null ? windGust24.toFixed(1) : '--';
        const hy = humidity24 != null ? humidity24.toFixed(0) : '--';

        // Draw text in bottom bar as one string
        textAlign(LEFT, CENTER);
        textSize(14);

        const barY = height - BOTTOM_BAR_HEIGHT / 2;

        // Get current time (hours:minutes:seconds)
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Main info text (white)
        fill(0, 0, 0, textAlpha);
        const infoText = `${LAT.toFixed(4)}°N, ${Math.abs(LON).toFixed(4)}°W | SW: ${sw} W/m² | Wind: ${wy} km/h @ ${wdir}° | Gusts: ${wgust} km/h | Vis: ${vis} km | Dew: ${dew}°C | Humid: ${hy}% | Updated: ${timeStr} | `;
        text(infoText, 20, barY);

        // Check if motion data is stale
        if (Date.now() - lastMotionUpdate > MOTION_TIMEOUT) {
            motionConnected = false;
        }

        // Motion status text - dark red if connected, white if not
        const hrmTextWidth = textWidth(infoText);
        let statusX = 20 + hrmTextWidth;

        if (motionConnected) {
            fill(0, 80, 50, textAlpha); // Dark red
        } else {
            fill(0, 0, 0, textAlpha); // White
        }
        text('Motion', statusX, barY);
        statusX += textWidth('Motion') + 5;

        // HRM text - dark red if connected, white if not
        fill(0, 0, 0, textAlpha); // White separator
        text('|', statusX, barY);
        statusX += textWidth('| ');

        if (hrConnected) {
            fill(0, 80, 50, textAlpha); // Dark red
        } else {
            fill(0, 0, 0, textAlpha); // White
        }
        text('HRM', statusX, barY);
        statusX += textWidth('HRM') + 5;

        // Motion values readout
        fill(0, 0, 0, textAlpha); // White separator
        //text('|', statusX, barY);
        statusX += textWidth('| ');

        fill(0, 0, 0, textAlpha); // White
        const motionReadout = `X: ${motionX.toFixed(2)} Y: ${motionY.toFixed(2)} Z: ${motionZ.toFixed(2)}`;
        //text(motionReadout, statusX, barY);

        // Check if cursor is hovering over HRM text
        const hrmWidth = textWidth('HRM');
        const hrmStartX = statusX - textWidth(motionReadout) - textWidth('| ') - textWidth('HRM') - 5;
        const hrmHovering = mouseX >= hrmStartX && mouseX <= hrmStartX + hrmWidth &&
            mouseY >= barY - 10 && mouseY <= barY + 10;

        if (!cursorVisible) {
            noCursor();
        } else if (hrmHovering && !hrConnected) {
            cursor(HAND);
        } else {
            cursor(ARROW);
        }
    }

    // Draw QR code and start button if not connected or audio not started
    if (!motionConnected || !audioStarted) {
        // Semi-transparent overlay
        fill(0, 0, 0, 0.7);
        rect(0, 0, width, height);

        // QR code (only if motion not connected)
        if (!motionConnected && qrCodeImg) {
            imageMode(CENTER);
            let qrSize = 200;
            image(qrCodeImg, width / 2, height / 2 - 100, qrSize, qrSize);

            // Text above QR
            fill(0, 0, 100, 1);
            textAlign(CENTER, CENTER);
            textFont('Space Mono');
            textSize(24);
            text('Scan to connect phone', width / 2, height / 2 - 100 - qrSize / 2 - 40);
        }

        // Start audio text (only if audio not started)
        if (!audioStarted) {
            let btnY = motionConnected ? height / 2 : height / 2 + 220;
            let btnW = 300;
            let btnH = 80;
            let btnX = width / 2 - btnW / 2;

            // Check if hovering over text area
            let btnHovering = mouseX >= btnX && mouseX <= btnX + btnW &&
                mouseY >= btnY && mouseY <= btnY + btnH;

            // Text only - brighter when hovering
            if (btnHovering) {
                fill(0, 0, 100, 1); // Bright white
                cursor(HAND);
            } else {
                fill(0, 0, 80, 1); // Slightly dimmer
            }
            textAlign(CENTER, CENTER);
            textFont('Space Mono');
            textSize(18);
            text('Click to start audio & launch installation', width / 2, btnY + 15);
            
            // HRM link below audio button
            if (!hrConnected) {
                let hrmY = btnY + 50;
                let hrmHovering = mouseX >= btnX && mouseX <= btnX + btnW &&
                    mouseY >= hrmY - 15 && mouseY <= hrmY + 15;
                
                if (hrmHovering) {
                    fill(0, 0, 100, 1); // Bright white
                    cursor(HAND);
                } else {
                    fill(0, 0, 70, 1); // Dimmer
                }
                textSize(18);
                text('Connect HRM (Optional)', width / 2, hrmY);
            }
        }

        imageMode(CORNER);
    }

}

function mousePressed() {

    // Check if start audio button was clicked
    if (!audioStarted) {
        let btnY = motionConnected ? height / 2 : height / 2 + 220;
        let btnW = 300;
        let btnX = width / 2 - btnW / 2;

        // Check audio button click (top part)
        if (mouseX >= btnX && mouseX <= btnX + btnW &&
            mouseY >= btnY && mouseY <= btnY + 30) {
            audioStarted = true;
            startAudio();
            return;
        }
        
        // Check HRM link click (bottom part)
        if (!hrConnected) {
            let hrmY = btnY + 50;
            if (mouseX >= btnX && mouseX <= btnX + btnW &&
                mouseY >= hrmY - 15 && mouseY <= hrmY + 15) {
                connectHeartRate();
                return;
            }
        }
    }

    // // Toggle audio on/off if already started
    // if (audioStarted) {
    //     startAudio();
    // }

    // Check if HRM text was clicked
    const barY = height - BOTTOM_BAR_HEIGHT / 2;
    textAlign(LEFT, CENTER);
    textSize(14);
    const infoText = `${LAT.toFixed(4)}\u00b0N, ${Math.abs(LON).toFixed(4)}\u00b0W | SW: ${shortwave24 != null ? shortwave24.toFixed(0) : '--'} W/m\u00b2 | Wind: ${wind24 != null ? wind24.toFixed(1) : '--'} km/h @ ${windDir24 != null ? windDir24.toFixed(0) : '--'}\u00b0 | Gusts: ${windGust24 != null ? windGust24.toFixed(1) : '--'} km/h | Vis: ${visibility24 != null ? (visibility24 / 1000).toFixed(1) : '--'} km | Dew: ${dewpoint24 != null ? dewpoint24.toFixed(1) : '--'}\u00b0C | Humid: ${humidity24 != null ? humidity24.toFixed(0) : '--'}% | Updated: ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} | `;

    let statusX = 20 + textWidth(infoText);
    statusX += textWidth('Motion') + 5;
    statusX += textWidth('| ');

    const hrmWidth = textWidth('HRM');

    const hrmClicked = mouseX >= statusX && mouseX <= statusX + hrmWidth &&
        mouseY >= barY - 10 && mouseY <= barY + 10;

    if (hrmClicked && !hrConnected) {
        connectHeartRate();
        return;
    }

    // Toggle audio on/off if already started and not clicking on HRM
    if (audioStarted) {
        startAudio();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function updateEmotionVisualization() {
    const cfg = EMOTIONS[currentEmotion];
    const [bh, bs, bb, ba] = cfg.bg;
    
    // Add heart rate pulse to brightness
    let brightnessMod = 1.0;
    if (hrConnected && smoothedHeartRate > 0 && beatInterval > 0) {
        let timeSinceLastBeat = millis() - lastBeatTime;
        let beatProgress = (timeSinceLastBeat % beatInterval) / beatInterval;
        
        // Very subtle pulse brightness on beat
        let pulse = Math.pow(1 - beatProgress, 3); // Quick cubic fade
        brightnessMod = 1.0 + (pulse * 0.08); // Only 8% brightness boost on beat
    }
    
    // Clear and draw background
    if (cfg.shape === "irregular") {
        emotionGraphics.background(bh, bs, bb * (1 + sin(frameCount * 0.1) * 0.2) * brightnessMod, ba);
    } else if (cfg.shape === "triangle") {
        emotionGraphics.background(bh, bs, bb * brightnessMod, ba * (0.8 + sin(frameCount * 0.05) * 0.2));
    } else {
        emotionGraphics.background(bh, bs, bb * brightnessMod, ba);
    }

    emotionGraphics.push();
    emotionGraphics.translate(EMOTION_BOX_SIZE / 2, EMOTION_BOX_SIZE / 2);
    
    if (cfg.glow > 1.0) {
        emotionGraphics.blendMode(ADD);
    } else {
        emotionGraphics.blendMode(BLEND);
    }

    for (let p of emotionParticles) {
        p.update(cfg, emotionGraphics);
        p.draw(cfg, emotionGraphics);
    }

    emotionGraphics.blendMode(BLEND);
    emotionGraphics.pop();
}

function drawEmotionBox() {
    if (!emotionBoxVisible) return; // Don't draw if hidden
    
    const margin = 20;
    const boxX = width - EMOTION_BOX_SIZE - margin;
    const boxY = margin;
    
    push();
    // Set 80% opacity for the entire box
    tint(255, 255 * 0.8); // 80% opacity
    
    // Draw the emotion visualization (no border, no background)
    image(emotionGraphics, boxX, boxY);
    
    pop();
}

function keyPressed() {
    // Press 'c' to toggle cursor visibility
    if (key === 'c' || key === 'C') {
        cursorVisible = !cursorVisible;
        if (cursorVisible) {
            cursor();
        } else {
            noCursor();
        }
    }
    
    // Press 'd' to toggle bottom bar visibility
    if (key === 'd' || key === 'D') {
        bottomBarVisible = !bottomBarVisible;
    }
    
    // Press 'e' to toggle emotion box visibility
    if (key === 'e' || key === 'E') {
        emotionBoxVisible = !emotionBoxVisible;
    }
    
    // Press 1-6 to change emotion
    if (key >= '1' && key <= '6') {
        setEmotion(int(key) - 1);
    }
}