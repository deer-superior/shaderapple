// Main application structure
const ShaderApp = {
  // Core components
  renderer: null,
  canvas: null,
  shader: null,
  urlHandler: null,

  // Initialize the application
  init() {
    this.canvas = document.getElementById('shader-canvas');
    this.setupWebGL();
    this.urlHandler = new URLHandler();
    
    // Check if URL contains a shader
    const shaderFromURL = this.urlHandler.getShaderFromURL();
    
    if (shaderFromURL) {
      this.loadShaderFromURL(shaderFromURL);
    } else {
      this.generateRandomShader();
    }
    
    this.setupEventListeners();
    this.startRenderLoop();
    this.setupResizeHandler();
  },
  
  // Initialize WebGL
  setupWebGL() {
    try {
      const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      if (!gl) throw new Error('WebGL not supported');
      
      this.renderer = new ShaderRenderer(gl, this.canvas);
    } catch (error) {
      console.error('WebGL initialization failed:', error);
      this.showNotification('WebGL is not supported in your browser', 'error');
    }
  },
  
  // Set up event listeners
  setupEventListeners() {
    document.getElementById('new-shader').addEventListener('click', () => {
      this.generateRandomShader();
    });
    
    document.getElementById('random-colors').addEventListener('click', () => {
      this.randomizeColors();
    });
    
    document.getElementById('apply-shader').addEventListener('click', () => {
      this.applyEditedShader();
      document.getElementById('editor-panel').classList.add('hidden');
    });
    
    document.getElementById('copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          this.showNotification('Link copied to clipboard!');
        })
        .catch(err => {
          console.error('Could not copy link:', err);
          this.showNotification('Failed to copy link', 'error');
        });
    });
  },
  
  // Handle window resizing - make canvas truly fullscreen
  setupResizeHandler() {
    const resizeCanvas = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.renderer.resize(this.canvas.width, this.canvas.height);
    };
    
    window.addEventListener('resize', resizeCanvas);
    
    // Initial resize
    resizeCanvas();
  },
  
  // Generate a new random shader
  generateRandomShader() {
    const shaderGenerator = new ShaderGenerator();
    const newShader = shaderGenerator.generate();
    
    this.shader = newShader;
    this.renderer.setShader(newShader);
    
    document.getElementById('current-shader').value = newShader;
    document.getElementById('editable-shader').value = newShader;
    
    const compressedShader = this.urlHandler.compressShader(newShader);
    this.urlHandler.updateURL(compressedShader);
    
    this.showNotification('New shader generated');
  },
  
  // Randomize colors in the current shader
  randomizeColors() {
    const currentShader = document.getElementById('current-shader').value;
    
    // Find and replace color values in the shader
    const colorRegex = /vec3\s*\(\s*([0-9]*\.[0-9]+|[0-9]+)\s*,\s*([0-9]*\.[0-9]+|[0-9]+)\s*,\s*([0-9]*\.[0-9]+|[0-9]+)\s*\)/g;
    
    const randomizedShader = currentShader.replace(colorRegex, () => {
      const r = Math.random().toFixed(1);
      const g = Math.random().toFixed(1);
      const b = Math.random().toFixed(1);
      return `vec3(${r}, ${g}, ${b})`;
    });
    
    // Apply the shader with new colors
    this.shader = randomizedShader;
    this.renderer.setShader(randomizedShader);
    
    document.getElementById('current-shader').value = randomizedShader;
    document.getElementById('editable-shader').value = randomizedShader;
    
    const compressedShader = this.urlHandler.compressShader(randomizedShader);
    this.urlHandler.updateURL(compressedShader);
    
    this.showNotification('Colors randomized');
  },
  
  // Apply changes from editable shader
  applyEditedShader() {
    const editedShader = document.getElementById('editable-shader').value;
    
    try {
      this.renderer.setShader(editedShader);
      this.shader = editedShader;
      document.getElementById('current-shader').value = editedShader;
      
      const compressedShader = this.urlHandler.compressShader(editedShader);
      this.urlHandler.updateURL(compressedShader);
      
      this.showNotification('Shader applied successfully');
    } catch (error) {
      console.error('Error applying shader:', error);
      this.showNotification('Error compiling shader: ' + error.message, 'error');
    }
  },
  
  // Load shader from URL
  loadShaderFromURL(shaderCode) {
    this.shader = shaderCode;
    this.renderer.setShader(shaderCode);
    document.getElementById('current-shader').value = shaderCode;
    document.getElementById('editable-shader').value = shaderCode;
  },
  
  // Animation loop
  startRenderLoop() {
    const animate = (time) => {
      this.renderer.render(time);
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  },
  
  // Display notification with macOS style
  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification show';
    
    if (type === 'error') {
      notification.classList.add('error');
    } else {
      notification.classList.remove('error');
    }
    
    setTimeout(() => {
      notification.className = 'notification';
    }, 3000);
  }
};

// Handler for URL operations
class URLHandler {
  constructor() {
    this.compressionLib = LZString; // Using LZString for compression
  }
  
  // Compress shader code
  compressShader(shaderCode) {
    return this.compressionLib.compressToEncodedURIComponent(shaderCode);
  }
  
  // Decompress shader code
  decompressShader(compressedCode) {
    return this.compressionLib.decompressFromEncodedURIComponent(compressedCode);
  }
  
  // Get shader from URL if present
  getShaderFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const compressedShader = urlParams.get('s');
    
    if (compressedShader) {
      return this.decompressShader(compressedShader);
    }
    
    return null;
  }
  
  // Update URL with compressed shader
  updateURL(compressedShader) {
    const newURL = new URL(window.location.origin + window.location.pathname);
    newURL.searchParams.set('s', compressedShader);
    
    window.history.pushState({}, '', newURL.toString());
  }
}

// WebGL Renderer
class ShaderRenderer {
  constructor(gl, canvas) {
    this.gl = gl;
    this.canvas = canvas;
    this.program = null;
    this.timeLocation = null;
    this.resolutionLocation = null;
    this.startTime = Date.now();
    
    this.initDefaultShader();
  }
  
  // Initialize with a default shader
  initDefaultShader() {
    const vertexShader = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    
    const fragmentShader = `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        gl_FragColor = vec4(uv.x, uv.y, sin(time * 0.001) * 0.5 + 0.5, 1.0);
      }
    `;
    
    this.createProgram(vertexShader, fragmentShader);
    this.createBuffers();
  }
  
  // Set a new shader
  setShader(fragmentShaderSource) {
    const vertexShader = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;
    
    try {
      this.createProgram(vertexShader, fragmentShaderSource);
      return true;
    } catch (error) {
      console.error('Shader compilation failed:', error);
      throw new Error('Shader compilation failed: ' + error.message);
    }
  }
  
  // Create WebGL program from shaders
  createProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    
    // Create shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader compile error: ' + gl.getShaderInfoLog(vertexShader));
    }
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader compile error: ' + gl.getShaderInfoLog(fragmentShader));
    }
    
    // Create program
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader program link error: ' + gl.getProgramInfoLog(program));
    }
    
    // Clean up previous program if exists
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    
    this.program = program;
    gl.useProgram(this.program);
    
    // Get uniform locations
    this.timeLocation = gl.getUniformLocation(program, 'time');
    this.resolutionLocation = gl.getUniformLocation(program, 'resolution');
    
    // Create buffers if needed
    if (!this.positionBuffer) {
      this.createBuffers();
    } else {
      // Re-bind position attribute
      const positionLocation = gl.getAttribLocation(this.program, 'position');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    }
  }
  
  // Create vertex buffers
  createBuffers() {
    const gl = this.gl;
    
    // Create a quad covering the entire canvas
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
       1.0,  1.0,
      -1.0, -1.0,
       1.0,  1.0,
      -1.0,  1.0
    ]);
    
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(this.program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  }
  
  // Resize renderer
  resize(width, height) {
    this.gl.viewport(0, 0, width, height);
  }
  
  // Render frame
  render(currentTime) {
    const gl = this.gl;
    const time = Date.now() - this.startTime;
    
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    gl.useProgram(this.program);
    
    // Update uniforms
    if (this.timeLocation !== null) {
      gl.uniform1f(this.timeLocation, time);
    }
    
    if (this.resolutionLocation !== null) {
      gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
    }
    
    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

// GLSL Shader Generator
class ShaderGenerator {
  constructor() {
    this.complexityLevel = 3;
    this.patterns = [
      this.colorGradient,
      this.plasma,
      this.rays,
      this.tunnel,
      this.noise,
      this.cells,
      this.geometricPatterns,
      this.fractalNoise,
      this.fluidSimulation,
      this.kaleidoscope,
      this.warpSpeed,
      this.mixedPattern
    ];
  }  

  // Generate a random shader
  generate() {
    const selectedPattern = this.patterns[Math.floor(Math.random() * this.patterns.length)];
    return selectedPattern.call(this);
  }
  
  // Color gradient shader
  colorGradient() {
    const colors = [
      'vec3(0.5, 0.0, 0.5)', // Purple
      'vec3(0.0, 0.5, 0.8)', // Blue
      'vec3(0.8, 0.2, 0.1)', // Red
      'vec3(0.1, 0.6, 0.2)'  // Green
    ];
    
    const color1 = colors[Math.floor(Math.random() * colors.length)];
    const color2 = colors[Math.floor(Math.random() * colors.length)];
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        float t = sin(time * 0.001) * 0.5 + 0.5;
        vec3 color = mix(${color1}, ${color2}, length(uv - 0.5) + sin(time * 0.0005 + uv.x * 10.0) * 0.2);
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
  
fractalNoise() {
  const octaves = Math.floor(Math.random() * 4) + 3; // 3-6 octaves
  const lacunarity = (Math.random() * 1.5 + 1.5).toFixed(2); // 1.5-3.0
  const gain = (Math.random() * 0.3 + 0.5).toFixed(2); // 0.5-0.8
  
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
    float noise(vec2 st) {
      vec2 i = floor(st);
      vec2 f = fract(st);
      
      // Four corners in 2D of a tile
      float a = random(i);
      float b = random(i + vec2(1.0, 0.0));
      float c = random(i + vec2(0.0, 1.0));
      float d = random(i + vec2(1.0, 1.0));
      
      // Cubic Hermite curve
      vec2 u = f * f * (3.0 - 2.0 * f);
      
      // Mix 4 corners percentages
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    
    float fbm(vec2 st) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      
      for (int i = 0; i < ${octaves}; i++) {
        value += amplitude * noise(st * frequency);
        frequency *= ${lacunarity};
        amplitude *= ${gain};
      }
      
      return value;
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      float t = time * 0.001;
      
      // Adjust coords for aspect ratio
      vec2 st = uv;
      st.x *= resolution.x / resolution.y;
      
      // Apply fbm with motion
      vec2 q = vec2(0.0);
      q.x = fbm(st + 0.1 * t);
      q.y = fbm(st + vec2(1.0));
      
      vec2 r = vec2(0.0);
      r.x = fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * t);
      r.y = fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * t);
      
      float f = fbm(st + r);
      
      vec3 color = mix(
        vec3(0.101961, 0.619608, 0.666667),
        vec3(0.666667, 0.666667, 0.498039),
        clamp((f * f) * 4.0, 0.0, 1.0)
      );
      
      color = mix(
        color,
        vec3(0.0, 0.0, 0.164706),
        clamp(length(q), 0.0, 1.0)
      );
      
      color = mix(
        color,
        vec3(0.666667, 1.0, 1.0),
        clamp(length(r.x), 0.0, 1.0)
      );
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
},

geometricPatterns() {
  const numShapes = Math.floor(Math.random() * 5) + 3; // 3-7 shapes
  const rotationSpeed = (Math.random() * 0.002 + 0.001).toFixed(4);
  const colorShift = Math.random() > 0.5;
  
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    float sdCircle(vec2 p, float r) {
      return length(p) - r;
    }
    
    float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }
    
    float sdTriangle(vec2 p) {
      const float k = sqrt(3.0);
      p.x = abs(p.x) - 1.0;
      p.y = p.y + 1.0 / k;
      if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
      p.x -= clamp(p.x, -2.0, 0.0);
      return -length(p) * sign(p.y);
    }
    
    mat2 rotate2d(float angle) {
      return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
      uv.x *= resolution.x / resolution.y;
      float t = time * 0.001;
      
      float dist = 1e10;
      
      // Create multiple rotating shapes
      for (int i = 0; i < ${numShapes}; i++) {
        float fi = float(i) / float(${numShapes});
        float radius = 0.2 + fi * 0.3;
        vec2 offset = vec2(
          cos(fi * 6.28 + t),
          sin(fi * 6.28 + t)
        ) * 0.5;
        
        vec2 p = uv - offset * 0.3;
        p = rotate2d(t * float(i+1) * ${rotationSpeed}) * p;
        
        float shape;
        int shapeType = i % 3;
        
        if (shapeType == 0) {
          // Circle
          shape = sdCircle(p, radius * 0.2);
        } else if (shapeType == 1) {
          // Square
          shape = sdBox(p, vec2(radius * 0.15));
        } else {
          // Triangle
          p *= 0.8;
          shape = sdTriangle(p * (1.0 / (radius * 0.3)));
        }
        
        dist = min(dist, shape);
      }
      
      // Create color based on distance
      vec3 color = vec3(0.0);
      
      // Edge glow
      float glow = 0.003 / (abs(dist) + 0.001);
      
      // Base color from distance 
      if (${colorShift}) {
        color += vec3(
          0.5 + 0.5 * sin(dist * 20.0 + t * 2.0),
          0.5 + 0.5 * sin(dist * 20.0 + t * 2.0 + 2.0),
          0.5 + 0.5 * sin(dist * 20.0 + t * 2.0 + 4.0)
        );
      } else {
        color += vec3(
          0.5 + 0.5 * cos(dist * 10.0),
          0.5 + 0.5 * cos(dist * 20.0),
          0.5 + 0.5 * sin(dist * 30.0)
        );
      }
      
      // Add glow
      color += vec3(0.1, 0.3, 0.6) * glow;
      color = mix(color, vec3(1.0), smoothstep(0.0, 0.01, -dist)); // Fill shapes
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
},

fluidSimulation() {
  const scale = (Math.random() * 3.0 + 2.0).toFixed(1);
  const speed = (Math.random() * 0.005 + 0.001).toFixed(4);
  const iterations = Math.floor(Math.random() * 5) + 5; // 5-9 iterations
  
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }
    
    float noise(vec2 p) {
      const float K1 = 0.366025404; // (sqrt(3)-1)/2
      const float K2 = 0.211324865; // (3-sqrt(3))/6   
      
      vec2 i = floor(p + (p.x + p.y) * K1);
      vec2 a = p - i + (i.x + i.y) * K2;
      vec2 o = (a.x > a.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0 * K2;
      
      vec3 h = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
      vec3 n = h*h*h*h * vec3(dot(a, hash(i+0.0)), dot(b, hash(i+o)), dot(c, hash(i+1.0)));
      
      return dot(n, vec3(70.0));    
    }
    
    float fbm(vec2 p) {
      float f = 0.0;
      float w = 0.5;
      float amp = 1.0;
      for (int i = 0; i < ${iterations}; i++) {
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return f;
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      float t = time * ${speed};
      
      // Get separate noise fields for x and y displacement
      float noise1 = fbm(uv * ${scale} + vec2(t * 0.5, t * -0.5));
      float noise2 = fbm(uv * ${scale} + vec2(t * -0.5, t * 0.5) + 100.0);
      
      // Combine noise fields to create a flow effect
      vec2 flow = vec2(noise1, noise2) * 0.05;
      
      // Sample colors based on warped coordinates
      vec3 col1 = vec3(0.2, 0.5, 0.8);
      vec3 col2 = vec3(0.8, 0.2, 0.6);
      vec3 col3 = vec3(0.1, 0.7, 0.3);
      
      float blend1 = fbm(uv + flow * 2.0 + t * 0.1);
      float blend2 = fbm(uv - flow * 2.0 - t * 0.15 + 3.5);
      
      vec3 color = mix(col1, col2, blend1);
      color = mix(color, col3, blend2);
      
      // Add some fine grain detail
      float detail = fbm(uv * 10.0 + flow * 10.0) * 0.2;
      color += vec3(detail);
      
      gl_FragColor = vec4(color, 1.0);
    
  `;
},

kaleidoscope() {
  const segments = Math.floor(Math.random() * 8) + 4; // 4-12 segments
  const zoom = (Math.random() * 2.0 + 1.0).toFixed(2);
  
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }
    
    vec2 rotate(vec2 uv, float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat2(c, -s, s, c) * uv;
    }
    
    float pattern(vec2 uv, float t) {
      uv *= ${zoom};
      
      vec2 grid = fract(uv) - 0.5;
      float circle = length(grid);
      
      float d1 = sin(length(uv) * 5.0 - t);
      float d2 = sin(atan(uv.y, uv.x) * ${segments}.0 + t);
      
      return smoothstep(0.2, 0.25, d1 * d2);
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      float t = time * 0.001;
      
      // Kaleidoscope effect
      float angle = atan(uv.y, uv.x);
      float segmentAngle = 3.14159 * 2.0 / float(${segments});
      angle = mod(angle, segmentAngle);
      if (mod(angle / segmentAngle, 2.0) >= 1.0) {
        angle = segmentAngle - angle;
      }
      
      float dist = length(uv);
      uv = vec2(cos(angle), sin(angle)) * dist;
      
      // Add time movement
      uv += 0.1 * vec2(cos(t * 0.3), sin(t * 0.4));
      
      // Generate pattern
      float p1 = pattern(uv, t);
      float p2 = pattern(uv * 0.8 + 0.5, t * 1.2);
      float p3 = pattern(uv * 1.5 - 0.5, t * 0.8);
      
      // Create colors
      vec3 col1 = vec3(0.8, 0.1, 0.3);
      vec3 col2 = vec3(0.1, 0.3, 0.8);
      vec3 col3 = vec3(0.6, 0.8, 0.1);
      
      vec3 color = mix(col1, col2, p1);
      color = mix(color, col3, p2);
      color += p3 * 0.5;
      
      // Add subtle pulse
      color *= 0.8 + 0.2 * sin(dist * 50.0 - t * 5.0);
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;
},

warpSpeed() {
  const numStars = Math.floor(Math.random() * 100) + 100; // 100-200 stars
  const speed = (Math.random() * 5.0 + 2.0).toFixed(2);
  const colorMode = Math.floor(Math.random() * 3); // 0, 1, or 2
  
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    float star(vec2 uv, float t, float i) {
      // Star position
      float phase = fract(i + t * 0.02);
      float depth = phase * 20.0;
      vec2 point = vec2(
        sin(i * 678.43) * 0.9,
        cos(i * 785.12) * 0.9
      );
      
      // Apply perspective
      point /= depth;
      
      // Distance from this point
      float dist = length(uv - point);
      
      // Star appearance
      float brightness = 0.003 / dist;
      brightness *= smoothstep(1.0, 0.0, phase); // Fade in
      
      return brightness;
    }
    
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * resolution.xy) / min(resolution.x, resolution.y);
      float t = time * 0.001 * ${speed};
      
      vec3 finalColor = vec3(0.0);
      
      // Add many stars
      for (int i = 0; i < ${numStars}; i++) {
        float fi = float(i) / float(${numStars});
        float brightness = star(uv, t, fi);
        
        // Star color based on mode
        vec3 starColor;
        if (${colorMode} == 0) {
          // Rainbow by position
          starColor = 0.5 + 0.5 * cos(vec3(0.0, 0.33, 0.67) * 6.28318 + fi * 6.28318);
        } else if (${colorMode} == 1) {
          // Blue-white themed
          float temp = fract(fi * 7.9) * 0.5 + 0.5; // Temperature variation
          starColor = mix(
            vec3(0.5, 0.8, 1.0), // Blue
            vec3(1.0, 1.0, 1.0), // White
            temp
          );
        } else {
          // Gold/red themed
          float temp = fract(fi * 8.3) * 0.6 + 0.4; // Temperature variation
          starColor = mix(
            vec3(1.0, 0.8, 0.0), // Gold
            vec3(1.0, 0.4, 0.2), // Red
            temp
          );
        }
        
        finalColor += brightness * starColor;
      }
      
      // Add glow at the center
      float centerGlow = 0.01 / (length(uv) + 0.05);
      if (${colorMode} == 0) {
        finalColor += centerGlow * vec3(0.2, 0.5, 1.0) * (0.5 + 0.5 * sin(t));
      } else if (${colorMode} == 1) {
        finalColor += centerGlow * vec3(0.1, 0.3, 1.0) * (0.5 + 0.5 * sin(t * 0.5));
      } else {
        finalColor += centerGlow * vec3(1.0, 0.3, 0.1) * (0.5 + 0.5 * sin(t * 0.7));
      }
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;
}

  // Plasma effect
  plasma() {
    const speed = (Math.random() * 0.005 + 0.001).toFixed(4);
    const scale = (Math.random() * 10.0 + 5.0).toFixed(1);
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        float t = time * ${speed};
        
        float x = uv.x * ${scale} + sin(t) * 2.0;
        float y = uv.y * ${scale} + cos(t) * 2.0;
        
        float r = sin(x + y + t) * 0.5 + 0.5;
        float g = sin(x - y + t * 0.7) * 0.5 + 0.5;
        float b = sin(sqrt(x*x + y*y) + t * 1.2) * 0.5 + 0.5;
        
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;
  }
  
  // Light rays effect
  rays() {
    const numRays = Math.floor(Math.random() * 20) + 5;
    const speed = (Math.random() * 0.5 + 0.1).toFixed(2);
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 center = vec2(0.5, 0.5);
        vec2 dir = uv - center;
        float angle = atan(dir.y, dir.x);
        float dist = length(dir);
        
        float brightness = 0.0;
        for (int i = 0; i < ${numRays}; i++) {
          float rayAngle = float(i) * 3.14159 * 2.0 / ${numRays}.0;
          float angleDiff = mod(abs(angle - rayAngle), 3.14159 * 2.0);
          angleDiff = min(angleDiff, 3.14159 * 2.0 - angleDiff);
          
          brightness += 0.2 / (0.1 + 10.0 * angleDiff * angleDiff);
        }
        
        brightness *= (sin(time * ${speed} + dist * 5.0) * 0.5 + 0.5) * (1.0 - dist);
        vec3 color = vec3(brightness) * vec3(0.8, 0.7, 0.2);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
  
  // Tunnel effect
  tunnel() {
    const scale = (Math.random() * 5.0 + 3.0).toFixed(1);
    const speed = (Math.random() * 0.003 + 0.001).toFixed(4);
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      mat2 rot2(float a) {
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c);
      }
      
      void main() {
        vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
        uv.x *= resolution.x / resolution.y;
        
        float t = time * ${speed};
        float z = t + 1.0 / (length(uv) * ${scale});
        vec2 tuv = uv * rot2(t * 0.2) / length(uv);
        
        vec3 color = vec3(0.0);
        float angle = atan(tuv.y, tuv.x);
        float radius = length(tuv);
        
        float pattern = sin(angle * 8.0 + z * 10.0);
        pattern += sin(radius * 10.0 + z * 8.0);
        pattern = mod(pattern, 1.0);
        
        color = mix(
          vec3(0.2, 0.0, 0.5),
          vec3(0.0, 0.4, 0.8),
          pattern
        );
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
  
  // Noise-based shader
  noise() {
    const scale = (Math.random() * 10.0 + 5.0).toFixed(1);
    const speed = (Math.random() * 0.001 + 0.0005).toFixed(4);
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      // Simple hash function
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      
      // 2D noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      // Fractal Brownian Motion
      float fbm(vec2 p) {
        float sum = 0.0;
        float amp = 1.0;
        float freq = 1.0;
        
        for (int i = 0; i < 4; i++) {
          sum += noise(p * freq) * amp;
          amp *= 0.5;
          freq *= 2.0;
        }
        
        return sum;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        float t = time * ${speed};
        
        vec2 p = uv * ${scale};
        float n = fbm(p + t);
        
        vec3 color1 = vec3(0.2, 0.5, 0.7);
        vec3 color2 = vec3(0.7, 0.3, 0.2);
        vec3 color = mix(color1, color2, n);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
  
  // Cellular/Voronoi pattern
  cells() {
    const numPoints = Math.floor(Math.random() * 10) + 5;
    const speed = (Math.random() * 0.01 + 0.005).toFixed(4);
    
    return `
      precision mediump float;
      uniform float time;
      uniform vec2 resolution;
      
      // Distance to nearest point
      float voronoi(vec2 p) {
        float minDist = 1.0;
        
        for (int i = 0; i < ${numPoints}; i++) {
          float t = time * ${speed} + float(i) * 0.2;
          vec2 pointPos = 0.5 + 0.5 * vec2(
            sin(t * 0.3 + float(i)),
            cos(t * 0.4 + float(i) * 0.7)
          );
          
          float dist = distance(p, pointPos);
          minDist = min(minDist, dist);
        }
        
        return minDist;
      }
      
      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        float t = time * 0.001;
        
        float d = voronoi(uv);
        float cell = smoothstep(0.0, 0.1, d) * (1.0 - smoothstep(0.1, 0.2, d));
        
        vec3 color = mix(
          vec3(0.8, 0.2, 0.3),
          vec3(0.1, 0.3, 0.6),
          d * 3.0
        );
        
        color += cell * vec3(1.0);
        color += (1.0 - smoothstep(0.0, 0.05, d)) * vec3(1.0);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }
}

mixedPattern() {
  // Pick two random patterns to combine
  const availablePatterns = [
    this.plasma,
    this.noise,
    this.rays,
    this.tunnel,
    this.fractalNoise,
    this.geometricPatterns,
    this.fluidSimulation
  ];
  
  // Pick two different patterns
  const index1 = Math.floor(Math.random() * availablePatterns.length);
  let index2 = Math.floor(Math.random() * (availablePatterns.length - 1));
  if (index2 >= index1) index2++;
  
  // Generate shader code for both patterns
  const pattern1 = availablePatterns[index1].call(this);
  const pattern2 = availablePatterns[index2].call(this);
  
  // Extract the main functions from each pattern
  const extractMainBody = (shaderCode) => {
    const mainStart = shaderCode.indexOf('void main()');
    const mainBody = shaderCode.substring(
      shaderCode.indexOf('{', mainStart) + 1,
      shaderCode.lastIndexOf('}')
    );
    return mainBody;
  };
  
  // Extract function declarations and uniforms from both patterns
  const extractFunctions = (shaderCode) => {
    const mainStart = shaderCode.indexOf('void main()');
    return shaderCode.substring(0, mainStart).trim();
  };
  
  const functions1 = extractFunctions(pattern1);
  const functions2 = extractFunctions(pattern2);
  const mainBody1 = extractMainBody(pattern1);
  const mainBody2 = extractMainBody(pattern2);
  
  // Combine the patterns with a blend parameter
  const mixMethod = Math.floor(Math.random() * 3); // 0, 1, or 2 for different mix methods
  const mixSpeed = (Math.random() * 0.002 + 0.001).toFixed(4);
  
  // Create combined shader
  return `
    precision mediump float;
    uniform float time;
    uniform vec2 resolution;
    
    // Combined function declarations from both patterns
    ${functions1}
    
    // Additional functions from pattern 2
    ${functions2.replace('precision mediump float;', '')
               .replace('uniform float time;', '')
               .replace('uniform vec2 resolution;', '')}
    
    // Function to get colors from both patterns
    vec4 pattern1(vec2 uv, float t) {
      // Local variables for pattern 1
      vec4 color;
      ${mainBody1.replace('gl_FragColor =', 'color =')}
      return color;
    }
    
    vec4 pattern2(vec2 uv, float t) {
      // Local variables for pattern 2
      vec4 color;
      ${mainBody2.replace('gl_FragColor =', 'color =')}
      return color;
    }
    
    void main() {
      vec2 uv = gl_FragCoord.xy / resolution.xy;
      float t = time * 0.001;
      
      // Get colors from both patterns
      vec4 color1 = pattern1(uv, t);
      vec4 color2 = pattern2(uv, t);
      
      // Mix based on different methods
      vec4 finalColor;
      
      ${mixMethod === 0 ? `
      // Method 1: Smooth time oscillation
      float mixFactor = sin(t * ${mixSpeed} * 10.0) * 0.5 + 0.5;
      finalColor = mix(color1, color2, mixFactor);
      ` : mixMethod === 1 ? `
      // Method 2: Spatial pattern
      float mixFactor = sin(uv.x * 10.0 + t) * sin(uv.y * 10.0 + t * 0.7) * 0.5 + 0.5;
      finalColor = mix(color1, color2, mixFactor);
      ` : `
      // Method 3: Blend modes
      // Screen blend
      finalColor = 1.0 - (1.0 - color1) * (1.0 - color2);
      // Apply some time variation to the blend strength
      float blendStrength = sin(t * ${mixSpeed} * 5.0) * 0.3 + 0.7;
      finalColor = mix(color1, finalColor, blendStrength);
      `}
      
      gl_FragColor = finalColor;
    }

}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  ShaderApp.init();
});