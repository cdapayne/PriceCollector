# Price Collector API Server

This is the backend server for the Price Collector Chrome Extension. It provides a REST API to store collected product data in a MySQL database.

## Prerequisites

- Node.js (v14 or higher)
- MySQL Server (v5.7 or higher)
- npm or yarn

## Installation

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Configure your database connection:
   - Copy `.env.example` to `.env`
   - Edit `.env` with your MySQL credentials
```bash
cp .env.example .env
nano .env  # or use any text editor
```

4. Create the database and tables:
```bash
mysql -u your_username -p < schema.sql
```

Or manually run the SQL commands in `schema.sql` using your MySQL client.

## Configuration

Edit the `.env` file with your settings:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=price_collector
DB_USER=your_username
DB_PASSWORD=your_password

# Server Configuration
SERVER_PORT=3000
API_KEY=your_secure_random_api_key

# CORS (allow your extension)
ALLOWED_ORIGINS=*
```

**Important:** Change `API_KEY` to a secure random string. This protects your API from unauthorized access.

## Testing the Connection

Before starting the server, test your database connection:

```bash
npm test
```

This will verify:
- Database connection works
- Credentials are correct
- Products table exists
- Current product count

## Starting the Server

### Production mode:
```bash
npm start
```

### Development mode (auto-restart on changes):
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or your configured port).

## API Endpoints

### Health Check
```
GET /api/health
```
Check server and database status (no authentication required).

### Insert Single Product
```
POST /api/products
Headers: x-api-key: your_api_key
Body: {
  "title": "Product Name",
  "price": 29.99,
  "currency": "$",
  "site": "Amazon",
  "asin": "B08XYZ1234",
  "url": "https://...",
  "notes": "Optional notes",
  "timestamp": "2025-11-08T12:34:56.789Z"
}
```

### Bulk Insert Products
```
POST /api/products/bulk
Headers: x-api-key: your_api_key
Body: {
  "products": [
    { "title": "Product 1", "price": 29.99, ... },
    { "title": "Product 2", "price": 39.99, ... }
  ]
}
```

### Get All Products
```
GET /api/products?limit=100&offset=0&site=Amazon
Headers: x-api-key: your_api_key
```

### Get Statistics
```
GET /api/products/stats
Headers: x-api-key: your_api_key
```

### Delete Product
```
DELETE /api/products/:id
Headers: x-api-key: your_api_key
```

## Configuring the Chrome Extension

1. Open the extension popup
2. Go to Settings
3. Enable "Database Export"
4. Enter your API endpoint: `http://localhost:3000/api`
5. Enter your API key (from .env file)

## Security Notes

- **Never commit your `.env` file** - it's in `.gitignore`
- Use a strong, random API key
- For production, use HTTPS
- Restrict CORS to your extension's origin
- Consider using a reverse proxy (nginx) for additional security
- Keep your MySQL server secure and updated

## Troubleshooting

### Connection Refused
- Check that MySQL is running: `sudo systemctl status mysql`
- Verify port 3306 is open
- Check firewall settings

### Authentication Failed
- Verify username and password in `.env`
- Ensure user has necessary permissions
- Try connecting with mysql CLI first

### Table Not Found
- Run `schema.sql` to create tables
- Verify database name is correct

### API Key Invalid
- Check that x-api-key header matches .env
- Ensure no extra spaces in .env file

## Production Deployment

For production use:

1. Use a production MySQL server
2. Enable SSL for database connection
3. Use HTTPS for API server
4. Set up proper CORS restrictions
5. Use environment-specific configurations
6. Set up monitoring and logging
7. Use a process manager like PM2:

```bash
npm install -g pm2
pm2 start server.js --name price-collector-api
pm2 save
pm2 startup
```

## Database Backups

Regular backups are recommended:

```bash
mysqldump -u your_username -p price_collector > backup_$(date +%Y%m%d).sql
```

## Support

For issues or questions, check the main README.md in the parent directory.
