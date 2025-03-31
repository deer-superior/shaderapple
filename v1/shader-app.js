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

// The rest of the classes (URLHandler, ShaderRenderer, ShaderGenerator) 
// remain the same as in your original code