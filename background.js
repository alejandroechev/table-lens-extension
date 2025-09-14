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