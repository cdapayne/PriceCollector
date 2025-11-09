// Content script that runs on e-commerce pages to extract product information

// Detect which site we're on
function detectSite() {
  const hostname = window.location.hostname;
  if (hostname.includes('amazon.')) return 'amazon';
  if (hostname.includes('etsy.')) return 'etsy';
  if (hostname.includes('macys.')) return 'macys';
  if (hostname.includes('walmart.')) return 'walmart';
  if (hostname.includes('target.')) return 'target';
  if (hostname.includes('shopify.') || hostname.includes('myshopify.')) return 'shopify';
  if (hostname.includes('printify.')) return 'printify';
  return 'unknown';
}

// Amazon-specific extraction
function extractAmazonProduct() {
  const productData = {
    title: null,
    price: null,
    currency: null,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    asin: null,
    site: 'Amazon'
  };

  // Extract ASIN from URL
  const asinMatch = window.location.href.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})/);
  if (asinMatch) {
    productData.asin = asinMatch[1] || asinMatch[2];
  }

  // Extract product title - try multiple selectors
  const titleSelectors = [
    '#productTitle',
    '#title',
    'h1.product-title',
    'span#productTitle',
    '[data-feature-name="title"] h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price - try multiple selectors for different Amazon page layouts
  const priceSelectors = [
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#price_inside_buybox',
    '.a-price-whole',
    'span.a-price[data-a-size="xl"] .a-offscreen',
    'span.a-price[data-a-size="l"] .a-offscreen',
    '#corePrice_feature_div .a-offscreen',
    '.priceToPay .a-offscreen'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      
      // Extract currency symbol
      const currencyMatch = priceText.match(/^([£$€¥₹])/);
      if (currencyMatch) {
        productData.currency = currencyMatch[1];
      }
      
      // Clean up price (remove currency symbols and extract numeric value)
      priceText = priceText.replace(/[£$€¥₹,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  // If price still not found, try getting the whole price element
  if (!productData.price) {
    const wholePriceElement = document.querySelector('.a-price-whole');
    const fractionPriceElement = document.querySelector('.a-price-fraction');
    
    if (wholePriceElement) {
      const whole = wholePriceElement.textContent.replace(/[,.\s]/g, '');
      const fraction = fractionPriceElement ? fractionPriceElement.textContent.trim() : '00';
      productData.price = `${whole}.${fraction}`;
      
      // Try to get currency from parent
      const priceSymbol = document.querySelector('.a-price-symbol');
      if (priceSymbol) {
        productData.currency = priceSymbol.textContent.trim();
      }
    }
  }

  return productData;
}

// Etsy-specific extraction
function extractEtsyProduct() {
  const productData = {
    title: null,
    price: null,
    currency: null,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Etsy'
  };

  // Extract title
  const titleSelectors = [
    'h1[data-buy-box-listing-title]',
    'h1.wt-text-body-01',
    'h1[data-product-title]',
    '.listing-page-title-component h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    'p[data-buy-box-region="price"] .wt-text-title-03',
    '.wt-text-title-03',
    'p.wt-text-title-03',
    '[data-buy-box-region="price"]'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      const currencyMatch = priceText.match(/^([£$€¥₹]+)/);
      if (currencyMatch) {
        productData.currency = currencyMatch[1];
      }
      priceText = priceText.replace(/[£$€¥₹,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Macy's-specific extraction
function extractMacysProduct() {
  const productData = {
    title: null,
    price: null,
    currency: '$',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: "Macy's"
  };

  // Extract title
  const titleSelectors = [
    'h1.product-name',
    'h1[data-auto="product-name"]',
    '.product-title h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    '.price .price-value',
    'span[data-auto="product-price"]',
    '.sale-price',
    '.regular-price'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      priceText = priceText.replace(/[$,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Walmart-specific extraction
function extractWalmartProduct() {
  const productData = {
    title: null,
    price: null,
    currency: '$',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Walmart'
  };

  // Extract title
  const titleSelectors = [
    'h1[itemprop="name"]',
    'h1.prod-ProductTitle',
    'h1[data-automation="product-title"]'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    'span[itemprop="price"]',
    '[data-automation="product-price"] span',
    '.price-characteristic[itemprop="price"]',
    'span.price-group span:not(.ml2)'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      priceText = priceText.replace(/[$,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Target-specific extraction
function extractTargetProduct() {
  const productData = {
    title: null,
    price: null,
    currency: '$',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Target'
  };

  // Extract title
  const titleSelectors = [
    'h1[data-test="product-title"]',
    'h1.Heading__StyledHeading',
    '.ProductTitle h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    '[data-test="product-price"]',
    'span[data-test="product-price"] span',
    '.ProductPrice span'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      priceText = priceText.replace(/[$,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Shopify-specific extraction (works for any Shopify store)
function extractShopifyProduct() {
  const productData = {
    title: null,
    price: null,
    currency: null,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Shopify Store'
  };

  // Extract title
  const titleSelectors = [
    'h1.product-title',
    'h1.product__title',
    'h1[itemprop="name"]',
    '.product-single__title',
    'h1.product_name'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    '.product-price',
    '.price',
    'span.money',
    '[data-product-price]',
    'span[itemprop="price"]',
    '.product__price'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      const currencyMatch = priceText.match(/^([£$€¥₹]+)/);
      if (currencyMatch) {
        productData.currency = currencyMatch[1];
      }
      priceText = priceText.replace(/[£$€¥₹,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Printify-specific extraction
function extractPrintifyProduct() {
  const productData = {
    title: null,
    price: null,
    currency: '$',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Printify'
  };

  // Extract title
  const titleSelectors = [
    'h1.product-title',
    'h1[data-testid="product-title"]',
    '.product-name h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement && titleElement.textContent.trim()) {
      productData.title = titleElement.textContent.trim();
      break;
    }
  }

  // Extract price
  const priceSelectors = [
    '.product-price',
    '[data-testid="product-price"]',
    '.price-display'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      let priceText = priceElement.textContent.trim();
      priceText = priceText.replace(/[$,\s]/g, '');
      productData.price = priceText;
      break;
    }
  }

  return productData;
}

// Main extraction function that routes to the appropriate site extractor
function extractProductInfo() {
  const site = detectSite();
  
  switch (site) {
    case 'amazon':
      return extractAmazonProduct();
    case 'etsy':
      return extractEtsyProduct();
    case 'macys':
      return extractMacysProduct();
    case 'walmart':
      return extractWalmartProduct();
    case 'target':
      return extractTargetProduct();
    case 'shopify':
      return extractShopifyProduct();
    case 'printify':
      return extractPrintifyProduct();
    default:
      return {
        title: null,
        price: null,
        currency: null,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        site: 'Unknown'
      };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractPrice') {
    const productData = extractProductInfo();
    sendResponse(productData);
  }
  return true; // Keep channel open for async response
});

// Check if we're on a product page
function isProductPage() {
  const url = window.location.href;
  const site = detectSite();
  
  switch (site) {
    case 'amazon':
      return url.match(/\/dp\/|\/gp\/product\//) !== null;
    case 'etsy':
      return url.match(/\/listing\//) !== null;
    case 'macys':
      return url.match(/\/shop\/product\//) !== null;
    case 'walmart':
      return url.match(/\/ip\//) !== null;
    case 'target':
      return url.match(/\/p\//) !== null;
    case 'shopify':
      return url.match(/\/products\//) !== null;
    case 'printify':
      return url.match(/\/product\//) !== null;
    default:
      return false;
  }
}

// Send a message to background script when on a product page
if (isProductPage()) {
  chrome.runtime.sendMessage({
    action: 'productPageDetected',
    url: window.location.href
  });
}
