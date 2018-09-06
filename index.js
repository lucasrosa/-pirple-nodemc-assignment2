/**
 * Primary file for API
 */

// Dependencies
const server = require('./lib/server');

// Declare the app
let app = {};

// Init function
app.init = function() {
    // Start the server
    server.init();
};

// Execute
app.init();

// Export the app
module.export = app;