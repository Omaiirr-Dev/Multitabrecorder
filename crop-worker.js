// High-performance crop worker with OffscreenCanvas and WebGL acceleration
class AdvancedCropProcessor {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.frameCache = new Map();
        this.isInitialized = false;
    }

    // Initialize WebGL context and shaders
    initWebGL(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported, falling back to 2D context');
        }

        // Vertex shader for crop operation
        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in vec2 a_texCoord;
            out vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }`;

        // Fragment shader for crop operation
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            uniform sampler2D u_texture;
            uniform vec4 u_cropRect; // x, y, width, height (normalized)
            in vec2 v_texCoord;
            out vec4 fragColor;
            
            void main() {
                vec2 cropCoord = u_cropRect.xy + v_texCoord * u_cropRect.zw;
                fragColor = texture(u_texture, cropCoord);
            }`;

        this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        this.setupGeometry();
        this.isInitialized = true;
    }

    // Create and compile shader program
    createShaderProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader program failed to link: ' + gl.getProgramInfoLog(program));
        }
        
        return program;
    }

    // Compile individual shader
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compilation failed: ' + gl.getShaderInfoLog(shader));
        }
        
        return shader;
    }

    // Setup geometry for full-screen quad
    setupGeometry() {
        const gl = this.gl;
        
        // Full-screen quad vertices
        const vertices = new Float32Array([
            -1, -1, 0, 1,  // bottom-left
             1, -1, 1, 1,  // bottom-right
            -1,  1, 0, 0,  // top-left
             1,  1, 1, 0   // top-right
        ]);
        
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        const positionLocation = gl.getAttribLocation(this.program, 'a_position');
        const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
        
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
        
        gl.enableVertexAttribArray(texCoordLocation);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);
    }

    // Smart caching system for processed frames
    getCachedFrame(frameKey) {
        return this.frameCache.get(frameKey);
    }

    setCachedFrame(frameKey, frameData) {
        // Limit cache size to prevent memory issues
        if (this.frameCache.size > 100) {
            const firstKey = this.frameCache.keys().next().value;
            this.frameCache.delete(firstKey);
        }
        this.frameCache.set(frameKey, frameData);
    }

    // High-performance crop processing with WebGL
    async processCropWebGL(videoElement, cropParams) {
        const { left, top, width, height, outputWidth, outputHeight } = cropParams;
        
        if (!this.isInitialized) {
            throw new Error('WebGL not initialized');
        }

        const gl = this.gl;
        
        // Create texture from video
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        
        // Set up framebuffer for rendering
        this.canvas.width = outputWidth;
        this.canvas.height = outputHeight;
        gl.viewport(0, 0, outputWidth, outputHeight);
        
        // Use shader program
        gl.useProgram(this.program);
        
        // Set crop rectangle uniform (normalized coordinates)
        const cropRectLocation = gl.getUniformLocation(this.program, 'u_cropRect');
        gl.uniform4f(cropRectLocation, 
            left / videoElement.videoWidth,
            top / videoElement.videoHeight,
            width / videoElement.videoWidth,
            height / videoElement.videoHeight
        );
        
        // Bind texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);
        
        // Render
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Clean up
        gl.deleteTexture(texture);
        
        return this.canvas;
    }

    // Fallback 2D canvas processing for unsupported browsers
    async processCrop2D(videoElement, cropParams) {
        const { left, top, width, height, outputWidth, outputHeight } = cropParams;
        
        const ctx = this.canvas.getContext('2d', {
            alpha: false,
            willReadFrequently: false
        });
        
        this.canvas.width = outputWidth;
        this.canvas.height = outputHeight;
        
        // High-quality image rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw cropped region
        ctx.drawImage(
            videoElement,
            left, top, width, height,
            0, 0, outputWidth, outputHeight
        );
        
        return this.canvas;
    }

    // Main processing function with smart caching
    async processFrame(videoElement, cropParams, frameTime) {
        const frameKey = `${frameTime}_${cropParams.left}_${cropParams.top}_${cropParams.width}_${cropParams.height}`;
        
        // Check cache first
        const cached = this.getCachedFrame(frameKey);
        if (cached) {
            return cached;
        }
        
        let processedCanvas;
        
        try {
            // Try WebGL first for maximum performance
            if (this.isInitialized) {
                processedCanvas = await this.processCropWebGL(videoElement, cropParams);
            } else {
                processedCanvas = await this.processCrop2D(videoElement, cropParams);
            }
        } catch (error) {
            console.warn('WebGL processing failed, falling back to 2D:', error);
            processedCanvas = await this.processCrop2D(videoElement, cropParams);
        }
        
        // Cache the result
        const imageData = processedCanvas.getContext('2d').getImageData(0, 0, processedCanvas.width, processedCanvas.height);
        this.setCachedFrame(frameKey, imageData);
        
        return processedCanvas;
    }
}

// Worker message handler
let processor = null;
let offscreenCanvas = null;

self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    try {
        switch (type) {
            case 'init':
                offscreenCanvas = data.canvas;
                processor = new AdvancedCropProcessor();
                
                try {
                    processor.initWebGL(offscreenCanvas);
                    self.postMessage({ type: 'init-success', webglEnabled: true });
                } catch (error) {
                    console.warn('WebGL initialization failed, using 2D fallback:', error);
                    processor.canvas = offscreenCanvas;
                    self.postMessage({ type: 'init-success', webglEnabled: false });
                }
                break;
                
            case 'process-frame':
                if (!processor) {
                    throw new Error('Processor not initialized');
                }
                
                const { videoElement, cropParams, frameTime } = data;
                const result = await processor.processFrame(videoElement, cropParams, frameTime);
                
                self.postMessage({ 
                    type: 'frame-processed', 
                    frameTime,
                    imageData: result.getContext('2d').getImageData(0, 0, result.width, result.height)
                });
                break;
                
            case 'clear-cache':
                if (processor) {
                    processor.frameCache.clear();
                }
                self.postMessage({ type: 'cache-cleared' });
                break;
                
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            error: error.message,
            stack: error.stack 
        });
    }
};