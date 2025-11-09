# Price Collector Chrome Extension

A Chrome extension that collects product titles and prices from multiple e-commerce platforms and exports them as CSV or JSON files.

## Features

- 🛒 **Multi-Platform Support**: Works with Amazon, Etsy, Walmart, Target, Macy's, Shopify stores, and Printify
- 💰 **Price Extraction**: Extracts product title, price, currency, and product IDs
- ✏️ **Manual Entry**: Add products from any website manually when auto-detection isn't available
- 📋 **Easy Collection**: Click a button to collect product information
- 💾 **Export Options**: Export collected data as CSV, JSON, or to MySQL database
- 🗄️ **Database Integration**: Optional MySQL database storage with REST API
- 🌍 **Multi-Region Support**: Works with international versions of supported sites
- 📊 **View Data**: Preview collected products before exporting
- 🎯 **Context Menu**: Right-click to quickly collect products
- 🔔 **Notifications**: Get notified when products are collected

## Supported Platforms

### Amazon
- ✅ amazon.com (United States)
- ✅ amazon.ca (Canada)
- ✅ amazon.co.uk (United Kingdom)
- ✅ amazon.de (Germany)
- ✅ amazon.fr (France)
- ✅ amazon.it (Italy)
- ✅ amazon.es (Spain)
- ✅ amazon.co.jp (Japan)
- ✅ amazon.in (India)
- ✅ amazon.com.au (Australia)

### Other E-Commerce Sites
- ✅ **Etsy** - Handmade and vintage items
- ✅ **Walmart** - Retail products
- ✅ **Target** - Retail products
- ✅ **Macy's** - Department store items
- ✅ **Shopify Stores** - Any store powered by Shopify (*.myshopify.com)
- ✅ **Printify** - Print-on-demand products

## Installation

### Method 1: Load Unpacked Extension (Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select the "Price Collector" folder
5. The extension is now installed!

### Method 2: Create PNG Icons (Optional)

The extension currently uses SVG icons. To use PNG icons instead:

1. Convert the SVG files in the `icons/` folder to PNG format:
   - icon16.svg → icon16.png (16x16)
   - icon32.svg → icon32.png (32x32)
   - icon48.svg → icon48.png (48x48)
   - icon128.svg → icon128.png (128x128)

2. Update `manifest.json` to reference `.png` files instead of `.svg`

You can use online tools like:
- [Cloudconvert](https://cloudconvert.com/svg-to-png)
- [Online-Convert](https://image.online-convert.com/convert-to-png)

Or use ImageMagick from command line:
```bash
cd icons
for file in *.svg; do
  convert -background none -density 300 "$file" "${file%.svg}.png"
done
```

## Usage

### Collecting Products

1. Navigate to any supported product page (Amazon, Etsy, Walmart, Target, Macy's, Shopify store, or Printify)
2. Click the extension icon in your toolbar
3. The extension will automatically detect and display the product information
4. Click "📋 Collect This Product" to add it to your collection
5. Repeat for other products you want to collect

### Alternative: Using Context Menu

1. Right-click anywhere on a supported product page
2. Select "Collect This Product" from the context menu
3. A notification will confirm the product was collected

### Manual Entry

For websites not automatically supported, you can manually enter product information:

1. Click the extension icon
2. Click "✏️ Manual Entry" button
3. Fill in the product details:
   - **Product Title** (required)
   - **Price** (required, numbers only)
   - **Currency** (select from dropdown)
   - **Site Name** (e.g., "eBay", "AliExpress")
   - **Product URL** (auto-filled with current page URL)
   - **Notes** (optional, for additional information)
4. Click "💾 Save Product"

**Manual Entry Tips:**
- The URL field is automatically populated with your current page
- Enter only numeric values for price (e.g., "29.99" not "$29.99")
- Use the notes field to add size, color, or other product variants
- Manual entries are labeled with the site name you provide (or "Manual Entry" if blank)

### Exporting Data

1. Click the extension icon
2. Choose your preferred export format (CSV or JSON) from the settings
3. Click "💾 Export Data"
4. Choose where to save the file

### Exporting to Database

For persistent storage and advanced querying, you can export to a MySQL database:

1. **Set up the backend server** (see [Database Setup](#database-setup) below)
2. Click the extension icon
3. Go to Settings
4. Check "Enable Database Export"
5. Enter your API Endpoint (e.g., `http://localhost:3000/api`)
6. Enter your API Key (from server/.env file)
7. Click "🔌 Test Connection" to verify
8. Click "🗄️ Export to Database" to save all collected products

**Benefits of Database Export:**
- Persistent storage across devices
- Query and analyze data with SQL
- Build custom reports and dashboards
- Share data with team members
- Automatic timestamps and indexing

### Viewing Collected Data

1. Click the extension icon
2. Click "View Collected Data" at the bottom
3. A new window will open showing all collected products

### Clearing Data

1. Click the extension icon
2. Click "🗑️ Clear All Data"
3. Confirm the action (this cannot be undone)

## File Structure

```
Price Collector/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.css             # Popup styling
├── popup.js              # Popup logic
├── content.js            # Content script for e-commerce pages
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon16.svg
│   ├── icon32.svg
│   ├── icon48.svg
│   └── icon128.svg
├── server/               # Optional backend server for database
│   ├── .env.example      # Environment variables template
│   ├── .env              # Your database credentials (gitignored)
│   ├── package.json      # Node.js dependencies
│   ├── server.js         # Express API server
│   ├── schema.sql        # Database schema
│   ├── test-connection.js # Connection test script
│   └── README.md         # Server documentation
└── README.md             # This file
```

## Data Format

### CSV Export Format
```
Title,Price,Currency,Site,ASIN,URL,Notes,Timestamp
"Product Name",29.99,$,Amazon,B08XYZ1234,https://amazon.com/...,,2025-11-08T...
"Handmade Item",45.00,$,Etsy,,https://etsy.com/...,,2025-11-08T...
"Custom Product",19.99,€,eBay,,https://ebay.com/...,"Size: Large",2025-11-08T...
```

### JSON Export Format
```json
[
  {
    "title": "Product Name",
    "price": "29.99",
    "currency": "$",
    "site": "Amazon",
    "url": "https://amazon.com/...",
    "timestamp": "2025-11-08T12:34:56.789Z",
    "asin": "B08XYZ1234"
  },
  {
    "title": "Custom Product",
    "price": "19.99",
    "currency": "€",
    "site": "eBay",
    "url": "https://ebay.com/...",
    "timestamp": "2025-11-08T12:35:23.456Z",
    "notes": "Size: Large"
  }
]
```

### Database Schema
```sql
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT '$',
    site VARCHAR(100),
    asin VARCHAR(50),
    url TEXT,
    notes TEXT,
    timestamp DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Platform-Specific Notes

### Amazon
- Extracts ASIN (Amazon Standard Identification Number)
- Handles multiple price formats (sale prices, regular prices)
- Works on product detail pages (URLs containing `/dp/` or `/gp/product/`)

### Etsy
- Detects listings pages (URLs containing `/listing/`)
- Handles dynamic pricing for customizable items

### Walmart
- Works on item pages (URLs containing `/ip/`)
- Extracts standard product information

### Target
- Works on product pages (URLs containing `/p/`)
- Handles Target-specific pricing displays

### Macy's
- Works on product pages (URLs containing `/shop/product/`)
- Handles both sale and regular prices

### Shopify Stores
- Works on any Shopify-powered store
- Looks for product pages (URLs containing `/products/`)
- Handles various Shopify themes and layouts

### Printify
- Works on product pages
- Extracts standard product and pricing information

## Manual Entry Use Cases

Use manual entry when:
- Shopping on sites not automatically supported (eBay, AliExpress, Wish, etc.)
- Product information isn't detected correctly
- Collecting prices from physical stores or catalogs
- Tracking prices from social media marketplaces (Facebook Marketplace, Craigslist)
- Recording custom quotes or negotiated prices
- Adding product variants with specific details (size, color, etc.) in notes

The manual entry feature makes the extension work with **any website or even offline sources**.

## Database Setup

The extension includes an optional backend server for MySQL database integration.

### Prerequisites

- Node.js (v14 or higher)
- MySQL Server (v5.7 or higher)
- Basic knowledge of terminal/command line

### Quick Start

1. **Navigate to server directory:**
```bash
cd server
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure database connection:**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your database credentials
nano .env  # or use any text editor
```

Edit these key settings in `.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=price_collector
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
SERVER_PORT=3000
API_KEY=create_a_secure_random_string_here
```

4. **Create the database:**
```bash
mysql -u your_username -p < schema.sql
```

Or run the SQL commands in `schema.sql` using MySQL Workbench or phpMyAdmin.

5. **Test the connection:**
```bash
npm test
```

6. **Start the server:**
```bash
npm start
```

The server will run on `http://localhost:3000` (or your configured port).

### Detailed Documentation

For complete setup instructions, API documentation, troubleshooting, and production deployment, see:
- **[server/README.md](server/README.md)** - Complete server documentation
- **[server/.env.example](server/.env.example)** - Configuration options

### Security Notes

- Never commit your `.env` file (it's in `.gitignore`)
- Use a strong, random API key
- For production, use HTTPS and restrict CORS
- Keep your MySQL credentials secure

## Troubleshooting

### Product not detected
- Make sure you're on a product detail page (not a category or search results page)
- Supported URL patterns:
  - Amazon: `/dp/` or `/gp/product/`
  - Etsy: `/listing/`
  - Walmart: `/ip/`
  - Target: `/p/`
  - Macy's: `/shop/product/`
  - Shopify: `/products/`
  - Printify: `/product/`
- Try refreshing the page
- Click the "🔄 Refresh" button in the popup

### Price not showing
- Different sites use different page layouts
- Some prices may be loaded dynamically - try waiting a moment and refreshing
- The extension attempts to find prices using multiple selectors for each platform
- Variable pricing (e.g., "Select options" products) may not be detected

### Site not working
- Each e-commerce platform frequently updates their HTML structure
- If a specific site stops working, the extension may need updates to its selectors
- Check that you're on a product detail page, not a category or search page

### Export not working
- Check that you have collected at least one product
- Make sure your browser allows downloads from extensions
- Check your browser's download settings

### Manual entry issues
- Ensure price contains only numbers and decimal point (e.g., "29.99")
- Title and price fields are required
- All other fields are optional
- The URL field auto-fills but can be edited or left as-is

### Database connection issues
- Verify server is running: Check terminal where you ran `npm start`
- Test connection using the "🔌 Test Connection" button
- Ensure API endpoint includes `/api` (e.g., `http://localhost:3000/api`)
- Verify API key matches the one in server/.env
- Check that MySQL server is running
- Review server/README.md for detailed troubleshooting

## Privacy

This extension:
- ✅ Only works on supported e-commerce sites
- ✅ Stores data locally in your browser
- ✅ Does NOT send any data to external servers
- ✅ Does NOT track your browsing history
- ✅ Only accesses pages when you explicitly click the extension icon or use the context menu

## Permissions Explained

- **storage**: Save collected products locally
- **activeTab**: Access the current Amazon page when you click the extension
- **scripting**: Extract product information from Amazon pages
- **notifications**: Show notifications when products are collected
- **downloads**: Allow exporting data to CSV/JSON files
- **contextMenus**: Add right-click menu option for quick collection

## Development

### Modifying the Extension

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Adding Support for More Websites

To add support for additional e-commerce sites:

1. **Update manifest.json**: Add URL patterns to `host_permissions` and `content_scripts.matches`
2. **Update content.js**: 
   - Add site detection in `detectSite()` function
   - Create a new extraction function (e.g., `extractNewSiteProduct()`)
   - Add product page detection logic in `isProductPage()`
   - Add case to the switch statement in `extractProductInfo()`
3. **Update background.js**: Add URL patterns to context menu `documentUrlPatterns`
4. **Update popup.js**: Add site domain to `supportedSites` array in `refreshProductData()`

Example template for a new site:
```javascript
function extractNewSiteProduct() {
  const productData = {
    title: null,
    price: null,
    currency: '$',
    url: window.location.href,
    timestamp: new Date().toISOString(),
    site: 'NewSite'
  };
  
  // Add selectors specific to the new site
  const titleElement = document.querySelector('h1.product-title');
  if (titleElement) {
    productData.title = titleElement.textContent.trim();
  }
  
  const priceElement = document.querySelector('.product-price');
  if (priceElement) {
    let priceText = priceElement.textContent.trim();
    priceText = priceText.replace(/[$,\s]/g, '');
    productData.price = priceText;
  }
  
  return productData;
}
```

## Future Enhancements

Potential features to add:
- [ ] Historical price tracking and graphs
- [ ] Price comparison across platforms
- [ ] Automatic price drop alerts
- [ ] Support for more e-commerce platforms (eBay, AliExpress, etc.)
- [ ] Cloud sync across devices
- [ ] Import existing data from CSV/JSON
- [ ] Advanced filtering and search within collected products
- [ ] Bulk operations (edit, delete multiple items)
- [ ] Product categories and tagging
- [ ] Price statistics and analytics

## License

Free to use and modify for personal or commercial purposes.

## Support

For issues or questions, please check:
1. The troubleshooting section above
2. Chrome's extension debugging tools (`chrome://extensions/` → Details → Inspect views)

---

**Version**: 1.0.0  
**Last Updated**: November 8, 2025
