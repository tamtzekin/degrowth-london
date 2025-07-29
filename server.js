const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

// MIME types for different file extensions
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
}

function serveFile(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url);

    // Default to index.html for root requests
    if (req.url === '/') {
        filePath = path.join(__dirname, 'london.html');
    }

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            // If file doesn't exist, try with .html extension
            if (!path.extname(filePath)) {
                filePath += '.html';
                fs.access(filePath, fs.constants.F_OK, (err) => {
                    if (err) {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end('<h1>404 Not Found</h1>');
                    } else {
                        serveFile(res, filePath);
                    }
                });
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>');
            }
        } else {
            // Check if it's a directory
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<h1>500 Internal Server Error</h1>');
                    return;
                }

                if (stats.isDirectory()) {
                    // Try to serve index.html from directory
                    const indexPath = path.join(filePath, 'london.html');
                    fs.access(indexPath, fs.constants.F_OK, (err) => {
                        if (err) {
                            res.writeHead(404, { 'Content-Type': 'text/html' });
                            res.end('<h1>404 Not Found</h1>');
                        } else {
                            serveFile(res, indexPath);
                        }
                    });
                } else {
                    serveFile(res, filePath);
                }
            });
        }
    });
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Degrowth London development server running at:`);
    console.log(`   Local:   http://${HOST}:${PORT}`);
    console.log(`   Network: http://localhost:${PORT}`);
    console.log(`\n📂 Serving files from: ${__dirname}`);
    console.log(`\n🎯 Main file: london.html`);
    console.log(`\n💡 Press Ctrl+C to stop the server`);

    // Try to open browser automatically
    const openUrl = `http://${HOST}:${PORT}`;
    const start = process.platform === 'darwin' ? 'open' :
                 process.platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${start} ${openUrl}`, (error) => {
        if (error) {
            console.log(`\n🌐 Please open your browser manually and navigate to: ${openUrl}`);
        } else {
            console.log(`\n🌐 Opening browser automatically...`);
        }
    });
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down development server...');
    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
