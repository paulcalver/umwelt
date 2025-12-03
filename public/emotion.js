let particles = [];
let currentEmotion = 0;

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

class Particle {
  constructor(cfg) {
    this.reset(cfg);
  }

  reset(cfg) {
    this.idx = random(1000);
    this.baseAngle = random(TWO_PI);
    this.dist = this.getDistribution(cfg);
    this.size = random(2, 6) * (1 + cfg.sizeVar);
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

  update(cfg) {
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

    const breathing = sin(frameCount * cfg.breathing + this.idx) * 0.2;
    const radius = cfg.baseRadius * min(width, height) * this.dist * (1 + breathing);
    
    this.x = cos(angle) * radius;
    this.y = sin(angle) * radius;
    this.sz = this.size * (0.5 + noiseVal * (1 + cfg.sizeVar));
    
    if (cfg.shape === "square" || cfg.shape === "triangle") {
      this.rotation += cfg.noiseSpeed * 10;
    } else if (cfg.shape === "irregular") {
      this.rotation += noise(this.idx) * cfg.noiseSpeed * 50;
    }
  }

  draw(cfg) {
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

    let alpha = map(noise(this.idx * 2), 0, 1, 20, 80) * cfg.glow;
    
    push();
    translate(this.x, this.y);
    
    if (cfg.shape !== "circle") {
      rotate(this.rotation);
    }
    
    noStroke();
    fill(h, s, b, alpha);

    switch(cfg.shape) {
      case "circle":
        ellipse(0, 0, this.sz, this.sz);
        break;
      case "square":
        rect(0, 0, this.sz, this.sz);
        break;
      case "ellipse":
        ellipse(0, 0, this.sz, this.sz * 0.6);
        break;
      case "star":
        this.drawStar(0, 0, this.sz * 0.3, this.sz * 0.5, 5);
        break;
      case "triangle":
        triangle(0, -this.sz/2, -this.sz/2, this.sz/2, this.sz/2, this.sz/2);
        break;
      case "irregular":
        beginShape();
        for (let i = 0; i < 6; i++) {
          const angle = TWO_PI * i / 6;
          const r = this.sz/2 * (0.7 + noise(this.idx + i) * 0.6);
          vertex(cos(angle) * r, sin(angle) * r);
        }
        endShape(CLOSE);
        break;
    }
    
    if (cfg.glow > 0.5) {
      const glowSize = this.sz * (1.5 + cfg.glow * 0.7);
      fill(h, s * 0.7, b, alpha * 0.2);
      
      if (cfg.shape === "circle" || cfg.shape === "ellipse") {
        ellipse(0, 0, glowSize, glowSize * (cfg.shape === "ellipse" ? 0.6 : 1));
      } else {
        ellipse(0, 0, glowSize, glowSize);
      }
    }
    
    pop();
  }
  
  drawStar(x, y, radius1, radius2, npoints) {
    let angle = TWO_PI / npoints;
    let halfAngle = angle / 2.0;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
      let sx = x + cos(a) * radius2;
      let sy = y + sin(a) * radius2;
      vertex(sx, sy);
      sx = x + cos(a + halfAngle) * radius1;
      sy = y + sin(a + halfAngle) * radius1;
      vertex(sx, sy);
    }
    endShape(CLOSE);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  setEmotion(0);
}

function draw() {
  const cfg = EMOTIONS[currentEmotion];
  const [bh, bs, bb, ba] = cfg.bg;
  
  if (cfg.shape === "irregular") {
    background(bh, bs, bb * (1 + sin(frameCount * 0.1) * 0.2), ba);
  } else if (cfg.shape === "triangle") {
    background(bh, bs, bb, ba * (0.8 + sin(frameCount * 0.05) * 0.2));
  } else {
    background(bh, bs, bb, ba);
  }

  push();
  translate(width / 2, height / 2);
  if (cfg.glow > 1.0) {
    blendMode(ADD);
  } else {
    blendMode(BLEND);
  }

  for (let p of particles) {
    p.update(cfg);
    p.draw(cfg);
  }

  blendMode(BLEND);
  pop();
  drawHUD(cfg);
}

function drawHUD(cfg) {
  push();
  fill(0, 0, 100, 80);
  rect(20, 20, 200, 40, 12);
  fill(0, 0, 0, 90);
  textFont("Helvetica");
  textSize(18);
  textAlign(LEFT, CENTER);
  text(`Emotion：${cfg.label}`, 35, 40);
  pop();

  push();
  fill(0, 0, 100, 80);
  textSize(14);
  textAlign(LEFT, CENTER);
  text("Button 1~6 change emotion  |  1.Calm 2.Indifferent 3.Comfortable 4.Happy 5.Annoyed 6.Angry", 25, height - 25);
  pop();
}

function setEmotion(index) {
  currentEmotion = constrain(index, 0, EMOTIONS.length - 1);
  particles = [];
  const cfg = EMOTIONS[currentEmotion];
  for (let i = 0; i < cfg.count; i++) {
    particles.push(new Particle(cfg));
  }
}

function keyPressed() {
  if (key >= '1' && key <= '6') {
    setEmotion(int(key) - 1);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setEmotion(currentEmotion);
}