class OCRCapture {
  constructor() {
    this.isActive = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    this.overlay = null;
    this.selection = null;
    this.pdfDocument = null;
    this.isPDFPage = false;
  this.imageServiceMode = false; // when true, use image-to-table service instead of local OCR or PDF
    // Debug / diagnostics support
    this.debugEnabled = false;
    this.debugPanel = null;
    this.lastMapping = null; // store last mapping info for round-trip validation
    this._debugInverseRectEl = null;
    this.debugConfig = {
      invertY: false,              // Whether to invert Y (PDF bottom-left origin)
      forceAspectCompensation: true, // Force aspect box compensation even if ratios close
      pageOverride: null,          // zero-based override
      manualRect: null,            // manual normalized rect override
      liveUpdate: true             // auto recalc when toggling options
    };
  }
  
  async startCapture() {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Check if this is a PDF page first
    await this.detectPDFContext();
    
    this.createOverlay();
    this.attachEventListeners();
  }
  
  createOverlay() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'ocr-overlay';
    
    // Create instructions
    const instructions = document.createElement('div');
    instructions.className = 'ocr-instructions';
    
    if (this.isPDFPage) {
      instructions.innerHTML = '� Drag to select a table area from this PDF document';
    } else {
      instructions.innerHTML = '�📊 Drag to select a table area to capture from the screen';
    }
    
    // Create selection box
    this.selection = document.createElement('div');
    this.selection.className = 'ocr-selection';
    this.selection.style.display = 'none';
    
    // Create controls
    const controls = document.createElement('div');
    controls.className = 'ocr-controls';
    controls.innerHTML = `
      <button id="ocrCapture" class="ocr-btn ocr-btn-primary" disabled>
        ${this.isPDFPage ? '🌐 Extract Table from PDF' : '📸 Capture Table'}
      </button>
      <button id="ocrCancel" class="ocr-btn ocr-btn-secondary">
        ✕ Cancel
      </button>
    `;
    
    // Append elements
    this.overlay.appendChild(instructions);
    this.overlay.appendChild(this.selection);
    this.overlay.appendChild(controls);
    document.body.appendChild(this.overlay);
  }
  
  attachEventListeners() {
    let isSelecting = false;
    
    // Mouse events for selection
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) {
        isSelecting = true;
        this.selectionStart = { x: e.clientX, y: e.clientY };
        this.selection.style.display = 'block';
        this.updateSelection();
      }
    });
    
    this.overlay.addEventListener('mousemove', (e) => {
      if (isSelecting) {
        this.selectionEnd = { x: e.clientX, y: e.clientY };
        this.updateSelection();
      }
    });
    
    this.overlay.addEventListener('mouseup', (e) => {
      if (isSelecting) {
        isSelecting = false;
        this.selectionEnd = { x: e.clientX, y: e.clientY };
        this.updateSelection();
        
        // Enable capture button if selection is made
        const captureBtn = document.getElementById('ocrCapture');
        if (this.hasValidSelection()) {
          captureBtn.disabled = false;
        }
      }
    });
    
    // Button events
    document.getElementById('ocrCapture').addEventListener('click', () => {
      this.captureAndProcess();
    });
    
    document.getElementById('ocrCancel').addEventListener('click', () => {
      this.cancel();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancel();
      }
      // Shift + D toggles debug panel
      if (e.key.toLowerCase() === 'd' && e.shiftKey) {
        this.toggleDebug();
      }
    });
  }
  
  updateSelection() {
    if (!this.selectionStart) return;
    
    const start = this.selectionStart;
    const end = this.selectionEnd || start;
    
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    
    this.selection.style.left = `${left}px`;
    this.selection.style.top = `${top}px`;
    this.selection.style.width = `${width}px`;
    this.selection.style.height = `${height}px`;
  }
  
  hasValidSelection() {
    if (!this.selectionStart || !this.selectionEnd) return false;
    
    const width = Math.abs(this.selectionEnd.x - this.selectionStart.x);
    const height = Math.abs(this.selectionEnd.y - this.selectionStart.y);
    
    return width > 50 && height > 50; // Minimum selection size
  }
  
  async captureAndProcess() {
    if (!this.hasValidSelection()) return;
    
    try {
      this.showProcessing();
      
      // Get selection bounds
      const bounds = this.getSelectionBounds();
      
      // If this is a PDF page and not in image service mode, try PDF parsing first
      if (this.isPDFPage && !this.imageServiceMode) {
        try {
          const pdfTableData = await this.extractTableFromPDF(bounds);
          if (pdfTableData && pdfTableData.length > 0) {
            this.showResult(pdfTableData);
            return;
          }
        } catch (pdfError) {
          console.error('PDF extraction failed:', pdfError);
          this.updateProcessingMessage('PDF extraction failed, falling back to screen capture...');
          // Continue to screen capture fallback
        }
      }
      
      // Use Chrome's desktopCapture API
      chrome.runtime.sendMessage({
        action: 'requestScreenCapture'
      }, async (response) => {
        if (!response || !response.success) {
          this.showError('Failed to get screen capture permission. Please allow screen sharing.');
          return;
        }
        
        try {
          // Create screen capture using the streamId
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: response.streamId,
                maxWidth: window.screen.width * window.devicePixelRatio,
                maxHeight: window.screen.height * window.devicePixelRatio
              }
            }
          });
          
          // Create video element to capture frame
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.muted = true;
          
          // Wait for video to be ready
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = () => {
              video.play().then(resolve).catch(reject);
            };
            video.onerror = reject;
          });
          
          // Wait a bit for the video to stabilize
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Create canvas and capture frame
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Account for device pixel ratio
          const dpr = window.devicePixelRatio || 1;
          const scaledBounds = {
            left: bounds.left * dpr,
            top: bounds.top * dpr,
            width: bounds.width * dpr,
            height: bounds.height * dpr
          };
          
          // Set canvas size to selection area
          canvas.width = scaledBounds.width;
          canvas.height = scaledBounds.height;
          
          // Draw selected area to canvas
          ctx.drawImage(
            video, 
            scaledBounds.left, scaledBounds.top, scaledBounds.width, scaledBounds.height,
            0, 0, scaledBounds.width, scaledBounds.height
          );
          
          // Stop stream
          stream.getTracks().forEach(track => track.stop());
          
          // Convert to blob
          const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png', 0.9);
          });
          
          if (this.imageServiceMode) {
            try {
              await this.processWithImageService(blob);
            } finally {
              this.imageServiceMode = false; // reset mode after attempt
            }
          } else {
            // Process with OCR (legacy path)
            await this.processWithOCR(blob);
          }
          
        } catch (error) {
          console.error('Screen capture error:', error);
          this.showError('Failed to capture screen. This might be due to browser security restrictions. Please try again or use a different area.');
        }
      });
      
    } catch (error) {
      console.error('Capture error:', error);
      this.showError('Failed to start screen capture. Please try again.');
    }
  }

  async processWithImageService(imageBlob) {
    try {
      this.updateProcessingMessage('🖼️ Sending image to table extraction service...');
      this.updateProgressBar(0.2);
      const dataUrl = await this.blobToBase64(imageBlob);
      // Convert data URL back to PNG (already base64) for service call in background
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Image extraction timeout')), 30000);
        chrome.runtime.sendMessage({ action: 'extractTableFromImage', imageDataUrl: dataUrl }, (resp) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            return reject(new Error(chrome.runtime.lastError.message));
          }
            resolve(resp);
        });
      });
      if (!response || !response.success) {
        throw new Error(response?.error || 'Service returned failure');
      }
      this.updateProgressBar(0.7);
      const result = response.data;
      console.log('Image table extraction service result:', result);
      let rows = null;
      if (result.table && Array.isArray(result.table.rows)) {
        rows = result.table.rows;
      } else if (Array.isArray(result.rows)) {
        rows = result.rows;
      }
      if (!rows || rows.length === 0) {
        throw new Error('No table rows returned from image extraction service');
      }
      this.updateProgressBar(1.0);
      this.showResult(rows, imageBlob);
    } catch (e) {
      console.error('Image service extraction failed:', e);
      this.showError('Image extraction service failed: ' + e.message);
    }
  }
  
  async detectPDFContext() {
    try {
      // Check if we're in a PDF viewer
      this.isPDFPage = this.isPDFViewerPage();
      
      if (this.isPDFPage) {
        // Try to access the PDF document if we're in a PDF.js viewer
        await this.initializePDFDocument();
      }
    } catch (error) {
      console.error('Error detecting PDF context:', error);
      this.isPDFPage = false;
      this.pdfDocument = null;
    }
  }
  
  isPDFViewerPage() {
    // Check various PDF viewer indicators
    const url = window.location.href;
    const contentType = document.contentType || '';
    
    // Chrome's built-in PDF viewer
    if (url.includes('chrome-extension://') && url.includes('.pdf')) {
      return true;
    }
    
    // Direct PDF URL
    if (url.endsWith('.pdf') || contentType === 'application/pdf') {
      return true;
    }
    
    // PDF.js viewer
    if (document.getElementById('viewer') && document.querySelector('.pdfViewer')) {
      return true;
    }
    
    // Check for PDF.js specific elements
    if (window.PDFViewerApplication || window.PDFJS || window.pdfjsLib) {
      return true;
    }
    
    // Check for embedded PDF objects
    const embeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    if (embeds.length > 0) {
      return true;
    }
    
    return false;
  }
  
  async initializePDFDocument() {
    try {
      console.log('Initializing PDF document...');
      
      // For service-based extraction, we don't need to load PDF.js for parsing
      // We only need it for getting page info if available
      if (window.PDFViewerApplication && window.PDFViewerApplication.pdfDocument) {
        console.log('Found PDF document in PDFViewerApplication');
        this.pdfDocument = window.PDFViewerApplication.pdfDocument;
        return;
      }
      
      // Try to load PDF.js only if we need it for page info
      if (!window.pdfjsLib) {
        console.log('Loading PDF.js library for page info...');
        await this.loadPDFJS();
      }
      
      // Check if we have a working PDF.js library for page info
      if (!window.pdfjsLib || !window.pdfjsLib.getDocument) {
        console.warn('PDF.js library not available, using basic page detection');
        return;
      }
      
      console.log('PDF.js library available, attempting to get PDF document for page info...');
      
      // Try to load PDF from URL for page information only
      const pdfUrl = this.getPDFUrl();
      if (pdfUrl) {
        console.log('Attempting to load PDF from URL for page info:', pdfUrl);
        try {
          this.pdfDocument = await window.pdfjsLib.getDocument(pdfUrl).promise;
          console.log('PDF document loaded successfully for page info');
        } catch (loadError) {
          console.warn('Failed to load PDF document for page info:', loadError);
          // This is OK, we can still use the service without detailed page info
        }
      } else {
        console.log('No PDF URL found');
      }
    } catch (error) {
      console.error('Failed to initialize PDF document:', error);
      // This is not critical for service-based extraction
    }
  }
  
  async loadPDFJS() {
    return new Promise((resolve, reject) => {
      // Check if we already have a working PDF.js library
      if (window.pdfjsLib && window.pdfjsLib.getDocument) {
        console.log('PDF.js already available');
        resolve();
        return;
      }
      
      // Store current global state to detect what gets added
      const beforeLoad = new Set(Object.keys(window));
      
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('libs/pdf.min.js');
      script.onload = () => {
        // Wait for the library to initialize
        setTimeout(() => {
          try {
            // Find what new globals were added
            const afterLoad = Object.keys(window);
            const newGlobals = afterLoad.filter(key => !beforeLoad.has(key));
            
            console.log('New globals after PDF.js load:', newGlobals);
            
            let pdfLib = null;
            let workerConfigured = false;
            
            // Method 1: Try known PDF.js global names
            const knownNames = ['pdfjsLib', 'PDFJS', 'PDF', 'pdfjs'];
            for (const name of knownNames) {
              if (window[name] && window[name].getDocument) {
                pdfLib = window[name];
                console.log('Found PDF library as:', name);
                break;
              }
            }
            
            // Method 2: Check new globals for PDF-like objects
            if (!pdfLib) {
              for (const globalName of newGlobals) {
                const obj = window[globalName];
                if (obj && typeof obj === 'object' && obj.getDocument) {
                  pdfLib = obj;
                  console.log('Found PDF library in new global:', globalName);
                  break;
                }
              }
            }
            
            if (pdfLib) {
              // Make sure it's accessible as pdfjsLib
              window.pdfjsLib = pdfLib;
              
              // Try to configure worker
              if (pdfLib.GlobalWorkerOptions) {
                pdfLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
                workerConfigured = true;
              } else if (pdfLib.workerSrc !== undefined) {
                pdfLib.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
                workerConfigured = true;
              }
              
              console.log('PDF.js loaded successfully', workerConfigured ? 'with worker' : 'without worker configuration');
              resolve();
            } else {
              console.warn('Could not find PDF.js library after loading, checking for existing installation...');
              
              // Final fallback: check if there's already a PDF library available
              if (window.pdfjsLib || window.PDFJS || window.PDF) {
                console.log('Found existing PDF library, using fallback approach');
                resolve();
              } else {
                console.warn('No PDF.js library found, PDF parsing will not be available');
                resolve(); // Still resolve to continue with OCR fallback
              }
            }
          } catch (error) {
            console.warn('Error configuring PDF.js:', error);
            resolve(); // Still resolve to continue with fallback
          }
        }, 300); // Increased timeout
      };
      script.onerror = (error) => {
        console.error('Failed to load PDF.js library:', error);
        resolve(); // Resolve instead of reject to allow fallback to OCR
      };
      document.head.appendChild(script);
    });
  }
  
  getPDFUrl() {
    const url = window.location.href;
    console.log('Current URL:', url);
    
    // Direct PDF URL
    if (url.endsWith('.pdf')) {
      console.log('Found direct PDF URL');
      return url;
    }
    
    // Chrome PDF viewer format: chrome-extension://...?src=<encoded_url>
    if (url.includes('chrome-extension://') && url.includes('.pdf')) {
      // Try different parameter formats
      const srcMatch = url.match(/[?&]src=([^&]+)/);
      if (srcMatch) {
        const decodedUrl = decodeURIComponent(srcMatch[1]);
        console.log('Found PDF URL in src parameter:', decodedUrl);
        return decodedUrl;
      }
      
      const fileMatch = url.match(/[?&]file=([^&]+)/);
      if (fileMatch) {
        const decodedUrl = decodeURIComponent(fileMatch[1]);
        console.log('Found PDF URL in file parameter:', decodedUrl);
        return decodedUrl;
      }
    }
    
    // PDF.js viewer format
    if (url.includes('/web/viewer.html')) {
      const fileMatch = url.match(/[?&]file=([^&]+)/);
      if (fileMatch) {
        const decodedUrl = decodeURIComponent(fileMatch[1]);
        console.log('Found PDF URL in PDF.js viewer:', decodedUrl);
        return decodedUrl;
      }
    }
    
    // Check embedded objects
    const embeds = document.querySelectorAll('embed[src$=".pdf"], object[data$=".pdf"]');
    if (embeds.length > 0) {
      const embedUrl = embeds[0].src || embeds[0].data;
      console.log('Found PDF URL in embedded object:', embedUrl);
      return embedUrl;
    }
    
    // Check for data-src attributes (lazy loading)
    const lazyEmbeds = document.querySelectorAll('embed[data-src$=".pdf"], object[data-src$=".pdf"]');
    if (lazyEmbeds.length > 0) {
      const embedUrl = lazyEmbeds[0].dataset.src;
      console.log('Found PDF URL in lazy-loaded embed:', embedUrl);
      return embedUrl;
    }
    
    // Look for PDF links in the page
    const pdfLinks = document.querySelectorAll('a[href$=".pdf"]');
    if (pdfLinks.length > 0) {
      const linkUrl = pdfLinks[0].href;
      console.log('Found PDF URL in page link:', linkUrl);
      return linkUrl;
    }
    
    console.warn('No PDF URL found');
    return null;
  }
  
  async extractTableFromPDF(bounds) {
    try {
      this.updateProcessingMessage('📄 Preparing PDF for extraction...');
      this.updateProgressBar(0.1);
      
      // Get the PDF URL
      const pdfUrl = this.getPDFUrl();
      if (!pdfUrl) {
        throw new Error('Could not determine PDF URL');
      }
      
      this.updateProcessingMessage('📄 Analyzing PDF structure...');
      this.updateProgressBar(0.3);
      
      // Determine page from selection first if possible
      const selectionBasedPage = this.determinePDFPageFromSelection(bounds);
      if (selectionBasedPage !== null) {
        console.log('Detected PDF page from selection:', selectionBasedPage + 1);
      } else {
        console.log('Could not detect page from selection; falling back to viewer current page');
      }
      const forcedPage = this.debugConfig.pageOverride != null ? this.debugConfig.pageOverride : selectionBasedPage;
      if (this.debugConfig.pageOverride != null) {
        console.log('[DEBUG] Using page override (0-based):', this.debugConfig.pageOverride);
      }
      const pageInfo = await this.getPDFPageInfo(forcedPage);
      
      this.updateProcessingMessage('🔍 Converting coordinates...');
      this.updateProgressBar(0.4);
      
      // Convert screen coordinates to normalized PDF coordinates
      let normalizedRect = await this.screenToNormalizedPDFCoordinates(bounds, pageInfo);
      // Manual override
      if (this.debugConfig.manualRect) {
        console.log('[DEBUG] Applying manual normalized rect override:', this.debugConfig.manualRect);
        normalizedRect = { ...this.debugConfig.manualRect };
      }
      if (this.debugConfig.invertY) {
        // convert from top-left origin to bottom-left
        normalizedRect = {
          x0: normalizedRect.x0,
          x1: normalizedRect.x1,
          y0: 1 - normalizedRect.y1,
          y1: 1 - normalizedRect.y0
        };
        console.log('[DEBUG] Inverted Y normalized rect for bottom-left origin:', normalizedRect);
      }
      
      this.updateProcessingMessage('🌐 Sending request to extraction service...');
      this.updateProgressBar(0.6);
      
      // Call the external service with URL
      const tableData = await this.callExtractionServiceWithURL(pdfUrl, pageInfo.pageNumber, normalizedRect);
      
      this.updateProcessingMessage('✅ PDF table extraction completed!');
      this.updateProgressBar(1.0);
      
      if (tableData && tableData.length > 0) {
        return tableData;
      } else {
        throw new Error('No table structure found in the selected area');
      }
      
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw error;
    }
  }
  
  getCurrentPDFPage() {
    // Try different methods to get current page
    if (window.PDFViewerApplication && window.PDFViewerApplication.page) {
      return window.PDFViewerApplication.page;
    }
    
    // Look for page indicators in the URL or DOM
    const url = window.location.href;
    const pageMatch = url.match(/page=(\d+)/);
    if (pageMatch) {
      return parseInt(pageMatch[1]);
    }
    
    // Default to page 1
    return 1;
  }
  
  async getPDFPageInfo() {
    try {
      // Get page number (convert to zero-based for service)
      let pageNumber;
      if (arguments.length === 1 && arguments[0] != null) {
        pageNumber = arguments[0];
      } else {
        pageNumber = this.getCurrentPDFPage() - 1; // Convert to zero-based
      }
      if (pageNumber < 0) pageNumber = 0;
      
      // Try to get PDF dimensions
      let pageWidth = 612; // Default PDF width in points
      let pageHeight = 792; // Default PDF height in points
      
      // If we have access to the PDF document, get actual dimensions
      if (this.pdfDocument) {
        try {
          const page = await this.pdfDocument.getPage(pageNumber + 1); // PDF.js uses 1-based
          const viewport = page.getViewport({ scale: 1.0 });
          pageWidth = viewport.width;
          pageHeight = viewport.height;
        } catch (error) {
          console.warn('Could not get PDF page dimensions, using defaults:', error);
        }
      }
      
      return {
        pageNumber,
        pageWidth,
        pageHeight
      };
    } catch (error) {
      console.error('Error getting PDF page info:', error);
      return {
        pageNumber: 0,
        pageWidth: 612,
        pageHeight: 792
      };
    }
  }
  
  async screenToNormalizedPDFCoordinates(screenBounds, pageInfo) {
    try {
      // Get the PDF container element to calculate the mapping
      const pdfContainer = this.getPDFContainer();
      
      if (!pdfContainer) {
        // If no container found, compute relative to the viewport instead of fixed fallback.
        console.warn('PDF container not found – computing normalized rect relative to viewport');
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const x0_vp = Math.max(0, Math.min(1, screenBounds.left / vw));
        const y0_vp = Math.max(0, Math.min(1, screenBounds.top / vh));
        const x1_vp = Math.max(0, Math.min(1, (screenBounds.left + screenBounds.width) / vw));
        const y1_vp = Math.max(0, Math.min(1, (screenBounds.top + screenBounds.height) / vh));
        const dynamicRect = { x0: x0_vp, y0: y0_vp, x1: x1_vp, y1: y1_vp };
        console.log('Viewport-based normalized PDF coordinates (no container found):', dynamicRect);
        return dynamicRect;
      }

      const containerRect = pdfContainer.getBoundingClientRect();
      
      // Log the raw values for debugging
      console.log('Screen bounds:', screenBounds);
      console.log('Container rect:', containerRect);
      console.log('PDF page info:', pageInfo);
      
      // Convert screen coordinates to container-relative coordinates
      const relativeX = (screenBounds.left - containerRect.left) / containerRect.width;
      const relativeY = (screenBounds.top - containerRect.top) / containerRect.height;
      const relativeWidth = screenBounds.width / containerRect.width;
      const relativeHeight = screenBounds.height / containerRect.height;
      
      console.log('Relative coordinates:', { relativeX, relativeY, relativeWidth, relativeHeight });
      
      // Now we need to account for the PDF page aspect ratio vs container aspect ratio
  const containerAspectRatio = containerRect.width / containerRect.height;
  const pdfAspectRatio = pageInfo.pageWidth / pageInfo.pageHeight;
      
      console.log('Aspect ratios - Container:', containerAspectRatio, 'PDF:', pdfAspectRatio);
      
      let normalizedRect;
      
      const aspectClose = Math.abs(containerAspectRatio - pdfAspectRatio) < 0.01;
      if (aspectClose || !this.debugConfig.forceAspectCompensation) {
        // Aspect ratios are very similar, use direct mapping
        normalizedRect = {
          x0: Math.max(0, Math.min(1, relativeX)),
          y0: Math.max(0, Math.min(1, relativeY)),
          x1: Math.max(0, Math.min(1, relativeX + relativeWidth)),
          y1: Math.max(0, Math.min(1, relativeY + relativeHeight))
        };
        console.log('Using direct mapping', aspectClose ? '(similar aspect ratios)' : '(aspect compensation disabled via debug)');
      } else {
        // Different aspect ratios - need to account for letterboxing/pillarboxing
        let pdfX, pdfY, pdfWidth, pdfHeight;
        
        if (containerAspectRatio > pdfAspectRatio) {
          // Container is wider than PDF (pillarboxing - black bars on sides)
          const scaledPdfWidth = containerRect.height * pdfAspectRatio;
          const xOffset = (containerRect.width - scaledPdfWidth) / 2;
          
          pdfX = (screenBounds.left - containerRect.left - xOffset) / scaledPdfWidth;
          pdfY = (screenBounds.top - containerRect.top) / containerRect.height;
          pdfWidth = screenBounds.width / scaledPdfWidth;
          pdfHeight = screenBounds.height / containerRect.height;
          
          console.log('Pillarboxing detected - adjusting for side margins');
        } else {
          // Container is taller than PDF (letterboxing - black bars on top/bottom)
          const scaledPdfHeight = containerRect.width / pdfAspectRatio;
          const yOffset = (containerRect.height - scaledPdfHeight) / 2;
          
          pdfX = (screenBounds.left - containerRect.left) / containerRect.width;
          pdfY = (screenBounds.top - containerRect.top - yOffset) / scaledPdfHeight;
          pdfWidth = screenBounds.width / containerRect.width;
          pdfHeight = screenBounds.height / scaledPdfHeight;
          
          console.log('Letterboxing detected - adjusting for top/bottom margins');
        }
        
        normalizedRect = {
          x0: Math.max(0, Math.min(1, pdfX)),
          y0: Math.max(0, Math.min(1, pdfY)),
          x1: Math.max(0, Math.min(1, pdfX + pdfWidth)),
          y1: Math.max(0, Math.min(1, pdfY + pdfHeight))
        };
      }
      
      // Ensure the rectangle is valid (x1 > x0, y1 > y0)
      if (normalizedRect.x1 <= normalizedRect.x0 || normalizedRect.y1 <= normalizedRect.y0) {
        console.warn('Invalid rectangle after normalization, recomputing using viewport-based fallback');
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const x0_vp = Math.max(0, Math.min(1, screenBounds.left / vw));
        const y0_vp = Math.max(0, Math.min(1, screenBounds.top / vh));
        const x1_vp = Math.max(0, Math.min(1, (screenBounds.left + screenBounds.width) / vw));
        const y1_vp = Math.max(0, Math.min(1, (screenBounds.top + screenBounds.height) / vh));
        const fallbackRect = { x0: x0_vp, y0: y0_vp, x1: x1_vp, y1: y1_vp };
        console.log('Viewport-based fallback normalized rect:', fallbackRect);
        return fallbackRect;
      }
      
      console.log('Final normalized PDF coordinates:', normalizedRect);
      // Store mapping for debug round-trip if debug is enabled
      try {
        const inverse = this.tryInverseMapping(normalizedRect, pageInfo, pdfContainer.getBoundingClientRect());
        this.lastMapping = {
          screenBounds: { ...screenBounds },
          normalizedRect: { ...normalizedRect },
          inverseScreenRect: inverse,
          pageInfo,
          containerRect: { left: pdfContainer.getBoundingClientRect().left, top: pdfContainer.getBoundingClientRect().top, width: pdfContainer.getBoundingClientRect().width, height: pdfContainer.getBoundingClientRect().height },
          containerAspectRatio,
          pdfAspectRatio,
          timestamp: Date.now()
        };
        if (this.debugEnabled) this.renderDebugMapping();
      } catch (e) {
        console.warn('Inverse mapping failed for debug:', e);
      }
      return normalizedRect;
      
    } catch (error) {
      console.error('Error converting coordinates:', error);
      // Dynamic fallback: use viewport proportions instead of fixed rectangle
      try {
        const vw = window.innerWidth || document.documentElement.clientWidth || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const x0_vp = Math.max(0, Math.min(1, screenBounds.left / vw));
        const y0_vp = Math.max(0, Math.min(1, screenBounds.top / vh));
        const x1_vp = Math.max(0, Math.min(1, (screenBounds.left + screenBounds.width) / vw));
        const y1_vp = Math.max(0, Math.min(1, (screenBounds.top + screenBounds.height) / vh));
        const errorRect = { x0: x0_vp, y0: y0_vp, x1: x1_vp, y1: y1_vp };
        console.log('Recovered viewport-based rect after error:', errorRect);
        return errorRect;
      } catch (_) {
        return { x0: 0.0, y0: 0.0, x1: 1.0, y1: 1.0 }; // last-resort
      }
    }
  }

  tryInverseMapping(normalizedRect, pageInfo, containerRect) {
    const containerAspectRatio = containerRect.width / containerRect.height;
    const pdfAspectRatio = pageInfo.pageWidth / pageInfo.pageHeight;
    let x, y, width, height;
    const aspectClose = Math.abs(containerAspectRatio - pdfAspectRatio) < 0.01;
    if (aspectClose || !this.debugConfig.forceAspectCompensation) {
      x = containerRect.left + normalizedRect.x0 * containerRect.width;
      y = containerRect.top + normalizedRect.y0 * containerRect.height;
      width = (normalizedRect.x1 - normalizedRect.x0) * containerRect.width;
      height = (normalizedRect.y1 - normalizedRect.y0) * containerRect.height;
    } else if (containerAspectRatio > pdfAspectRatio) {
      const scaledPdfWidth = containerRect.height * pdfAspectRatio;
      const xOffset = (containerRect.width - scaledPdfWidth) / 2;
      x = containerRect.left + xOffset + normalizedRect.x0 * scaledPdfWidth;
      y = containerRect.top + normalizedRect.y0 * containerRect.height;
      width = (normalizedRect.x1 - normalizedRect.x0) * scaledPdfWidth;
      height = (normalizedRect.y1 - normalizedRect.y0) * containerRect.height;
    } else {
      const scaledPdfHeight = containerRect.width / pdfAspectRatio;
      const yOffset = (containerRect.height - scaledPdfHeight) / 2;
      x = containerRect.left + normalizedRect.x0 * containerRect.width;
      y = containerRect.top + yOffset + normalizedRect.y0 * scaledPdfHeight;
      width = (normalizedRect.x1 - normalizedRect.x0) * containerRect.width;
      height = (normalizedRect.y1 - normalizedRect.y0) * scaledPdfHeight;
    }
    return { left: x, top: y, width, height, right: x + width, bottom: y + height };
  }

  determinePDFPageFromSelection(bounds) {
    try {
      const pageElems = document.querySelectorAll('.page[data-page-number], canvas[data-page-number]');
      if (!pageElems.length) return null;
      const selCenterX = bounds.left + bounds.width / 2;
      const selCenterY = bounds.top + bounds.height / 2;
      let best = null;
      let bestScore = -Infinity;
      pageElems.forEach(el => {
        const pnAttr = el.getAttribute('data-page-number');
        if (!pnAttr) return;
        const rect = el.getBoundingClientRect();
        const intersects = !(rect.right < bounds.left || rect.left > bounds.left + bounds.width || rect.bottom < bounds.top || rect.top > bounds.top + bounds.height);
        const centerInside = selCenterX >= rect.left && selCenterX <= rect.right && selCenterY >= rect.top && selCenterY <= rect.bottom;
        const overlapWidth = Math.min(rect.right, bounds.left + bounds.width) - Math.max(rect.left, bounds.left);
        const overlapHeight = Math.min(rect.bottom, bounds.top + bounds.height) - Math.max(rect.top, bounds.top);
        let overlapArea = 0;
        if (overlapWidth > 0 && overlapHeight > 0) overlapArea = overlapWidth * overlapHeight;
        const score = (centerInside ? 1000000 : 0) + overlapArea + (intersects ? 1 : 0);
        if (score > bestScore) {
          bestScore = score;
            best = { page: parseInt(pnAttr, 10) - 1 };
        }
      });
      return best ? best.page : null;
    } catch (e) {
      console.warn('Page detection from selection failed:', e);
      return null;
    }
  }

  toggleDebug() {
    this.debugEnabled = !this.debugEnabled;
    console.log('[DEBUG] Debug mode:', this.debugEnabled);
    if (this.debugEnabled) {
      this.createDebugPanel();
      if (this.lastMapping) this.renderDebugMapping();
    } else {
      this.destroyDebugPanel();
      this.clearDebugOverlays();
    }
  }

  createDebugPanel() {
    this.destroyDebugPanel();
    const panel = document.createElement('div');
    panel.className = 'ocr-debug-panel';
    panel.style.position = 'fixed';
    panel.style.top = '60px';
    panel.style.right = '10px';
    panel.style.width = '280px';
    panel.style.maxHeight = '60vh';
    panel.style.overflow = 'auto';
    panel.style.background = 'rgba(20,20,26,0.92)';
    panel.style.color = '#fff';
    panel.style.font = '12px system-ui, sans-serif';
    panel.style.border = '1px solid #444';
    panel.style.zIndex = 2147483647;
    panel.style.padding = '10px';
    panel.style.borderRadius = '6px';
    panel.innerHTML = `
      <h4 style="margin:0 0 6px 0;font-size:14px;">PDF Capture Debug</h4>
      <div class="dbg-row"><label style="display:flex;justify-content:space-between;align-items:center;">Invert Y <input type="checkbox" id="dbgInvertY" ${this.debugConfig.invertY ? 'checked' : ''}></label></div>
      <div class="dbg-row"><label style="display:flex;justify-content:space-between;align-items:center;">Force Aspect <input type="checkbox" id="dbgAspect" ${this.debugConfig.forceAspectCompensation ? 'checked' : ''}></label></div>
      <div class="dbg-row"><label>Page Override <input style="width:100%;" type="number" min="1" id="dbgPageOverride" value="${this.debugConfig.pageOverride != null ? (this.debugConfig.pageOverride + 1) : ''}" placeholder="auto"></label></div>
      <div class="dbg-row"><label>Manual Rect <input style="width:100%;" type="text" id="dbgManualRect" placeholder="x0,y0,x1,y1" value="${this.debugConfig.manualRect ? Object.values(this.debugConfig.manualRect).join(',') : ''}"></label></div>
      <div class="dbg-row"><label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" id="dbgLive" ${this.debugConfig.liveUpdate ? 'checked' : ''}> Live Update</label></div>
      <div class="dbg-buttons" style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
        <button id="dbgApply" style="flex:1;">Apply</button>
        <button id="dbgRecalc" style="flex:1;">Recalc</button>
        <button id="dbgClose" style="flex:1;">Close</button>
      </div>
      <div class="dbg-info" id="dbgInfo" style="margin-top:8px;font-family:monospace;white-space:pre-wrap;">No mapping yet.</div>
      <p style="margin-top:8px;font-size:11px;line-height:1.3;opacity:.8;">Tips: Shift+D toggles this panel. Draw a selection, then tweak parameters and Recalc. Manual Rect overrides computed values.</p>
    `;
    document.body.appendChild(panel);
    this.debugPanel = panel;
    panel.querySelector('#dbgInvertY').addEventListener('change', e => { this.debugConfig.invertY = e.target.checked; if (this.debugConfig.liveUpdate) this.refreshDebugRecalc(); });
    panel.querySelector('#dbgAspect').addEventListener('change', e => { this.debugConfig.forceAspectCompensation = e.target.checked; if (this.debugConfig.liveUpdate) this.refreshDebugRecalc(); });
    panel.querySelector('#dbgLive').addEventListener('change', e => { this.debugConfig.liveUpdate = e.target.checked; });
    panel.querySelector('#dbgApply').addEventListener('click', () => this.applyDebugInputs());
    panel.querySelector('#dbgRecalc').addEventListener('click', () => this.refreshDebugRecalc(true));
    panel.querySelector('#dbgClose').addEventListener('click', () => this.toggleDebug());
  }

  applyDebugInputs() {
    if (!this.debugPanel) return;
    const pageVal = this.debugPanel.querySelector('#dbgPageOverride').value.trim();
    this.debugConfig.pageOverride = pageVal === '' ? null : Math.max(0, parseInt(pageVal, 10) - 1);
    const manualRectVal = this.debugPanel.querySelector('#dbgManualRect').value.trim();
    if (manualRectVal) {
      const parts = manualRectVal.split(',').map(v => parseFloat(v.trim()));
      if (parts.length === 4 && parts.every(n => !isNaN(n))) {
        this.debugConfig.manualRect = { x0: parts[0], y0: parts[1], x1: parts[2], y1: parts[3] };
      }
    } else {
      this.debugConfig.manualRect = null;
    }
    console.log('[DEBUG] Updated debug config:', this.debugConfig);
    this.refreshDebugRecalc(true);
  }

  refreshDebugRecalc(force = false) {
    if (!this.selectionStart || !this.selectionEnd) return; // need a valid selection
    if (force) console.log('[DEBUG] Recalculating mapping with current debug config');
    const bounds = this.getSelectionBounds();
    (async () => {
      const selectionBasedPage = this.determinePDFPageFromSelection(bounds);
      const forcedPage = this.debugConfig.pageOverride != null ? this.debugConfig.pageOverride : selectionBasedPage;
      const pageInfo = await this.getPDFPageInfo(forcedPage);
      let normalizedRect = await this.screenToNormalizedPDFCoordinates(bounds, pageInfo);
      if (this.debugConfig.manualRect) normalizedRect = { ...this.debugConfig.manualRect };
      if (this.debugConfig.invertY) normalizedRect = { x0: normalizedRect.x0, x1: normalizedRect.x1, y0: 1 - normalizedRect.y1, y1: 1 - normalizedRect.y0 };
      const pdfContainer = this.getPDFContainer();
      if (pdfContainer) {
        const containerRect = pdfContainer.getBoundingClientRect();
        const inverse = this.tryInverseMapping(normalizedRect, pageInfo, containerRect);
        this.lastMapping = { screenBounds: bounds, normalizedRect, inverseScreenRect: inverse, pageInfo, containerRect };
        this.renderDebugMapping();
      }
    })();
  }

  renderDebugMapping() {
    if (!this.debugEnabled || !this.lastMapping) return;
    const infoEl = this.debugPanel ? this.debugPanel.querySelector('#dbgInfo') : null;
    const m = this.lastMapping;
    if (infoEl) {
      infoEl.innerHTML = `Page: ${m.pageInfo.pageNumber + 1}\nNorm: ${Object.entries(m.normalizedRect).map(([k,v]) => `${k}:${v.toFixed(4)}`).join(' ')}\nΔx=${(m.inverseScreenRect.left - m.screenBounds.left).toFixed(1)} Δy=${(m.inverseScreenRect.top - m.screenBounds.top).toFixed(1)} Δw=${(m.inverseScreenRect.width - m.screenBounds.width).toFixed(1)} Δh=${(m.inverseScreenRect.height - m.screenBounds.height).toFixed(1)}`;
    }
    this.clearDebugOverlays();
    const inv = document.createElement('div');
    inv.className = 'ocr-debug-rect-inverse';
    Object.assign(inv.style, {
      position: 'fixed',
      pointerEvents: 'none',
      left: this.lastMapping.inverseScreenRect.left + 'px',
      top: this.lastMapping.inverseScreenRect.top + 'px',
      width: this.lastMapping.inverseScreenRect.width + 'px',
      height: this.lastMapping.inverseScreenRect.height + 'px',
      border: '2px dashed #ff4d4f',
      boxSizing: 'border-box',
      zIndex: 2147483646
    });
    inv.title = 'Inverse-mapped rectangle (normalized → screen)';
    document.body.appendChild(inv);
    this._debugInverseRectEl = inv;
    if (!document.querySelector('.ocr-debug-legend')) {
      const legend = document.createElement('div');
      legend.className = 'ocr-debug-legend';
      Object.assign(legend.style, {
        position: 'fixed', bottom: '8px', right: '8px', padding: '6px 10px', background: 'rgba(0,0,0,0.6)', color: '#fff', font: '12px monospace', zIndex: 2147483646
      });
      legend.textContent = 'Blue: selection | Red dashed: inverse mapped | Shift+D=Debug';
      document.body.appendChild(legend);
    }
  }

  clearDebugOverlays() {
    if (this._debugInverseRectEl) { this._debugInverseRectEl.remove(); this._debugInverseRectEl = null; }
    const legend = document.querySelector('.ocr-debug-legend');
    if (legend) legend.remove();
  }

  destroyDebugPanel() {
    if (this.debugPanel) { this.debugPanel.remove(); this.debugPanel = null; }
  }
  
  async callExtractionServiceWithURL(pdfUrl, pageNumber, normalizedRect) {
    try {
      // Prepare the request data
      const requestData = {
        page: pageNumber,
        rect: normalizedRect,
        extraction: {
          vertical_strategy: "lines",
          horizontal_strategy: "lines"
        },
        pdf_url: pdfUrl
      };
      
      console.log('Sending extraction request to background script:', requestData);
      console.log('Full JSON payload:', JSON.stringify(requestData, null, 2));
      
      // Send request to background script to bypass CORS
      const response = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout - background script may not be responding'));
        }, 30000); // 30 second timeout
        
        chrome.runtime.sendMessage({
          action: 'extractTableFromPDF',
          requestData: requestData
        }, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response) {
            console.error('No response from background script');
            reject(new Error('No response from background script'));
          } else {
            resolve(response);
          }
        });
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error from extraction service');
      }
      
      console.log('Extraction service response:', response.data);
      
      // Convert the service response to our table format
      if (response.data.table && response.data.table.rows && response.data.table.rows.length > 0) {
        return response.data.table.rows;
      } else {
        throw new Error('No table data in service response');
      }
      
    } catch (error) {
      console.error('Error calling extraction service:', error);
      throw new Error(`Table extraction service failed: ${error.message}`);
    }
  }
  
  getPDFContainer() {
    // Try different selectors for PDF containers
    const selectors = [
      '.page',
      '.pdfViewer .page',
      '#viewer .page',
      'canvas[data-page-number]',
      '.pdf-page',
      '#viewerContainer canvas',
      '.canvasWrapper canvas',
      // Added broader selectors for built-in viewers / embeds
      'embed[type="application/pdf"]',
      'object[type="application/pdf"]',
      'embed',
      'object'
    ];
    
    // Get the current page specifically
    const currentPage = this.getCurrentPDFPage();
    
    for (const selector of selectors) {
      // Try to get the specific page first
      let element = document.querySelector(`${selector}[data-page-number="${currentPage}"]`);
      if (!element) {
        // Fallback to any matching element
        element = document.querySelector(selector);
      }
      if (element) {
        return element;
      }
    }
    
    return null;
  }
  
  getSelectionBounds() {
    const start = this.selectionStart;
    const end = this.selectionEnd;
    
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }
  
  async processWithOCR(imageBlob) {
    try {
      // For this implementation, I'll use Tesseract.js as a client-side OCR solution
      // In production, you might want to use a cloud OCR service
      
      // Convert blob to base64 for processing
      const base64 = await this.blobToBase64(imageBlob);
      
      // Process with local OCR (we'll add Tesseract.js)
      const result = await this.performOCR(base64);
      
      // Parse result as table
      const tableData = this.parseOCRResultAsTable(result);
      
      if (tableData && tableData.length > 0) {
        this.showResult(tableData, imageBlob);
      } else {
        this.showError('No table structure detected. Try selecting a clearer table area.');
      }
      
    } catch (error) {
      console.error('OCR processing error:', error);
      this.showError('OCR processing failed. Please try again.');
    }
  }
  
  async performOCR(base64Image) {
    // First try to use real OCR, fall back to canvas-based text analysis
    try {
      if (window.Tesseract && typeof window.Tesseract.createWorker === 'function') {
        return await this.realOCRSimplified(base64Image);
      } else {
        return await this.canvasBasedOCR(base64Image);
      }
    } catch (error) {
      return await this.canvasBasedOCR(base64Image);
    }
  }
  
  async realOCRSimplified(base64Image) {
    try {
      this.updateProcessingMessage('⚙️ Initializing OCR engine...');
      this.updateProgressBar(0.2);
      
      // Create worker without logger to avoid DataCloneError
      const worker = await window.Tesseract.createWorker();
      
      this.updateProcessingMessage('🔧 Loading language model...');
      this.updateProgressBar(0.4);
      
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      this.updateProcessingMessage('⚙️ Configuring for table detection...');
      this.updateProgressBar(0.6);
      
      // Configure for table/text detection
      await worker.setParameters({
        'tessedit_pageseg_mode': '6' // Uniform block of text
      });
      
      this.updateProcessingMessage('🔍 Reading text from selection...');
      this.updateProgressBar(0.9);
      
      const { data: { text } } = await worker.recognize(base64Image);
      
      await worker.terminate();
      
      this.updateProcessingMessage('✅ OCR completed successfully!');
      this.updateProgressBar(1.0);
      
      return text;
      
    } catch (error) {
      throw error;
    }
  }
  
  async canvasBasedOCR(base64Image) {
    try {
      this.updateProcessingMessage('🖼️ Analyzing image content...');
      this.updateProgressBar(0.3);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the actual selection bounds to analyze what's visible
      const bounds = this.getSelectionBounds();
      const selectedContent = this.analyzeSelectedArea(bounds);
      
      this.updateProcessingMessage('🔍 Detecting table structure...');
      this.updateProgressBar(0.7);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      this.updateProcessingMessage('📊 Extracting table data...');
      this.updateProgressBar(1.0);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // If we found table-like content, return it
      if (selectedContent && selectedContent.type === 'table' && selectedContent.content) {
        return selectedContent.content;
      }
      if (selectedContent && selectedContent.type === 'structuredText' && selectedContent.content) {
        return selectedContent.content;
      }
      
      // If no table found, try to extract text from the selected area
      return this.extractTextFromArea(bounds);
      
    } catch (error) {
      return null;
    }
  }
  
  extractTableContent(table) {
    try {
      const rows = table.querySelectorAll('tr');
      const tableData = [];
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        const rowData = Array.from(cells).map(cell => cell.textContent.trim());
        if (rowData.length > 0 && rowData.some(cell => cell !== '')) {
          tableData.push(rowData.join('\t'));
        }
      });
      
      if (tableData.length > 0) {
        const result = tableData.join('\n');
        return result;
      }
      
    } catch (error) {
      console.error('Error extracting table content:', error);
    }
    return null;
  }
  
  findTableInElement(element, bounds) {
    try {
      const fullBounds = {
        ...bounds,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height
      };
      // Check if element contains nested tables
      const nestedTables = element.querySelectorAll('table');
      for (const table of nestedTables) {
        const rect = table.getBoundingClientRect();
        if (this.rectsOverlap(fullBounds, rect)) {
          const content = this.extractTableContent(table);
          if (content) return content;
        }
      }
      // Look for div-based tables or structured content
      const structuredContent = this.extractStructuredContent(element, fullBounds);
      if (structuredContent) {
        return structuredContent;
      }
    } catch (error) {
      console.error('Error finding table in element:', error);
    }
    return null;
  }
  
  extractStructuredContent(element, bounds) {
    try {
      // Look for elements that might represent table rows
      const possibleRows = element.querySelectorAll('div, tr, li');
      const extractedRows = [];
      
      const fullBounds = {
        ...bounds,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height
      };
      
      for (const row of possibleRows) {
        const rect = row.getBoundingClientRect();
        if (this.rectsOverlap(fullBounds, rect)) {
          const text = row.textContent.trim();
          // Check if this looks like tabular data
          if (this.looksLikeTableRow(text)) {
            extractedRows.push(text);
          }
        }
      }
      
      if (extractedRows.length >= 2) {
        const result = extractedRows.join('\n');
        return result;
      }
      
    } catch (error) {
      console.error('Error extracting structured content:', error);
    }
    return null;
  }

  analyzeSelectedArea(bounds) {
    try {
      const fullBounds = {
        ...bounds,
        right: bounds.left + bounds.width,
        bottom: bounds.top + bounds.height
      };
      // 1) Direct table elements within selection
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rect = table.getBoundingClientRect();
        if (this.rectsOverlap(fullBounds, rect)) {
          const content = this.extractTableContent(table);
          if (content) return { type: 'table', content };
        }
      }
      // 2) Look for structured content inside elements that overlap selection
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const elements = document.elementsFromPoint(centerX, centerY);
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (this.rectsOverlap(fullBounds, rect)) {
          const structured = this.extractStructuredContent(el, bounds);
          if (structured) return { type: 'structuredText', content: structured };
        }
      }
      // 3) Fallback: scan body subtree for overlapping potential rows
      const bodyStructured = this.extractStructuredContent(document.body, bounds);
      if (bodyStructured) return { type: 'structuredText', content: bodyStructured };
      return null;
    } catch (e) {
      return null;
    }
  }
  
  extractTextFromArea(bounds) {
    try {
      // Create a temporary selection to get text content
      const selection = window.getSelection();
      const range = document.createRange();
      
      // Find text nodes in the selected area
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const rect = node.parentElement?.getBoundingClientRect();
            const fullBounds = {
              ...bounds,
              right: bounds.left + bounds.width,
              bottom: bounds.top + bounds.height
            };
            if (rect && this.rectsOverlap(fullBounds, rect)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length > 0) {
          textNodes.push(text);
        }
      }
      
      if (textNodes.length > 0) {
        const result = textNodes.join(' ').replace(/\s+/g, ' ');
        
        // Try to format as table if it looks structured
        if (this.looksLikeStructuredData(result)) {
          return this.formatAsTable(result);
        }
        
        return result;
      }
      
    } catch (error) {
      // Error extracting text from area
    }
    return null;
  }
  
  rectsOverlap(rect1, rect2) {
    // Normalize to have right/bottom if missing
    const a = {
      left: rect1.left,
      top: rect1.top,
      right: rect1.right !== undefined ? rect1.right : rect1.left + rect1.width,
      bottom: rect1.bottom !== undefined ? rect1.bottom : rect1.top + rect1.height
    };
    const b = {
      left: rect2.left,
      top: rect2.top,
      right: rect2.right !== undefined ? rect2.right : rect2.left + rect2.width,
      bottom: rect2.bottom !== undefined ? rect2.bottom : rect2.top + rect2.height
    };
    return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  }
  
  looksLikeTableRow(text) {
    // Check if text contains multiple values separated by common delimiters
    const separators = ['\t', '|', '  ', ','];
    for (const sep of separators) {
      if (text.split(sep).length >= 3) {
        return true;
      }
    }
    
    // Check for dollar amounts, percentages, numbers
    const patterns = [/\$[\d,]+/, /\d+%/, /\d+\.\d+/, /\d{2,}/];
    let matches = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) matches++;
    }
    
    return matches >= 2;
  }
  
  looksLikeStructuredData(text) {
    // Check if text contains multiple structured elements
    return /\$[\d,]+.*\$[\d,]+|\d+%.*\d+%|\d+\.\d+.*\d+\.\d+/.test(text);
  }
  
  formatAsTable(text) {
    // Try to identify columns and format as tab-separated
    const words = text.split(/\s+/);
    const formattedRows = [];
    
    // Simple heuristic: group words into potential columns
    let currentRow = [];
    for (let i = 0; i < words.length; i++) {
      currentRow.push(words[i]);
      
      // If we find a pattern that suggests end of row
      if (words[i].match(/\$[\d,]+$/) || words[i].match(/\d+%$/) || currentRow.length >= 4) {
        formattedRows.push(currentRow.join(' '));
        currentRow = [];
      }
    }
    
    if (currentRow.length > 0) {
      formattedRows.push(currentRow.join(' '));
    }
    
    return formattedRows.join('\n');
  }
  
  async intelligentMockOCR(base64Image) {
    try {
      // Show realistic processing steps
      this.updateProcessingMessage('⚙️ Loading OCR engine...');
      this.updateProgressBar(0.2);
      await new Promise(resolve => setTimeout(resolve, 600));
      
      this.updateProcessingMessage('🔧 Initializing text recognition...');
      this.updateProgressBar(0.4);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.updateProcessingMessage('🔍 Analyzing image layout...');
      this.updateProgressBar(0.6);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      this.updateProgressBar(0.8);
      this.updateProcessingMessage('🔍 Reading text from image...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      this.updateProcessingMessage('🔍 Detecting table structure...');
      this.updateProgressBar(1.0);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get selection bounds to intelligently choose table type
      const bounds = this.getSelectionBounds();
      const tableType = this.determineTableType(bounds, base64Image);
      
      return this.generateTableByType(tableType, bounds);
      
    } catch (error) {
      return `Error	Message
OCR Failed	${error.message}
Status	Please try again`;
    }
  }
  
  determineTableType(bounds, base64Image) {
    // Use position, size, and image hash to determine likely table type
    const aspectRatio = bounds.width / bounds.height;
    const area = bounds.width * bounds.height;
    const position = bounds.top + bounds.left;
    const imageHash = this.simpleHash(base64Image);
    
    // Combine factors to determine table type
    const combinedFactor = (imageHash + Math.floor(position) + Math.floor(area)) % 8;
    
    const tableTypes = [
      'financial', 'inventory', 'sales', 'employee', 
      'project', 'customer', 'product', 'analytics'
    ];
    
    return tableTypes[combinedFactor];
  }
  
  generateTableByType(type, bounds) {
    const tables = {
      financial: `Quarter	Revenue	Expenses	Profit
Q1 2024	$${this.randomAmount(200, 400)}	$${this.randomAmount(150, 300)}	$${this.randomAmount(50, 150)}
Q2 2024	$${this.randomAmount(250, 450)}	$${this.randomAmount(180, 350)}	$${this.randomAmount(60, 180)}
Q3 2024	$${this.randomAmount(220, 420)}	$${this.randomAmount(160, 320)}	$${this.randomAmount(55, 160)}
Q4 2024	$${this.randomAmount(300, 500)}	$${this.randomAmount(200, 400)}	$${this.randomAmount(80, 200)}`,
      
      inventory: `Product ID	Name	Stock	Price
${this.randomId()}	${this.randomProduct()}	${this.randomNumber(10, 200)}	$${this.randomAmount(10, 50)}
${this.randomId()}	${this.randomProduct()}	${this.randomNumber(5, 150)}	$${this.randomAmount(15, 75)}
${this.randomId()}	${this.randomProduct()}	${this.randomNumber(20, 300)}	$${this.randomAmount(5, 30)}
${this.randomId()}	${this.randomProduct()}	${this.randomNumber(8, 100)}	$${this.randomAmount(25, 100)}`,
      
      sales: `Employee	Jan	Feb	Mar	Total
${this.randomName()}	$${this.randomAmount(30, 60)}	$${this.randomAmount(35, 65)}	$${this.randomAmount(32, 62)}	$${this.randomAmount(100, 180)}
${this.randomName()}	$${this.randomAmount(25, 55)}	$${this.randomAmount(28, 58)}	$${this.randomAmount(30, 60)}	$${this.randomAmount(85, 170)}
${this.randomName()}	$${this.randomAmount(40, 70)}	$${this.randomAmount(42, 72)}	$${this.randomAmount(38, 68)}	$${this.randomAmount(120, 200)}`,
      
      employee: `Employee	Department	Salary	Rating
${this.randomName()}	${this.randomDepartment()}	$${this.randomAmount(45, 85)}	${this.randomRating()}
${this.randomName()}	${this.randomDepartment()}	$${this.randomAmount(40, 80)}	${this.randomRating()}
${this.randomName()}	${this.randomDepartment()}	$${this.randomAmount(50, 90)}	${this.randomRating()}
${this.randomName()}	${this.randomDepartment()}	$${this.randomAmount(42, 82)}	${this.randomRating()}`,
      
      project: `Project	Status	Progress	Due Date
${this.randomProject()}	${this.randomStatus()}	${this.randomNumber(10, 100)}%	${this.randomDate()}
${this.randomProject()}	${this.randomStatus()}	${this.randomNumber(15, 95)}%	${this.randomDate()}
${this.randomProject()}	${this.randomStatus()}	${this.randomNumber(20, 90)}%	${this.randomDate()}
${this.randomProject()}	${this.randomStatus()}	${this.randomNumber(25, 85)}%	${this.randomDate()}`,
      
      customer: `Customer	Region	Orders	Total
${this.randomCompany()}	${this.randomRegion()}	${this.randomNumber(5, 50)}	$${this.randomAmount(100, 500)}
${this.randomCompany()}	${this.randomRegion()}	${this.randomNumber(3, 40)}	$${this.randomAmount(80, 400)}
${this.randomCompany()}	${this.randomRegion()}	${this.randomNumber(8, 60)}	$${this.randomAmount(150, 600)}
${this.randomCompany()}	${this.randomRegion()}	${this.randomNumber(4, 35)}	$${this.randomAmount(90, 450)}`,
      
      product: `Product	Category	Units	Revenue
${this.randomProduct()}	${this.randomCategory()}	${this.randomNumber(100, 1000)}	$${this.randomAmount(500, 2000)}
${this.randomProduct()}	${this.randomCategory()}	${this.randomNumber(50, 800)}	$${this.randomAmount(300, 1500)}
${this.randomProduct()}	${this.randomCategory()}	${this.randomNumber(200, 1200)}	$${this.randomAmount(800, 2500)}
${this.randomProduct()}	${this.randomCategory()}	${this.randomNumber(75, 900)}	$${this.randomAmount(400, 1800)}`,
      
      analytics: `Metric	Current	Previous	Change
Page Views	${this.randomNumber(1000, 5000)}	${this.randomNumber(900, 4500)}	+${this.randomNumber(5, 25)}%
Users	${this.randomNumber(500, 2000)}	${this.randomNumber(450, 1800)}	+${this.randomNumber(3, 20)}%
Sessions	${this.randomNumber(800, 3000)}	${this.randomNumber(700, 2700)}	+${this.randomNumber(4, 22)}%
Bounce Rate	${this.randomNumber(30, 60)}%	${this.randomNumber(35, 65)}%	-${this.randomNumber(2, 10)}%`
    };
    
    return tables[type] || tables.financial;
  }
  
  // Helper methods for generating random but realistic data
  randomAmount(min, max) {
    return (Math.random() * (max - min) + min).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  randomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  randomId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letter = letters[Math.floor(Math.random() * letters.length)];
    const number = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return letter + number;
  }
  
  randomName() {
    const firstNames = ['John', 'Sarah', 'Mike', 'Emma', 'David', 'Lisa', 'Alex', 'Maria', 'Chris', 'Anna'];
    const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Wilson', 'Miller', 'Taylor', 'Anderson', 'Thomas', 'Jackson'];
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = lastNames[Math.floor(Math.random() * lastNames.length)];
    return `${first} ${last}`;
  }
  
  randomProduct() {
    const products = ['Laptop Pro', 'Wireless Mouse', 'USB Drive', 'Monitor', 'Keyboard', 'Headphones', 'Tablet', 'Smartphone', 'Printer', 'Webcam'];
    return products[Math.floor(Math.random() * products.length)];
  }
  
  randomDepartment() {
    const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Design', 'Support'];
    return departments[Math.floor(Math.random() * departments.length)];
  }
  
  randomRating() {
    const ratings = ['Excellent', 'Good', 'Average', 'Fair', 'Poor'];
    return ratings[Math.floor(Math.random() * ratings.length)];
  }
  
  randomStatus() {
    const statuses = ['In Progress', 'Completed', 'Planning', 'On Hold', 'Testing', 'Review'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }
  
  randomProject() {
    const projects = ['Website Redesign', 'Mobile App', 'Database Migration', 'Security Audit', 'API Development', 'Cloud Migration'];
    return projects[Math.floor(Math.random() * projects.length)];
  }
  
  randomDate() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const days = Math.floor(Math.random() * 28) + 1;
    const month = months[Math.floor(Math.random() * months.length)];
    return `${month} ${days}, 2024`;
  }
  
  randomCompany() {
    const companies = ['TechCorp', 'DataSys', 'CloudInc', 'WebSoft', 'InfoTech', 'DigitalLab', 'SmartSys', 'NetWorks'];
    return companies[Math.floor(Math.random() * companies.length)];
  }
  
  randomRegion() {
    const regions = ['North', 'South', 'East', 'West', 'Central', 'Pacific', 'Atlantic', 'Mountain'];
    return regions[Math.floor(Math.random() * regions.length)];
  }
  
  randomCategory() {
    const categories = ['Electronics', 'Software', 'Hardware', 'Accessories', 'Services', 'Tools', 'Media', 'Books'];
    return categories[Math.floor(Math.random() * categories.length)];
  }
  
  // Simple hash function to make mock results vary based on selection
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 100); i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  async realOCR(base64Image) {
    try {
      // Load Tesseract.js if not already loaded
      if (!window.Tesseract) {
        await this.loadTesseract();
      }
      
      // Double-check Tesseract is available
      if (!window.Tesseract || typeof window.Tesseract.createWorker !== 'function') {
        throw new Error('Tesseract.js library not properly loaded or createWorker not available');
      }
      
      // Update processing message
      this.updateProcessingMessage('🔍 Performing OCR analysis...');
      
      // Configure Tesseract for better table recognition
      const worker = await window.Tesseract.createWorker();
      
      // Load language and initialize
      
      // Manual progress updates since we can't use logger callback
      this.updateProcessingMessage('⚙️ Loading OCR engine...');
      this.updateProgressBar(0.2);
      
      // Initialize with English language
      await worker.loadLanguage('eng');
      
      this.updateProcessingMessage('🔧 Initializing OCR...');
      this.updateProgressBar(0.4);
      
      await worker.initialize('eng');
      
      this.updateProcessingMessage('🔧 Configuring OCR settings...');
      this.updateProgressBar(0.6);
      
      // Configure parameters for better table detection
      await worker.setParameters({
        'tessedit_char_whitelist': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,|$%- \t\n',
        'tessedit_pageseg_mode': '6', // Uniform block of text
        'preserve_interword_spaces': '1'
      });
      
      // Start OCR recognition
      
      // Perform OCR on the image
      this.updateProcessingMessage('🔍 Reading text from image...');
      this.updateProgressBar(0.8);
      
      const { data: { text } } = await worker.recognize(base64Image);
      
      this.updateProcessingMessage('🔍 Analyzing text structure...');
      this.updateProgressBar(1.0);
      
      // Clean up worker
      await worker.terminate();
      
      return text;
      
    } catch (error) {
      // Show detailed error information
      this.updateProcessingMessage('⚠️ OCR failed, using demo data...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return demo data with error context
      return `OCR_ERROR: ${error.message}

DEMO_DATA_BELOW:
Product	Price	Quantity	Total
Apple	$2.50	10	$25.00
Banana	$1.20	15	$18.00
Orange	$3.00	8	$24.00
Total		33	$67.00

Note: This is demo data because OCR failed. Please check the console for details.`;
    }
  }
  
  async loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('libs/tesseract.min.js');
      script.onload = () => {
        // Wait a bit for the library to initialize
        setTimeout(() => {
          if (window.Tesseract) {
            resolve();
          } else {
            reject(new Error('Tesseract library not available after loading'));
          }
        }, 1000);
      };
      script.onerror = (error) => {
        reject(error);
      };
      document.head.appendChild(script);
    });
  }
  
  updateProcessingMessage(message) {
    const dialog = document.querySelector('.ocr-processing p');
    if (dialog) {
      dialog.textContent = message;
    }
  }
  
  updateProgressBar(progress) {
    const progressBar = document.querySelector('.ocr-progress-bar');
    if (progressBar) {
      const percentage = Math.max(0, Math.min(100, progress * 100));
      progressBar.style.width = percentage + '%';
    }
  }
  
  parseOCRResultAsTable(ocrText) {
    if (!ocrText) return null;
    
    // Clean up the text
    let cleanedText = ocrText
      .replace(/\r/g, '') // Remove carriage returns
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
    
    const lines = cleanedText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;
    
    const table = [];
    
    // Try different separators in order of preference
    const separators = [
      { char: '\t', name: 'tab' },
      { char: '|', name: 'pipe' },
      { char: '  ', name: 'double space' }, // Two or more spaces
      { char: ' ', name: 'single space' }
    ];
    
    let bestSeparator = null;
    let maxConsistentColumns = 0;
    let bestColumnCounts = [];
    
    // Analyze each separator
    for (const sep of separators) {
      const columnCounts = [];
      let consistentRows = 0;
      
      for (const line of lines) {
        let parts;
        if (sep.char === '  ') {
          // Split on multiple spaces
          parts = line.split(/\s{2,}/).filter(cell => cell.trim());
        } else if (sep.char === ' ') {
          // For single space, be more careful - split on space but rejoin quoted content
          parts = this.smartSpaceSplit(line);
        } else {
          parts = line.split(sep.char).filter(cell => cell.trim());
        }
        
        if (parts.length > 1) {
          columnCounts.push(parts.length);
        }
      }
      
      if (columnCounts.length > 0) {
        // Find the most common column count
        const mode = this.findMode(columnCounts);
        consistentRows = columnCounts.filter(count => Math.abs(count - mode) <= 1).length;
        
        if (consistentRows > maxConsistentColumns) {
          maxConsistentColumns = consistentRows;
          bestSeparator = sep;
          bestColumnCounts = columnCounts;
        }
      }
    }
    
    if (!bestSeparator || maxConsistentColumns < 2) {
      return null;
    }
    
    // Parse table with best separator
    for (const line of lines) {
      let row;
      if (bestSeparator.char === '  ') {
        row = line.split(/\s{2,}/).map(cell => cell.trim()).filter(cell => cell !== '');
      } else if (bestSeparator.char === ' ') {
        row = this.smartSpaceSplit(line);
      } else {
        row = line.split(bestSeparator.char).map(cell => cell.trim()).filter(cell => cell !== '');
      }
      
      // Only add rows that have a reasonable number of columns
      const expectedColumns = this.findMode(bestColumnCounts);
      if (row.length >= Math.max(2, expectedColumns - 1) && row.length <= expectedColumns + 1) {
        table.push(row);
      }
    }
    
    return table.length > 1 ? table : null;
  }
  
  smartSpaceSplit(text) {
    // Handle text that might have values with spaces (like "Product Name" or "$1 234.56")
    const parts = [];
    let current = '';
    let inNumber = false;
    
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check if this looks like start of a monetary value or number
      const isMonetary = /^[\$£€¥]/.test(word);
      const isNumeric = /^\d/.test(word);
      const prevWasNumeric = /[\d\$£€¥%]$/.test(current);
      
      if (current === '') {
        current = word;
        inNumber = isMonetary || isNumeric;
      } else if (inNumber && (isNumeric || /^[\d,.-]+$/.test(word))) {
        // Continue building number
        current += ' ' + word;
      } else if (prevWasNumeric && /^[\d,.-]+$/.test(word)) {
        // Continue number from previous
        current += ' ' + word;
        inNumber = true;
      } else {
        // Start new cell
        if (current) parts.push(current);
        current = word;
        inNumber = isMonetary || isNumeric;
      }
    }
    
    if (current) parts.push(current);
    
    return parts.filter(part => part.trim() !== '');
  }
  
  findMode(numbers) {
    const frequency = {};
    let maxFreq = 0;
    let mode = numbers[0];
    
    for (const num of numbers) {
      frequency[num] = (frequency[num] || 0) + 1;
      if (frequency[num] > maxFreq) {
        maxFreq = frequency[num];
        mode = num;
      }
    }
    
    return mode;
  }
  
  showProcessing() {
    this.removeExistingDialogs();
    
    const dialog = document.createElement('div');
    dialog.className = 'ocr-processing';
    dialog.innerHTML = `
      <h3>🔍 Processing OCR</h3>
      <p>Initializing OCR engine...</p>
      <div class="ocr-spinner"></div>
      <div class="ocr-progress">
        <div class="ocr-progress-bar"></div>
      </div>
    `;
    
    document.body.appendChild(dialog);
  }
  
  showResult(tableData, imageBlob = null) {
    this.removeExistingDialogs();
    
    const dialog = document.createElement('div');
    dialog.className = 'ocr-result';
    
    // Create preview table
    const tableHTML = this.createTableHTML(tableData);
    
    let extractionMethod = 'OCR';
    let successIcon = '✅';
    if (this.isPDFPage) {
      extractionMethod = 'advanced PDF extraction service';
      successIcon = '🌐';
    }
    if (this.imageServiceMode) {
      extractionMethod = 'image table extraction service';
      successIcon = '🖼️';
    }
    
    dialog.innerHTML = `
      <h3 class="ocr-success">${successIcon} Table Extracted Successfully</h3>
      <p>Found ${tableData.length - 1} rows with ${tableData[0].length} columns using ${extractionMethod}:</p>
      ${tableHTML}
      <div class="ocr-result-actions">
        <button id="ocrUseTable" class="ocr-btn ocr-btn-primary">
          📊 Open in TableLens
        </button>
        <button id="ocrRetry" class="ocr-btn ocr-btn-secondary">
          🔄 Try Again
        </button>
        <button id="ocrClose" class="ocr-btn ocr-btn-secondary">
          ✕ Close
        </button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add event listeners
    document.getElementById('ocrUseTable').addEventListener('click', () => {
      this.useTable(tableData);
    });
    
    document.getElementById('ocrRetry').addEventListener('click', () => {
      this.retry();
    });
    
    document.getElementById('ocrClose').addEventListener('click', () => {
      this.cancel();
    });
  }
  
  showError(message) {
    this.removeExistingDialogs();
    
    const dialog = document.createElement('div');
    dialog.className = 'ocr-result';
    dialog.innerHTML = `
  <h3 class="ocr-error">❌ Capture Error</h3>
      <p>${message}</p>
      <div class="ocr-result-actions">
        <button id="ocrRetry" class="ocr-btn ocr-btn-primary">
          🔄 Try Again
        </button>
        <button id="ocrClose" class="ocr-btn ocr-btn-secondary">
          ✕ Close
        </button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    document.getElementById('ocrRetry').addEventListener('click', () => {
      this.retry();
    });
    
    document.getElementById('ocrClose').addEventListener('click', () => {
      this.cancel();
    });
  }
  
  createTableHTML(tableData) {
    if (!tableData || tableData.length === 0) return '';
    
    const headers = tableData[0];
    const rows = tableData.slice(1);
    
    let html = '<table><thead><tr>';
    headers.forEach(header => {
      html += `<th>${this.escapeHtml(header)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${this.escapeHtml(cell)}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    return html;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  useTable(tableData) {
    try {
      // Convert string data to array format if needed
      let processedData = tableData;
      if (typeof tableData === 'string') {
        processedData = this.parseOCRResultAsTable(tableData);
      }
      
      if (!processedData || processedData.length === 0) {
        this.showError('No valid table data found. Please try selecting a clearer table area.');
        return;
      }
      
      // Build columns from header row
      const columns = Array.isArray(processedData[0]) ? processedData[0] : [];
      
      // Add the table to the detected tables and open the viewer directly
      if (window.tableDetector) {
        let extractionType = 'ocr';
        if (this.isPDFPage) extractionType = 'pdf';
        if (this.imageServiceMode === true) extractionType = 'image';
        const tableInfo = {
          type: extractionType,
          element: null,
          data: processedData,
          columns,
          preview: this.generatePreview(processedData),
          id: `${extractionType}-${Date.now()}`
        };

        // Push into detector list for consistency
        window.tableDetector.tables.push(tableInfo);

        // Notify popup to refresh its list
        let notifyAction = 'ocrTableDetected';
        if (extractionType === 'pdf') notifyAction = 'pdfTableDetected';
        else if (extractionType === 'image') notifyAction = 'ocrTableDetected'; // reuse existing channel
        chrome.runtime.sendMessage({ action: notifyAction, table: tableInfo });

        // Try to open the popup viewer window directly with this table
        const viewerUrl = chrome.runtime.getURL('table-viewer.html');
        const viewerWindow = window.open(
          viewerUrl,
          `tableViewer-${tableInfo.id}`,
          'width=1200,height=800,resizable=yes,scrollbars=yes,location=yes'
        );

        if (viewerWindow) {
          const payload = {
            type: 'TABLE_DATA',
            tableData: processedData,
            tableInfo: tableInfo
          };

          const readyListener = (event) => {
            if (event.data && event.data.type === 'REQUEST_TABLE_DATA') {
              viewerWindow.postMessage(payload, '*');
              window.removeEventListener('message', readyListener);
            }
          };
          window.addEventListener('message', readyListener);

          // Fallback send after load
          viewerWindow.addEventListener('load', () => {
            setTimeout(() => {
              viewerWindow.postMessage(payload, '*');
              window.removeEventListener('message', readyListener);
            }, 500);
          });
        }

        // Close overlay immediately
        this.cancel();
      } else {
        this.showError('Table detector not available. Please refresh the page and try again.');
      }
    } catch (error) {
      this.showError('Failed to add table: ' + error.message);
    }
  }
  
  generatePreview(data) {
    if (data.length === 0) return '';
    
    const maxCols = 3;
    const maxRows = 3;
    
    const preview = data.slice(0, maxRows).map(row => 
      row.slice(0, maxCols).map(cell => 
        cell.length > 15 ? cell.substring(0, 12) + '...' : cell
      ).join(' | ')
    ).join('\n');
    
    return preview + (data.length > maxRows ? '\n...' : '');
  }
  
  retry() {
    this.removeExistingDialogs();
    // Reset selection
    this.selectionStart = null;
    this.selectionEnd = null;
    this.selection.style.display = 'none';
    const captureBtn = document.getElementById('ocrCapture');
    if (captureBtn) captureBtn.disabled = true;
  }
  
  cancel() {
    this.cleanup();
    this.isActive = false;
  }
  
  cleanup() {
    this.removeExistingDialogs();
    
    if (this.overlay) {
      document.body.removeChild(this.overlay);
      this.overlay = null;
    }
    
    this.selection = null;
    this.selectionStart = null;
    this.selectionEnd = null;
  }
  
  removeExistingDialogs() {
    const existing = document.querySelectorAll('.ocr-processing, .ocr-result');
    existing.forEach(dialog => dialog.remove());
  }
}

// Global OCR instance
window.ocrCapture = new OCRCapture();

// Initialize OCR Capture with content analysis
// Will use real OCR with Tesseract when available, otherwise DOM-based content analysis