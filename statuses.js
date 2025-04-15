import express from 'express';
import path from './assets'
const path = require('path');

const app = express();

// Serve static files from the "assets" folder
app.use('/assets', express.static(path.join(__dirname, 'assets')));


// Error-handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging

    // Determine status code and corresponding image
    const statusCode = err.status || 500; // Default to 500 if no status is set
    let imagePath;

    switch (statusCode) {
        case 404:
            imagePath = '/assets/404.png'; // Path to 404 error image
            break;
        case 400:
            imagePath = '/assets/400.png'; // Path to 400 error image
            break;
        case 500:
        default:
            imagePath = '/assets/500.png'; // Path to 500 error image
            break;
    }

    // Send the error image as a response
    res.status(statusCode).sendFile(path.join(__dirname, imagePath));
});


app.get('/test-404', (req, res, next) => {
    const error = new Error('Not Found');
    error.status = 404;
    next(error);
});

app.get('/test-400', (req, res, next) => {
    const error = new Error('Bad Request');
    error.status = 400;
    next(error);
});

app.get('/test-500', (req, res, next) => {
    const error = new Error('Internal Server Error');
    error.status = 500;
    next(error);
});
