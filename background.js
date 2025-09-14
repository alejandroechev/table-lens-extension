// Background script for handling OCR screen capture and PDF extraction
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'requestScreenCapture') {
    // Request desktop capture using Chrome's desktopCapture API
    chrome.desktopCapture.chooseDesktopMedia(
      ['screen', 'window'], 
      sender.tab,
      (streamId) => {
        if (streamId) {
          sendResponse({ success: true, streamId: streamId });
        } else {
          sendResponse({ 
            success: false, 
            error: 'Screen capture permission denied' 
          });
        }
      }
    );
    
    // Keep the message channel open for async response
    return true;
  }
  
  if (request.action === 'extractTableFromPDF') {
    // Handle PDF extraction request to bypass CORS
    handlePDFExtraction(request.requestData)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('PDF extraction error in background:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  }

  if (request.action === 'extractTableFromImage') {
    handleImageExtraction(request.imageDataUrl)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Image extraction error in background:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'extractAllTablesFromPDF') {
    // Allow optional pages array (fallback if service still requires pages)
    handleAllTablesExtraction(request.pdfUrl, request.pages)
      .then(result => {
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('All-tables extraction error in background:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function handlePDFExtraction(requestData) {
  try {
    console.log('Background: Making extraction request:', requestData);
    console.log('Background: Full JSON payload being sent to service:');
    console.log(JSON.stringify(requestData, null, 2));
    
    const response = await fetch('https://table-extract-service-production.up.railway.app/extract-table-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Background: Extraction service response:', result);
    
    return result;
  } catch (error) {
    console.error('Background: Error calling extraction service:', error);
    throw error;
  }
}

async function handleImageExtraction(dataUrl) {
  try {
    if (!dataUrl) throw new Error('No image data provided');
    // Convert data URL to blob
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('file', blob, 'capture.png');
    console.log('Background: Sending image to extraction service (size bytes):', blob.size);
    const response = await fetch('https://table-extract-service-production.up.railway.app/extract-table-from-image', {
      method: 'POST',
      body: form
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service error (${response.status}): ${errorText}`);
    }
    const result = await response.json();
    console.log('Background: Image extraction service response:', result);
    return result;
  } catch (e) {
    console.error('Background: Error calling image extraction service:', e);
    throw e;
  }
}

async function handleAllTablesExtraction(pdfUrl, pages) {
  try {
    if (!pdfUrl) throw new Error('Missing PDF URL');
    // If pages provided (fallback scenario) include them; otherwise rely on service auto-detection
    const payload = pages && Array.isArray(pages) && pages.length > 0
      ? { pdf_url: pdfUrl, pages }
      : { pdf_url: pdfUrl };
    console.log('[BatchExtract] Request payload (JSON):');
    console.log(JSON.stringify(payload, null, 2));
    const response = await fetch('https://table-extract-service-production.up.railway.app/extract-all-tables-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`Service error (${response.status}): ${txt}`);
    }
    const result = await response.json();
    console.log('[BatchExtract] Full response JSON:');
    try { console.log(JSON.stringify(result, null, 2)); } catch(e) { console.log(result); }
    console.log('[BatchExtract] Response summary:', { tableCount: result?.tables?.length || 0 });
    return result;
  } catch (e) {
    console.error('Background: Error calling /extract-all-tables-from-url service:', e);
    throw e;
  }
}