// Background script for handling OCR screen capture
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
});