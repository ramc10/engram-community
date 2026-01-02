// ===========================
// CONFIGURATION
// ===========================

const CONFIG = {
  blob: {
    size: 200,
    lagFactor: 0.15,
    glowColor: 'rgba(255, 107, 107, 0.3)',
    fillOpacity: 0.2,
    trailCount: 5,
  },
  neuralNetwork: {
    nodeCount: 100,
    connectionDistance: 150,
    pulseSpeed: 1.5,
    proximityRadius: 300,
  },
  dataStreams: {
    streamCount: 20,
    speed: 0.5,
    glowIntensity: 0.8,
  },
  parallax: {
    strength: 10,
    maxDistance: 0.3, // 30% of viewport
  },
};

// ===========================
// STATE
// ===========================

const state = {
  mouse: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  blob: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
  trail: [],
  velocity: { x: 0, y: 0 },
  scrollY: 0,
};

// ===========================
// BLOB CURSOR
// ===========================

class BlobCursor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    this.setupEventListeners();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => {
      state.mouse.x = e.clientX;
      state.mouse.y = e.clientY;
    });

    window.addEventListener('resize', () => this.resize());
  }

  update() {
    // Smooth blob movement with elastic easing
    const dx = state.mouse.x - state.blob.x;
    const dy = state.mouse.y - state.blob.y;

    state.blob.x += dx * CONFIG.blob.lagFactor;
    state.blob.y += dy * CONFIG.blob.lagFactor;

    // Calculate velocity for trail effect
    state.velocity.x = dx * CONFIG.blob.lagFactor;
    state.velocity.y = dy * CONFIG.blob.lagFactor;

    // Update trail
    this.updateTrail();

    // Update background reveal
    this.updateBackgroundReveal();
  }

  updateTrail() {
    const speed = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2);

    // Add new trail blob based on velocity
    if (speed > 1) {
      state.trail.push({
        x: state.blob.x,
        y: state.blob.y,
        life: 1.0,
        size: CONFIG.blob.size * 0.8,
      });
    }

    // Update and remove old trail blobs
    state.trail = state.trail
      .map(blob => ({
        ...blob,
        life: blob.life - 0.05,
        size: blob.size * 0.95,
      }))
      .filter(blob => blob.life > 0)
      .slice(-CONFIG.blob.trailCount);
  }

  updateBackgroundReveal() {
    const bg2 = document.querySelector('.background-state-2');
    const radius = CONFIG.blob.size / 2;

    bg2.style.clipPath = `circle(${radius}px at ${state.blob.x}px ${state.blob.y}px)`;
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw trail blobs
    state.trail.forEach(blob => {
      this.drawBlob(blob.x, blob.y, blob.size, blob.life * 0.2);
    });

    // Draw main blob
    this.drawBlob(state.blob.x, state.blob.y, CONFIG.blob.size, CONFIG.blob.fillOpacity);
  }

  drawBlob(x, y, size, opacity) {
    const radius = size / 2;

    // Glow
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 1.5);
    gradient.addColorStop(0, `rgba(255, 107, 107, ${opacity * 0.5})`);
    gradient.addColorStop(0.5, `rgba(255, 107, 107, ${opacity * 0.3})`);
    gradient.addColorStop(1, 'rgba(255, 107, 107, 0)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x - radius * 1.5, y - radius * 1.5, radius * 3, radius * 3);

    // Border
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = `rgba(255, 107, 107, ${opacity * 2})`;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
}

// ===========================
// NEURAL NETWORK
// ===========================

class NeuralNetwork {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.time = 0;
    this.resize();
    this.createNodes();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createNodes() {
    this.nodes = [];
    for (let i = 0; i < CONFIG.neuralNetwork.nodeCount; i++) {
      this.nodes.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 3 + 2,
        pulseOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  update() {
    this.time += 0.016; // ~60fps

    this.nodes.forEach(node => {
      node.x += node.vx;
      node.y += node.vy;

      // Bounce off edges
      if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw connections
    this.nodes.forEach((node, i) => {
      this.nodes.slice(i + 1).forEach(otherNode => {
        const dx = node.x - otherNode.x;
        const dy = node.y - otherNode.y;
        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        if (distance < CONFIG.neuralNetwork.connectionDistance) {
          // Check proximity to cursor for illumination
          const cursorDx = node.x - state.blob.x;
          const cursorDy = node.y - state.blob.y;
          const cursorDistance = Math.sqrt(cursorDx ** 2 + cursorDy ** 2);

          const proximityFactor = Math.max(
            0,
            1 - cursorDistance / CONFIG.neuralNetwork.proximityRadius
          );

          const opacity = (1 - distance / CONFIG.neuralNetwork.connectionDistance) * 0.2;
          const illuminatedOpacity = opacity + proximityFactor * 0.3;

          this.ctx.beginPath();
          this.ctx.moveTo(node.x, node.y);
          this.ctx.lineTo(otherNode.x, otherNode.y);
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${illuminatedOpacity})`;
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      });
    });

    // Draw nodes
    this.nodes.forEach(node => {
      const pulse = Math.sin(this.time * CONFIG.neuralNetwork.pulseSpeed + node.pulseOffset);
      const scale = 1 + pulse * 0.2;

      // Glow
      const gradient = this.ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        node.radius * scale * 2
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(
        node.x - node.radius * scale * 2,
        node.y - node.radius * scale * 2,
        node.radius * scale * 4,
        node.radius * scale * 4
      );

      // Node
      this.ctx.beginPath();
      this.ctx.arc(node.x, node.y, node.radius * scale, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.fill();
    });
  }
}

// ===========================
// DATA STREAMS
// ===========================

class DataStreams {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.streams = [];
    this.resize();
    this.createStreams();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  createStreams() {
    this.streams = [];
    for (let i = 0; i < CONFIG.dataStreams.streamCount; i++) {
      this.streams.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height - this.canvas.height,
        length: Math.random() * 200 + 100,
        speed: Math.random() * CONFIG.dataStreams.speed + 0.5,
        width: Math.random() * 2 + 1,
        angle: Math.random() * Math.PI * 2,
      });
    }
  }

  update() {
    this.streams.forEach(stream => {
      stream.y += stream.speed;

      // Reset stream when it goes off screen
      if (stream.y > this.canvas.height + stream.length) {
        stream.y = -stream.length;
        stream.x = Math.random() * this.canvas.width;
      }
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.streams.forEach(stream => {
      const gradient = this.ctx.createLinearGradient(
        stream.x,
        stream.y - stream.length,
        stream.x,
        stream.y
      );

      gradient.addColorStop(0, 'rgba(255, 107, 107, 0)');
      gradient.addColorStop(0.5, `rgba(255, 107, 107, ${CONFIG.dataStreams.glowIntensity})`);
      gradient.addColorStop(1, 'rgba(255, 107, 107, 0)');

      this.ctx.beginPath();
      this.ctx.moveTo(stream.x, stream.y - stream.length);
      this.ctx.lineTo(stream.x, stream.y);
      this.ctx.strokeStyle = gradient;
      this.ctx.lineWidth = stream.width;
      this.ctx.stroke();

      // Add glow effect
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = 'rgba(255, 107, 107, 0.8)';
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    });
  }
}

// ===========================
// PARALLAX
// ===========================

class Parallax {
  constructor() {
    this.elements = document.querySelectorAll('.hero-content, .logo, .nav');
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => {
      this.update(e.clientX, e.clientY);
    });
  }

  update(mouseX, mouseY) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const maxDistanceX = window.innerWidth * CONFIG.parallax.maxDistance;
    const maxDistanceY = window.innerHeight * CONFIG.parallax.maxDistance;

    const offsetX = ((mouseX - centerX) / maxDistanceX) * CONFIG.parallax.strength;
    const offsetY = ((mouseY - centerY) / maxDistanceY) * CONFIG.parallax.strength;

    this.elements.forEach(element => {
      element.style.transform = `translate(${-offsetX}px, ${-offsetY}px)`;
    });
  }
}

// ===========================
// SCROLL HINT
// ===========================

function setupScrollHint() {
  const scrollHint = document.querySelector('.scroll-hint');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      scrollHint.classList.add('hidden');
    } else {
      scrollHint.classList.remove('hidden');
    }
  });
}

// ===========================
// INITIALIZATION
// ===========================

function setupScrollReveal() {
  const observerOptions = {
    threshold: 0.15,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

function init() {
  const neuralCanvas = document.getElementById('neuralNetwork');
  const dataCanvas = document.getElementById('dataStreams');

  // Enable background animations (neural network and data streams)
  const neuralNetwork = new NeuralNetwork(neuralCanvas);
  const dataStreams = new DataStreams(dataCanvas);

  // Setup scroll reveal
  setupScrollReveal();

  // Animation loop for background effects only
  function animate() {
    neuralNetwork.update();
    neuralNetwork.draw();

    dataStreams.update();
    dataStreams.draw();

    requestAnimationFrame(animate);
  }

  animate();

  // Handle window resize
  window.addEventListener('resize', () => {
    neuralNetwork.resize();
    neuralNetwork.createNodes();
    dataStreams.resize();
    dataStreams.createStreams();
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
