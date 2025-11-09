require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
    console.log('Testing MySQL connection...\n');
    console.log('Configuration:');
    console.log(`  Host: ${process.env.DB_HOST}`);
    console.log(`  Port: ${process.env.DB_PORT}`);
    console.log(`  Database: ${process.env.DB_NAME}`);
    console.log(`  User: ${process.env.DB_USER}`);
    console.log();
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
        });
        
        console.log('✅ Successfully connected to MySQL database!');
        
        // Test query
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('✅ Test query successful:', rows[0]);
        
        // Check if products table exists
        const [tables] = await connection.execute(
            "SHOW TABLES LIKE 'products'"
        );
        
        if (tables.length > 0) {
            console.log('✅ Products table exists');
            
            // Get row count
            const [count] = await connection.execute('SELECT COUNT(*) as total FROM products');
            console.log(`   Current product count: ${count[0].total}`);
        } else {
            console.log('⚠️  Products table does not exist. Please run schema.sql to create it.');
        }
        
        await connection.end();
        console.log('\n✅ Connection test completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('\nTroubleshooting tips:');
        console.error('1. Check that MySQL is running');
        console.error('2. Verify your credentials in the .env file');
        console.error('3. Ensure the database exists (run schema.sql)');
        console.error('4. Check firewall settings if connecting to remote server');
        process.exit(1);
    }
}

testConnection();
