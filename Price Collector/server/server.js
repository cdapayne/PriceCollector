require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : process.env.ALLOWED_ORIGINS.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    timezone: process.env.DB_TIMEZONE || 'UTC',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// API Key Authentication Middleware
const authenticateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ 
            success: false, 
            error: 'Unauthorized: Invalid or missing API key' 
        });
    }
    
    next();
};

// Health check endpoint (no auth required)
app.get('/api/health', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        
        res.json({ 
            success: true, 
            message: 'Server and database are healthy',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: 'Database connection failed',
            message: error.message
        });
    }
});

// Insert single product
app.post('/api/products', authenticateApiKey, async (req, res) => {
    try {
        const { title, price, currency, site, asin, url, notes, timestamp } = req.body;
        
        // Validation
        if (!title || !price) {
            return res.status(400).json({ 
                success: false, 
                error: 'Title and price are required' 
            });
        }
        
        const [result] = await pool.execute(
            `INSERT INTO products (title, price, currency, site, asin, url, notes, timestamp) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, price, currency || '$', site, asin, url, notes, timestamp || new Date()]
        );
        
        res.json({ 
            success: true, 
            message: 'Product saved successfully',
            productId: result.insertId
        });
    } catch (error) {
        console.error('Error inserting product:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save product',
            message: error.message
        });
    }
});

// Bulk insert products
app.post('/api/products/bulk', authenticateApiKey, async (req, res) => {
    try {
        const { products } = req.body;
        
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Products array is required and must not be empty' 
            });
        }
        
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            let insertedCount = 0;
            
            for (const product of products) {
                if (product.title && product.price) {
                    await connection.execute(
                        `INSERT INTO products (title, price, currency, site, asin, url, notes, timestamp) 
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            product.title, 
                            product.price, 
                            product.currency || '$', 
                            product.site, 
                            product.asin, 
                            product.url, 
                            product.notes, 
                            product.timestamp || new Date()
                        ]
                    );
                    insertedCount++;
                }
            }
            
            await connection.commit();
            connection.release();
            
            res.json({ 
                success: true, 
                message: `Successfully saved ${insertedCount} products`,
                insertedCount
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('Error bulk inserting products:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save products',
            message: error.message
        });
    }
});

// Get all products
app.get('/api/products', authenticateApiKey, async (req, res) => {
    try {
        const { limit = 100, offset = 0, site, startDate, endDate } = req.query;
        
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        
        if (site) {
            query += ' AND site = ?';
            params.push(site);
        }
        
        if (startDate) {
            query += ' AND timestamp >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND timestamp <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [rows] = await pool.execute(query, params);
        
        res.json({ 
            success: true, 
            count: rows.length,
            products: rows
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch products',
            message: error.message
        });
    }
});

// Get product statistics
app.get('/api/products/stats', authenticateApiKey, async (req, res) => {
    try {
        const [totalCount] = await pool.execute('SELECT COUNT(*) as total FROM products');
        const [bySite] = await pool.execute(
            'SELECT site, COUNT(*) as count FROM products GROUP BY site ORDER BY count DESC'
        );
        const [avgPrice] = await pool.execute(
            'SELECT AVG(price) as average, MIN(price) as minimum, MAX(price) as maximum FROM products'
        );
        
        res.json({ 
            success: true, 
            stats: {
                totalProducts: totalCount[0].total,
                bySite: bySite,
                pricing: avgPrice[0]
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch statistics',
            message: error.message
        });
    }
});

// Delete product by ID
app.delete('/api/products/:id', authenticateApiKey, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Product not found' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Product deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete product',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║   Price Collector API Server                  ║
║   Running on http://localhost:${PORT}            ║
║                                                ║
║   Database: ${process.env.DB_NAME}                      ║
║   Host: ${process.env.DB_HOST}                         ║
╚════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await pool.end();
    process.exit(0);
});
