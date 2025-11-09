// Background service worker for the extension

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Price Collector installed');
  
  // Initialize storage with empty products array if not exists
  chrome.storage.local.get(['products'], (result) => {
    if (!result.products) {
      chrome.storage.local.set({ products: [] });
    }
  });
  
  // Set default export format
  chrome.storage.sync.get(['exportFormat'], (result) => {
    if (!result.exportFormat) {
      chrome.storage.sync.set({ exportFormat: 'csv' });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'productPageDetected') {
    // Could be used to show badge or notification
    console.log('Product page detected:', request.url);
    
    // Update badge to indicate product page is detected
    chrome.action.setBadgeText({ 
      text: '●',
      tabId: sender.tab.id 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#28a745',
      tabId: sender.tab.id 
    });
  }
  
  return true;
});

// Clear badge when tab is updated (navigating away from product page)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Check if still on a supported e-commerce site
    const supportedSites = ['amazon.', 'etsy.', 'macys.', 'walmart.', 'target.', 'shopify.', 'myshopify.', 'printify.'];
    const isSupportedSite = tab.url && supportedSites.some(site => tab.url.includes(site));
    
    if (isSupportedSite) {
      // Badge will be set by content script if it's a product page
    } else {
      // Clear badge if not on a supported site
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
  }
});

// Add context menu for quick collection on all supported sites
chrome.contextMenus.create({
  id: 'collectProduct',
  title: 'Collect This Product',
  contexts: ['page'],
  documentUrlPatterns: [
    '*://*.amazon.com/*',
    '*://*.amazon.ca/*',
    '*://*.amazon.co.uk/*',
    '*://*.amazon.de/*',
    '*://*.amazon.fr/*',
    '*://*.amazon.it/*',
    '*://*.amazon.es/*',
    '*://*.amazon.co.jp/*',
    '*://*.amazon.in/*',
    '*://*.amazon.com.au/*',
    '*://*.etsy.com/*',
    '*://*.macys.com/*',
    '*://*.walmart.com/*',
    '*://*.target.com/*',
    '*://*.myshopify.com/*',
    '*://*.shopify.com/*',
    '*://*.printify.com/*'
  ]
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'collectProduct') {
    // Send message to content script to extract and save product
    chrome.tabs.sendMessage(tab.id, { action: 'extractPrice' }, async (response) => {
      if (response && response.title && response.price) {
        // Save to storage
        const result = await chrome.storage.local.get(['products']);
        const products = result.products || [];
        products.push(response);
        await chrome.storage.local.set({ products });
        
        // Show notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.svg',
          title: 'Product Collected',
          message: `${response.title.substring(0, 50)}...`
        });
      }
    });
  }
});
