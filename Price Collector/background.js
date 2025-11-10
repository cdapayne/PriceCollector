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

// Add context menu for creating item from selection
chrome.contextMenus.create({
  id: 'createFromSelection',
  title: 'Create new item from selection',
  contexts: ['selection'],
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

// Utility: try to parse a user selection into title and price
function parseSelectionText(selection) {
  if (!selection) return { raw: '', title: '', price: '' };
  const raw = selection.trim();

  // Try splitting by newline or ' - ' or ' — '
  const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  let title = '';
  let price = '';

  // If multiple lines, look for a line containing currency
  if (lines.length > 1) {
    for (const line of lines) {
      const priceMatch = line.match(/([£$€¥₹])\s?\d[\d,\.\s]*/);
      if (priceMatch) {
        price = priceMatch[0].replace(/\s+/g, '');
      } else if (!title) {
        title = line;
      }
    }
  } else {
    // Single line - try to separate by common separators
    const parts = raw.split(/\s[-–—|]\s|\s–\s|\s\|\s/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      // find price-like part
      for (const p of parts) {
        const pm = p.match(/([£$€¥₹])\s?\d[\d,\.\s]*/);
        if (pm) {
          price = pm[0].replace(/\s+/g, '');
        } else if (!title) {
          title = p;
        }
      }
      if (!title) title = parts[0];
    } else {
      // no separators; try to extract price substring
      const pm = raw.match(/([£$€¥₹])\s?\d[\d,\.\s]*/);
      if (pm) {
        price = pm[0].replace(/\s+/g, '');
        title = raw.replace(pm[0], '').trim().replace(/^[-:\s]+|[-:\s]+$/g, '');
      } else {
        // fallback: first 120 characters as title
        title = raw.length > 120 ? raw.slice(0, 120) : raw;
      }
    }
  }

  // Normalize price numeric
  const priceNumeric = price ? price.replace(/[^0-9\.]/g, '') : '';
  return { raw, title: title || '', price: priceNumeric ? priceNumeric : '' };
}

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

  if (info.menuItemId === 'createFromSelection') {
    // Parse the selected text and store it for the popup to prefill the manual form
    const parsed = parseSelectionText(info.selectionText || '');
    const payload = {
      raw: parsed.raw,
      title: parsed.title,
      price: parsed.price,
      url: tab && tab.url ? tab.url : undefined,
      timestamp: new Date().toISOString()
    };

    chrome.storage.local.set({ lastSelection: payload }, () => {
      // Open the extension popup so user can confirm and save the new item
      try {
        if (chrome.action && chrome.action.openPopup) {
          chrome.action.openPopup(() => {
            // popup opened
          });
        } else if (chrome.browserAction && chrome.browserAction.openPopup) {
          chrome.browserAction.openPopup();
        }
      } catch (e) {
        // If opening popup fails, at least notify the user
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.svg',
          title: 'Selection Saved',
          message: 'Selection saved. Open the Price Collector popup and choose Manual Entry to finish.'
        });
      }
    });
  }
});
