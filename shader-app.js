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
  
  // Handle window resizing
  setupResizeHandler() {
    window.addEventListener('resize', () => {
      const canvasContainer = this.canvas.parentElement;
      this.canvas.width = canvasContainer.clientWidth;
      this.canvas.height = canvasContainer.clientHeight;
      this.renderer.resize(this.canvas.width, this.canvas.height);
    });
    
    // Initial resize
    const canvasContainer = this.canvas.parentElement;
    this.canvas.width = canvasContainer.clientWidth;
    this.canvas.height = canvasContainer.clientHeight;
    this.renderer.resize(this.canvas.width, this.canvas.height);
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
  
  // Display notification
  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = 'notification show';
    
    if (type === 'error') {
      notification.style.backgroundColor = 'rgba(180, 30, 30, 0.8)';
    } else {
      notification.style.backgroundColor = 'rgba(30, 30, 30, 0.8)';
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
    this.complexityLevel = 3; // 1-5 scale of complexity
    this.patterns = [
      this.colorGradient,
      this.plasma,
      this.rays,
      this.tunnel,
      this.noise,
      this.cells
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

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  ShaderApp.init();
});