// Popup script - handles UI interactions and communication with content script

let currentProductData = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const settings = await loadSettings();
  document.getElementById('exportFormat').value = settings.exportFormat || 'csv';
  
  // Load database settings
  if (settings.enableDatabase) {
    document.getElementById('enableDatabase').checked = true;
    document.getElementById('databaseSettings').style.display = 'block';
    document.getElementById('exportToDbBtn').style.display = 'block';
  }
  if (settings.apiEndpoint) {
    document.getElementById('apiEndpoint').value = settings.apiEndpoint;
  }
  if (settings.apiKey) {
    document.getElementById('apiKey').value = settings.apiKey;
  }
  
  // Update product count
  updateProductCount();
  
  // Try to extract product data from current page
  refreshProductData();
  
  // Event listeners
  document.getElementById('collectBtn').addEventListener('click', collectProduct);
  document.getElementById('refreshBtn').addEventListener('click', refreshProductData);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('exportToDbBtn').addEventListener('click', exportToDatabase);
  document.getElementById('clearBtn').addEventListener('click', clearAllData);
  document.getElementById('viewDataBtn').addEventListener('click', viewData);
  document.getElementById('exportFormat').addEventListener('change', saveSettings);
  document.getElementById('enableDatabase').addEventListener('change', toggleDatabaseSettings);
  document.getElementById('testConnection').addEventListener('click', testDatabaseConnection);
  
  // Manual entry listeners
  document.getElementById('manualEntryBtn').addEventListener('click', showManualEntryForm);
  document.getElementById('cancelManualEntry').addEventListener('click', hideManualEntryForm);
  document.getElementById('productForm').addEventListener('submit', saveManualEntry);
  
  // Auto-fill URL from current tab
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.url) {
      document.getElementById('manualUrl').value = tab.url;
    }
  });
});

// Load settings from storage
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['exportFormat', 'enableDatabase', 'apiEndpoint', 'apiKey'], (result) => {
      resolve(result);
    });
  });
}

// Save settings to storage
async function saveSettings() {
  const exportFormat = document.getElementById('exportFormat').value;
  const enableDatabase = document.getElementById('enableDatabase').checked;
  const apiEndpoint = document.getElementById('apiEndpoint').value;
  const apiKey = document.getElementById('apiKey').value;
  
  chrome.storage.sync.set({ 
    exportFormat, 
    enableDatabase,
    apiEndpoint,
    apiKey
  });
}

// Toggle database settings visibility
function toggleDatabaseSettings() {
  const enabled = document.getElementById('enableDatabase').checked;
  document.getElementById('databaseSettings').style.display = enabled ? 'block' : 'none';
  document.getElementById('exportToDbBtn').style.display = enabled ? 'block' : 'none';
  saveSettings();
}

// Test database connection
async function testDatabaseConnection() {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiEndpoint || !apiKey) {
    showMessage('Please enter API endpoint and key', 'error');
    return;
  }
  
  try {
    const healthUrl = apiEndpoint.replace(/\/api\/?$/, '') + '/api/health';
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage('✅ Connection successful!', 'success');
      saveSettings();
    } else {
      showMessage('❌ Connection failed: ' + data.error, 'error');
    }
  } catch (error) {
    showMessage('❌ Cannot reach server: ' + error.message, 'error');
  }
}

// Export to database
async function exportToDatabase() {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  const apiKey = document.getElementById('apiKey').value.trim();
  
  if (!apiEndpoint || !apiKey) {
    showMessage('Please configure database settings first', 'error');
    return;
  }
  
  const result = await chrome.storage.local.get(['products']);
  const products = result.products || [];
  
  if (products.length === 0) {
    showMessage('No products to export', 'error');
    return;
  }
  
  try {
    showMessage(`Exporting ${products.length} products...`, 'success');
    
    const bulkUrl = apiEndpoint.replace(/\/$/, '') + '/products/bulk';
    
    const response = await fetch(bulkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({ products })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showMessage(`✅ Successfully exported ${data.insertedCount} products to database!`, 'success');
    } else {
      showMessage('❌ Export failed: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Database export error:', error);
    showMessage('❌ Export failed: ' + error.message, 'error');
  }
}

// Show manual entry form
function showManualEntryForm() {
  document.getElementById('manualEntryForm').style.display = 'block';
  document.getElementById('manualTitle').focus();
  
  // Scroll to form
  document.getElementById('manualEntryForm').scrollIntoView({ behavior: 'smooth' });
}

// Hide manual entry form
function hideManualEntryForm() {
  document.getElementById('manualEntryForm').style.display = 'none';
  document.getElementById('productForm').reset();
  
  // Re-populate URL field
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab && tab.url) {
      document.getElementById('manualUrl').value = tab.url;
    }
  });
}

// Save manual entry
async function saveManualEntry(e) {
  e.preventDefault();
  
  const title = document.getElementById('manualTitle').value.trim();
  const price = document.getElementById('manualPrice').value.trim();
  const currency = document.getElementById('manualCurrency').value;
  const site = document.getElementById('manualSite').value.trim() || 'Manual Entry';
  const url = document.getElementById('manualUrl').value.trim();
  const notes = document.getElementById('manualNotes').value.trim();
  
  if (!title || !price) {
    showMessage('Title and price are required', 'error');
    return;
  }
  
  // Validate price is numeric
  const priceNumeric = price.replace(/[,\s]/g, '');
  if (isNaN(priceNumeric) || priceNumeric === '') {
    showMessage('Please enter a valid price (numbers only)', 'error');
    return;
  }
  
  const productData = {
    title: title,
    price: priceNumeric,
    currency: currency,
    site: site,
    url: url || window.location.href,
    timestamp: new Date().toISOString(),
    notes: notes || undefined
  };
  
  try {
    // Get existing products
    const result = await chrome.storage.local.get(['products']);
    const products = result.products || [];
    
    // Add new product
    products.push(productData);
    
    // Save back to storage
    await chrome.storage.local.set({ products });
    
    showMessage('Product saved successfully!', 'success');
    hideManualEntryForm();
    updateProductCount();
    
  } catch (error) {
    console.error('Error saving manual entry:', error);
    showMessage('Failed to save product', 'error');
  }
}

// Refresh product data from current tab
async function refreshProductData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Check if it's a supported e-commerce site
    const supportedSites = ['amazon.', 'etsy.', 'macys.', 'walmart.', 'target.', 'shopify.', 'myshopify.', 'printify.'];
    const isSupportedSite = supportedSites.some(site => tab.url.includes(site));
    
    if (!isSupportedSite) {
      displayNoProductMessage();
      return;
    }
    
    // Send message to content script
    chrome.tabs.sendMessage(tab.id, { action: 'extractPrice' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        displayNoProductMessage();
        return;
      }
      
      if (response && response.title && response.price) {
        currentProductData = response;
        displayProductData(response);
        document.getElementById('collectBtn').disabled = false;
      } else {
        displayNoProductMessage();
      }
    });
  } catch (error) {
    console.error('Error refreshing product data:', error);
    displayNoProductMessage();
  }
}

// Display product data in the popup
function displayProductData(data) {
  const productInfo = document.getElementById('productInfo');
  productInfo.innerHTML = `
    <div class="product-title">${data.title}</div>
    <div class="product-price">${data.currency || ''}${data.price}</div>
    ${data.asin ? `<div class="product-asin">ASIN: ${data.asin}</div>` : ''}
    ${data.site ? `<div class="product-asin">Site: ${data.site}</div>` : ''}
  `;
}

// Display message when no product is detected
function displayNoProductMessage() {
  const productInfo = document.getElementById('productInfo');
  productInfo.innerHTML = '<p class="no-data">Navigate to a product page</p>';
  document.getElementById('collectBtn').disabled = true;
  currentProductData = null;
}

// Collect current product and save to storage
async function collectProduct() {
  if (!currentProductData) {
    showMessage('No product data to collect', 'error');
    return;
  }
  
  try {
    // Get existing products
    const result = await chrome.storage.local.get(['products']);
    const products = result.products || [];
    
    // Add new product
    products.push(currentProductData);
    
    // Save back to storage
    await chrome.storage.local.set({ products });
    
    showMessage('Product collected successfully!', 'success');
    updateProductCount();
    
  } catch (error) {
    console.error('Error collecting product:', error);
    showMessage('Failed to collect product', 'error');
  }
}

// Update product count display
async function updateProductCount() {
  const result = await chrome.storage.local.get(['products']);
  const products = result.products || [];
  document.getElementById('productCount').textContent = products.length;
}

// Export data as CSV or JSON
async function exportData() {
  const result = await chrome.storage.local.get(['products']);
  const products = result.products || [];
  
  if (products.length === 0) {
    showMessage('No products to export', 'error');
    return;
  }
  
  const settings = await loadSettings();
  const format = settings.exportFormat || 'csv';
  
  let dataStr, filename, type;
  
  if (format === 'csv') {
    dataStr = convertToCSV(products);
    filename = `amazon_products_${new Date().toISOString().split('T')[0]}.csv`;
    type = 'text/csv';
  } else {
    dataStr = JSON.stringify(products, null, 2);
    filename = `amazon_products_${new Date().toISOString().split('T')[0]}.json`;
    type = 'application/json';
  }
  
  // Create download
  const blob = new Blob([dataStr], { type });
  const url = URL.createObjectURL(blob);
  
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
  
  showMessage(`Exported ${products.length} products as ${format.toUpperCase()}`, 'success');
}

// Convert products array to CSV format
function convertToCSV(products) {
  const headers = ['Title', 'Price', 'Currency', 'Site', 'ASIN', 'URL', 'Notes', 'Timestamp'];
  const csvRows = [headers.join(',')];
  
  for (const product of products) {
    const row = [
      escapeCsvField(product.title || ''),
      product.price || '',
      product.currency || '',
      product.site || '',
      product.asin || '',
      product.url || '',
      escapeCsvField(product.notes || ''),
      product.timestamp || ''
    ];
    csvRows.push(row.join(','));
  }
  
  return csvRows.join('\n');
}

// Escape CSV field (handle commas and quotes)
function escapeCsvField(field) {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

// Clear all collected data
async function clearAllData() {
  if (confirm('Are you sure you want to clear all collected products? This cannot be undone.')) {
    await chrome.storage.local.set({ products: [] });
    updateProductCount();
    showMessage('All data cleared', 'success');
  }
}

// View collected data (opens in new tab with formatted display)
async function viewData() {
  const result = await chrome.storage.local.get(['products']);
  const products = result.products || [];
  
  if (products.length === 0) {
    showMessage('No products to view', 'error');
    return;
  }
  
  // Create a new window with the data
  const dataWindow = window.open('', '_blank', 'width=800,height=600');
  dataWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Collected Products</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        h1 { color: #333; }
        .product { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .product-title { font-weight: bold; font-size: 16px; margin-bottom: 8px; }
        .product-price { color: #b12704; font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .product-meta { font-size: 12px; color: #666; margin-top: 8px; }
        .product-url { font-size: 12px; color: #007bff; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>Collected Products (${products.length})</h1>
      ${products.map((p, i) => `
        <div class="product">
          <div class="product-title">${i + 1}. ${p.title}</div>
          <div class="product-price">${p.currency || ''}${p.price}</div>
          ${p.site ? `<div class="product-meta">Site: ${p.site}</div>` : ''}
          ${p.asin ? `<div class="product-meta">ASIN: ${p.asin}</div>` : ''}
          ${p.notes ? `<div class="product-meta">Notes: ${p.notes}</div>` : ''}
          <div class="product-meta">Collected: ${new Date(p.timestamp).toLocaleString()}</div>
          <a href="${p.url}" target="_blank" class="product-url">View Product</a>
        </div>
      `).join('')}
    </body>
    </html>
  `);
}

// Show temporary message
function showMessage(text, type) {
  const existingMsg = document.querySelector('.success-message, .error-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  const message = document.createElement('div');
  message.className = type === 'success' ? 'success-message' : 'error-message';
  message.textContent = text;
  
  const container = document.querySelector('.current-product');
  container.insertAdjacentElement('afterend', message);
  
  setTimeout(() => {
    message.remove();
  }, 3000);
}
