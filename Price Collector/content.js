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

// Helper: try to parse JSON-LD script tags for image
function extractImageFromJSONLD() {
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      let json = null;
      try {
        json = JSON.parse(script.textContent);
      } catch (e) {
        // Try to sanitize common issues: multiple JSON objects concatenated
        const text = script.textContent.trim();
        try {
          json = JSON.parse(text);
        } catch (e2) {
          try {
            json = JSON.parse('[' + text.split('\n').join('') + ']');
          } catch (ee) {
            continue;
          }
        }
      }

      const items = [];
      if (Array.isArray(json)) items.push(...json);
      else items.push(json);

      // Expand @graph entries
      const expanded = [];
      for (const item of items) {
        if (!item) continue;
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          expanded.push(...item['@graph']);
        } else if (item['graph'] && Array.isArray(item['graph'])) {
          expanded.push(...item['graph']);
        } else {
          expanded.push(item);
        }
      }

      for (const obj of expanded) {
        if (!obj) continue;

        // If object describes a Product or contains image field
        const candidates = [];
        if (obj.image) candidates.push(obj.image);
        if (obj.mainEntity && obj.mainEntity.image) candidates.push(obj.mainEntity.image);
        if (obj.image && obj['@id']) candidates.push(obj['@id']);

        for (const cand of candidates) {
          if (!cand) continue;
          // string URL
          if (typeof cand === 'string') return normalizeImageUrl(cand);
          // array of strings
          if (Array.isArray(cand)) {
            for (const v of cand) if (typeof v === 'string') return normalizeImageUrl(v);
            for (const v of cand) if (v && v.url) return normalizeImageUrl(v.url);
          }
          // object ImageObject
          if (typeof cand === 'object') {
            if (cand.url) return normalizeImageUrl(cand.url);
            if (cand.contentUrl) return normalizeImageUrl(cand.contentUrl);
            if (cand['@id']) return normalizeImageUrl(cand['@id']);
          }
        }

        // Also check common fields on product object
        if (obj['@type'] && String(obj['@type']).toLowerCase().includes('product')) {
          if (obj.image) {
            if (typeof obj.image === 'string') return normalizeImageUrl(obj.image);
            if (Array.isArray(obj.image) && obj.image.length) {
              const first = obj.image[0];
              if (typeof first === 'string') return normalizeImageUrl(first);
              if (first && first.url) return normalizeImageUrl(first.url);
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper: try to parse JSON-LD for price/currency
function extractPriceFromJSONLD() {
  try {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const script of scripts) {
      let json = null;
      try {
        json = JSON.parse(script.textContent);
      } catch (e) {
        try {
          json = JSON.parse('[' + script.textContent.split('\n').join('') + ']');
        } catch (ee) {
          continue;
        }
      }

      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (!item) continue;
        const expanded = item['@graph'] && Array.isArray(item['@graph']) ? item['@graph'] : [item];
        for (const obj of expanded) {
          if (!obj) continue;
          // Look for offers.price or offers.priceSpecification
          const offers = obj.offers || (obj.mainEntity && obj.mainEntity.offers) || null;
          if (offers) {
            const off = Array.isArray(offers) ? offers[0] : offers;
            if (off.price) {
              return { price: String(off.price), currency: off.priceCurrency || off.currency || off.priceCurrency || null };
            }
            if (off.priceSpecification) {
              const ps = Array.isArray(off.priceSpecification) ? off.priceSpecification[0] : off.priceSpecification;
              if (ps && ps.price) return { price: String(ps.price), currency: ps.priceCurrency || null };
            }
          }

          // Some JSON-LD puts offers under graph items
          if (obj['@type'] && String(obj['@type']).toLowerCase().includes('offer')) {
            if (obj.price) return { price: String(obj.price), currency: obj.priceCurrency || null };
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper: select the best URL from src/srcset attributes
function normalizeImageUrl(urlCandidate) {
  if (!urlCandidate) return null;

  // If srcset, pick first URL
  if (urlCandidate.includes(',')) {
    const parts = urlCandidate.split(',').map(s => s.trim());
    if (parts.length) {
      const first = parts[0].split(' ')[0];
      urlCandidate = first;
    }
  }

  // Replace common Shopify template placeholders like {width} or {w}
  try {
    urlCandidate = urlCandidate.replace(/\{width\}|\{w\}|\{height\}|\{h\}/gi, '1024');
  } catch (e) {}

  // Trim and ensure it's a string
  urlCandidate = String(urlCandidate).trim();

  // If it's protocol-relative, add https:
  if (urlCandidate.startsWith('//')) {
    urlCandidate = 'https:' + urlCandidate;
  }

  // If it's an HTTP URL on an HTTPS page, prefer HTTPS when possible
  if (urlCandidate.startsWith('http://') && location.protocol === 'https:') {
    urlCandidate = urlCandidate.replace(/^http:\/\//i, 'https://');
  }

  return urlCandidate;
}

// Amazon-specific image extractor (parses data-a-dynamic-image, data-old-hires, etc.)
function extractAmazonImage() {
  try {
    // Common Amazon image selectors
    const selectors = [
      '#imgTagWrapperId img',
      '#landingImage',
      '#imgBlkFront',
      '#main-image img',
      '#main-image-container img',
      'div#mainImageContainer img',
      'div#mainImages img',
      '.imgTagWrapper img',
      'img[data-old-hires]',
      'img[data-a-dynamic-image]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;

      // 1) data-a-dynamic-image contains JSON mapping urls to [w,h]
      const dyn = el.getAttribute && el.getAttribute('data-a-dynamic-image');
      if (dyn) {
        try {
          const parsed = JSON.parse(dyn);
          const urls = Object.keys(parsed || {});
          if (urls.length) {
            // prefer the largest width available
            let best = urls[0];
            let bestW = 0;
            for (const u of urls) {
              const dims = parsed[u];
              if (Array.isArray(dims) && dims.length) {
                const w = parseInt(dims[0], 10) || 0;
                if (w > bestW) { bestW = w; best = u; }
              }
            }
            return normalizeImageUrl(best);
          }
        } catch (e) { /* ignore parse errors */ }
      }

      // 2) data-old-hires (high-res url)
      const oldHires = el.getAttribute && (el.getAttribute('data-old-hires') || el.getAttribute('data-old-hires-url') || el.getAttribute('data-old-hires-src'));
      if (oldHires) return normalizeImageUrl(oldHires.trim());

      // 3) data-src / data-lazy / data-a-lazy-image
      const dataSrc = el.getAttribute && (el.getAttribute('data-src') || el.getAttribute('data-lazy') || el.getAttribute('data-a-lazy-load') || el.getAttribute('data-a-lazy-image'));
      if (dataSrc) return normalizeImageUrl(dataSrc.trim());

      // 4) src attribute
      if (el.src) return normalizeImageUrl(el.src.trim());

      // 5) srcset - pick the largest entry if possible
      const srcset = el.getAttribute && el.getAttribute('srcset');
      if (srcset) {
        // choose the last (largest) URL in srcset
        const parts = srcset.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length) {
          const last = parts[parts.length - 1].split(' ')[0];
          if (last) return normalizeImageUrl(last);
        }
      }

      // 6) background-image style
      try {
        const styleBg = el.style && el.style.backgroundImage;
        if (styleBg && styleBg !== 'none') {
          const m = styleBg.match(/url\(["']?(.*?)["']?\)/);
          if (m && m[1]) return normalizeImageUrl(m[1]);
        }
        const cs = window.getComputedStyle(el);
        if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
          const m2 = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
          if (m2 && m2[1]) return normalizeImageUrl(m2[1]);
        }
      } catch (e) { /* ignore */ }
    }

    // Some Amazon pages include the main image in meta tags or og:image
    const og = document.querySelector('meta[property="og:image"]');
    if (og && og.content) return normalizeImageUrl(og.content.trim());
    const linkImg = document.querySelector('link[rel="image_src"]');
    if (linkImg && linkImg.href) return normalizeImageUrl(linkImg.href.trim());
  } catch (e) {
    // ignore
  }
  return null;
}

// Main image extractor: JSON-LD -> product-json -> og:image -> link image_src -> itemprop -> common selectors
function extractMainImage() {
  // 0) Shopify product JSON (data-product-json) - many themes expose full product data
  try {
    const prodScript = document.querySelector('script[data-product-json], script[type="application/json"][data-product-json]');
    if (prodScript && prodScript.textContent) {
      try {
        const parsed = JSON.parse(prodScript.textContent || prodScript.innerText);
        if (parsed) {
          // product.images may be relative/protocol-relative
          const imgs = (parsed.product && parsed.product.images) || parsed.images || null;
          if (imgs && imgs.length) {
            const first = imgs[0];
            if (typeof first === 'string' && first.length) return normalizeImageUrl(first);
            if (first && first.src) return normalizeImageUrl(first.src);
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    }
  } catch (e) {}

  // 1) JSON-LD
  const jsonld = extractImageFromJSONLD();
  if (jsonld) return normalizeImageUrl(jsonld);

  // 1b) try noscript fallbacks (themes often include a noscript <img>)
  try {
    const noscriptImg = document.querySelector('noscript img');
    if (noscriptImg && (noscriptImg.src || noscriptImg.getAttribute('src'))) {
      return normalizeImageUrl(noscriptImg.src || noscriptImg.getAttribute('src'));
    }
  } catch (e) {}

  // 2) Open Graph (check secure variants too)
  const ogSelectors = [
    'meta[property="og:image:secure_url"]',
    'meta[property="og:image:url"]',
    'meta[property="og:image"]',
    'meta[name="og:image"]'
  ];
  for (const sel of ogSelectors) {
    const el = document.querySelector(sel);
    if (el && el.content) return normalizeImageUrl(el.content.trim());
  }

  // 3) twitter:image
  const tw = document.querySelector('meta[name="twitter:image"]');
  if (tw && tw.content) return normalizeImageUrl(tw.content.trim());

  // 4) link rel image_src
  const linkImage = document.querySelector('link[rel="image_src"]');
  if (linkImage && linkImage.href) return normalizeImageUrl(linkImage.href.trim());

  // 5) itemprop
  const itempropImg = document.querySelector('[itemprop="image"]');
  if (itempropImg) {
    if (itempropImg.tagName === 'IMG' && itempropImg.src) return normalizeImageUrl(itempropImg.src.trim());
    if (itempropImg.content) return normalizeImageUrl(itempropImg.content.trim());
  }

  // 5b) picture/source handling (common on Shopify and others)
  try {
    const pictures = Array.from(document.querySelectorAll('picture'));
    for (const pic of pictures) {
      // prefer <img> inside picture
      const img = pic.querySelector('img');
      if (img && img.src) return normalizeImageUrl(img.src.trim());
      // otherwise try source[srcset]
      const src = (pic.querySelector('source[srcset]') || {}).getAttribute && (pic.querySelector('source[srcset]') || {}).getAttribute('srcset');
      if (src) return normalizeImageUrl(src);
    }
    // fallback: any source[srcset] in page (pick a likely product one by preferring those with 'product' or 'media' in parent classes)
    const sources = Array.from(document.querySelectorAll('source[srcset]'));
    for (const s of sources) {
      const srcset = s.getAttribute('srcset');
      if (!srcset) continue;
      // prefer if parent contains product/listing/media keywords
      const parent = s.parentElement;
      const parentClass = parent && parent.className ? String(parent.className).toLowerCase() : '';
      if (parentClass.includes('product') || parentClass.includes('media') || parentClass.includes('gallery') || parentClass.includes('listing') || parentClass.includes('image')) {
        return normalizeImageUrl(srcset);
      }
    }
  } catch (e) {
    // ignore
  }

  // 6) common image selectors (site-specific fallbacks) - add extra Etsy/Shopify-specific selectors early
  const selectors = [
    // Etsy-specific
    'img.wt-max-width-full',
    'img[data-src-zoom-image]',
    'img.slider-image',
    'img[data-index="0"]',
    '.wt-carousel__slide img',
    '.wt-max-width-lg img',
    'figure[itemprop="image"] img',
    '.listing-image img',
    'div[data-carousel-listing] img',
    // Shopify/Generic
    'img#ProductPhotoImg',
    '.product-single__photo img',
    '.product__media img',
    '.product-featured img',
    '.featured-image img',
    '.product-main-image img',
    'img[data-product-image]',
    'img[data-image-src]',
    'img[data-src]',
    'img[data-srcset]',
    'img#landingImage', // Amazon
    'img.prod-hero-image__image',
    'img.prod-hero-image',
    'img.primary-image',
    'img[data-id="main-image"]',
    '.product-image img',
    '.product-gallery img',
    '.product__image img',
    '.product-photo img',
    '.pdp-image img',
    '.hero-image img',
    '.product-hero img',
    '.carousel img'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      // If it's an image element
      if (el.tagName === 'IMG' && el.src) return normalizeImageUrl(el.src.trim());

      // data-* attributes on container elements
      const dataAttrs = ['data-src', 'data-image', 'data-original', 'data-full-image', 'data-srcset', 'data-image-src', 'data-src-zoom-image'];
      for (const a of dataAttrs) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v) return normalizeImageUrl(v.trim());
      }

      // srcset attribute
      const srcset = el.getAttribute && el.getAttribute('srcset');
      if (srcset) return normalizeImageUrl(srcset.trim());

      // background-image from inline style or computed style
      try {
        const styleBg = el.style && el.style.backgroundImage;
        if (styleBg && styleBg !== 'none') {
          const m = styleBg.match(/url\(["']?(.*?)["']?\)/);
          if (m && m[1]) return normalizeImageUrl(m[1]);
        }
        const cs = window.getComputedStyle(el);
        if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
          const m2 = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
          if (m2 && m2[1]) return normalizeImageUrl(m2[1]);
        }
      } catch (e) {
        // ignore cross-origin or other style errors
      }
    }
  }

  // 7) Last resort: first <img> inside main content area (prefer images with larger naturalWidth)
  const main = document.querySelector('main') || document.body;
  const imgs = Array.from(main.querySelectorAll('img'));
  // Sort by naturalWidth/naturalHeight to prefer larger images (if available)
  imgs.sort((a, b) => (b.naturalWidth || 0) - (a.naturalWidth || 0));
  for (const img of imgs) {
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('srcset');
    if (src && src.length > 20) { // basic filter to avoid icons
      return normalizeImageUrl(src.trim());
    }
    // try computed background if image element is missing src
    try {
      const cs = window.getComputedStyle(img);
      if (cs && cs.backgroundImage && cs.backgroundImage !== 'none') {
        const m = cs.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        if (m && m[1]) return normalizeImageUrl(m[1]);
      }
    } catch (e) {}
  }

  return null;
}

// Generic extractor to work on arbitrary pages when site-specific selectors fail
function isElementVisible(el) {
  if (!el || el.nodeType !== 1) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function findFirstMatching(selectorArray) {
  for (const sel of selectorArray) {
    try {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el)) return el;
    } catch (e) {}
  }
  return null;
}

function extractGenericProduct() {
  const productData = {
    title: null,
    price: null,
    currency: null,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'Generic',
    image: null
  };

  // TITLE: prefer structured/meta, then H1, then document.title
  const titleCandidates = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[name="title"]',
    'meta[property="og:site_name"]'
  ];
  for (const sel of titleCandidates) {
    const el = document.querySelector(sel);
    if (el && el.content && el.content.trim()) {
      productData.title = el.content.trim();
      break;
    }
  }

  if (!productData.title) {
    // itemprop name
    const itemName = document.querySelector('[itemprop="name"], [itemprop="headline"]');
    if (itemName && itemName.textContent.trim()) productData.title = itemName.textContent.trim();
  }

  if (!productData.title) {
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) productData.title = h1.textContent.trim();
  }

  if (!productData.title) {
    // fallback to document.title, strip site suffix after |
    let t = document.title || '';
    if (t) {
      t = t.replace(/\s*[-|\|—–:]\s*.+$/, '');
      productData.title = t.trim();
    }
  }

  // PRICE: JSON-LD -> meta -> visible element scan
  const fromJson = extractPriceFromJSONLD();
  if (fromJson && fromJson.price) {
    productData.price = String(fromJson.price).replace(/[£$€¥₹,\s]/g, '');
    productData.currency = fromJson.currency || productData.currency;
  }

  if (!productData.price) {
    const metaPrice = document.querySelector('meta[property="product:price:amount"], meta[name="og:price:amount"], meta[itemprop="price"]');
    if (metaPrice && metaPrice.content) {
      productData.price = metaPrice.content.replace(/[£$€¥₹,\s]/g, '');
      const metaCurr = document.querySelector('meta[property="product:price:currency"], meta[itemprop="priceCurrency"]');
      if (metaCurr && metaCurr.content) productData.currency = metaCurr.content;
    }
  }

  if (!productData.price) {
    // scan visible text nodes for price patterns
    const priceRegex = /([£$€¥₹])\s?\d{1,3}(?:[\,\s]\d{3})*(?:\.\d{1,2})?/g;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
        const txt = node.nodeValue.trim();
        if (txt.length === 0 || txt.length > 200) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    const candidates = [];
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || !isElementVisible(parent)) continue;
      const val = node.nodeValue;
      const m = val.match(priceRegex);
      if (m && m.length) {
        for (const match of m) candidates.push({ text: match, el: parent });
      }
      if (candidates.length > 50) break; // avoid huge scans
    }

    if (candidates.length) {
      // prefer candidate closest to title/h1 if present
      let chosen = candidates[0];
      if (productData.title) {
        const titleEl = document.querySelector('h1') || document.querySelector('[itemprop="name"]');
        if (titleEl) {
          let best = null;
          let bestDist = Infinity;
          for (const c of candidates) {
            try {
              const d = Math.abs((c.el.getBoundingClientRect().top || 0) - (titleEl.getBoundingClientRect().top || 0));
              if (d < bestDist) { bestDist = d; best = c; }
            } catch (e) { /* ignore */ }
          }
          if (best) chosen = best;
        }
      }

      // set price and currency
      const pm = chosen.text.match(/([£$€¥₹])\s?(\d[\d,\.\s]*)/);
      if (pm) {
        productData.currency = pm[1];
        productData.price = pm[2].replace(/[ ,\s]/g, '');
      } else {
        productData.price = chosen.text.replace(/[^0-9\.]/g, '');
      }
    }
  }

  // IMAGE: reuse robust extractor
  const img = extractMainImage();
  if (img) productData.image = img;

  return productData;
}

// Helper: fill missing fields from generic extractor
function fillMissingFromGeneric(productData) {
  try {
    const generic = extractGenericProduct();
    if (!productData.title && generic.title) productData.title = generic.title;
    if (!productData.price && generic.price) productData.price = generic.price;
    if (!productData.currency && generic.currency) productData.currency = generic.currency;
    if (!productData.image && generic.image) productData.image = generic.image;
  } catch (e) {
    // ignore
  }
  return productData;
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
    site: 'Amazon',
    image: null
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

  // Populate image - prefer Amazon-specific extraction then fall back to generic
  const amazonImage = extractAmazonImage() || extractMainImage();
  if (amazonImage) productData.image = amazonImage;

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
    site: 'Etsy',
    image: null
  };

  // Extract title
  const titleSelectors = [
    'h1[data-buy-box-listing-title]',
    'h1.wt-text-body-01',
    'h1[data-product-title]',
    '.listing-page-title-component h1',
    'meta[property="og:title"]'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement) {
      const text = titleElement.content ? titleElement.content : titleElement.textContent;
      if (text && text.trim()) {
        productData.title = text.trim();
        break;
      }
    }
  }

  // Extract price
  const priceSelectors = [
    'p[data-buy-box-region="price"] .wt-text-title-03',
    '.wt-text-title-03',
    'p.wt-text-title-03',
    '[data-buy-box-region="price"]',
    'meta[property="product:price:amount"]',
    'meta[name="og:price:amount"]'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      const priceText = priceElement.content ? priceElement.content : priceElement.textContent.trim();
      if (priceText) {
        const currencyMatch = priceText.match(/^([£$€¥₹]+)/);
        if (currencyMatch) productData.currency = currencyMatch[1];
        productData.price = priceText.replace(/[£$€¥₹,\s]/g, '');
        break;
      }
    }
  }

  // If price still not found, try JSON-LD
  if (!productData.price) {
    const fromJson = extractPriceFromJSONLD();
    if (fromJson && fromJson.price) {
      productData.price = String(fromJson.price).replace(/[£$€¥₹,\s]/g, '');
      if (fromJson.currency) productData.currency = fromJson.currency;
    }
  }

  // Populate image
  const etsyImage = extractMainImage();
  if (etsyImage) productData.image = etsyImage;

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
    site: "Macy's",
    image: null
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

  // Populate image
  const macysImage = extractMainImage();
  if (macysImage) productData.image = macysImage;

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
    site: 'Walmart',
    image: null
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

  // Populate image
  const walmartImage = extractMainImage();
  if (walmartImage) productData.image = walmartImage;

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
    site: 'Target',
    image: null
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

  // Populate image
  const targetImage = extractMainImage();
  if (targetImage) productData.image = targetImage;

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
    site: 'Shopify Store',
    image: null
  };

  // Extract title
  const titleSelectors = [
    'h1.product-title',
    'h1.product__title',
    'h1[itemprop="name"]',
    '.product-single__title',
    'h1.product_name',
    'meta[property="og:title"]',
    '.product-title__title',
    '.product-single__meta h1'
  ];

  for (const selector of titleSelectors) {
    const titleElement = document.querySelector(selector);
    if (titleElement) {
      const text = titleElement.content ? titleElement.content : titleElement.textContent;
      if (text && text.trim()) {
        productData.title = text.trim();
        break;
      }
    }
  }

  // Extract price
  const priceSelectors = [
    '.price',
    '.product__price',
    'span.price-item--regular',
    'span.price-item--sale',
    '#ProductPrice',
    '.product-single__price',
    'meta[property="product:price:amount"]',
    '[data-product-price]'
  ];

  for (const selector of priceSelectors) {
    const priceElement = document.querySelector(selector);
    if (priceElement) {
      const priceText = priceElement.content ? priceElement.content : priceElement.textContent.trim();
      if (priceText) {
        const currencyMatch = priceText.match(/^([£$€¥₹]+)/);
        if (currencyMatch) productData.currency = currencyMatch[1];
        productData.price = priceText.replace(/[£$€¥₹,\s]/g, '');
        break;
      }
    }
  }

  // Fallback to JSON-LD for price
  if (!productData.price) {
    const fromJson = extractPriceFromJSONLD();
    if (fromJson && fromJson.price) {
      productData.price = String(fromJson.price).replace(/[£$€¥₹,\s]/g, '');
      if (fromJson.currency) productData.currency = fromJson.currency;
    }
  }

  // Populate image
  const shopifyImage = extractMainImage();
  if (shopifyImage) productData.image = shopifyImage;

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
    site: 'Printify',
    image: null
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

  // Populate image
  const printifyImage = extractMainImage();
  if (printifyImage) productData.image = printifyImage;

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
      // Use generic extractor for any other page/domain
      return extractGenericProduct();
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
