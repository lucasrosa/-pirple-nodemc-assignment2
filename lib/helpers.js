/**
 * Helpers for various classes
 */

 // Dependencies
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');

// Container for all the helpers

let helpers = {};

// Create a SHA256 hash
helpers.hash = function(string) {
    if (typeof(string) === 'string' && string.length > 0) {
        let hash = crypto.createHmac('sha256', config.hashingSecret).update(string).digest('hex');
        return hash;
    } else {
        return false;
    }
}
// Parse JSON string to an object in all cases without throwing
helpers.parseJsonToObject = function(string) {
    try {
        let obj = JSON.parse(string);
        return obj;
    } catch (e) {
        return {};
    }
}

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = function(strLength) {
    strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
    
    if (strLength) {
        // Define all the possible characters that go into a string
        let possibleCharacters = 'abcdefghijklmnopqrstuxyz0123456789';
        
        // Start the final string
        let str = '';

        for (i = 1; i <= strLength; i++) {
            // Get random character from the possibleCharacters string
            let randomCharacters = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            // Append this character to the final string
            str += randomCharacters;
        }

        // Return the final string
        return str;
    } else {
        return false;
    }
};

// Charge a credit card with Stripe
helpers.stripeCharge = function(amount, callback) {
    // validate parameters
    amount = typeof(amount) === "number" && amount > 0 ? amount : false;
    

    if (amount) {
        // Configure the request payload
        let payload = {
            'amount' : parseInt(amount.toFixed(2) * 100),
            'currency': 'usd',
            'source': 'tok_amex'
        };

        // Stringfy the payload
        let stringPayload = querystring.stringify(payload);
        
        // Configure the request details
        let requestDetails = {
            'protocol' : 'https:',
            'hostname' : 'api.stripe.com',
            'method' : 'POST',
            'path' : '/v1/charges',
            'auth' : 'sk_test_4eC39HqLyjWDarjtT1zdp7dc:',
            'headers' : {
                'Content-type' : 'application/x-www-form-urlencoded',
                'Content-length' : Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request object
        let req = https.request(requestDetails, res => {
            // Grab the status of the sent request
            let status = res.statusCode;

            // Used for debug
            // res.setEncoding('utf8');
            // res.on('data', function (data) {
            //     console.log('Result from Stripe: ' + data);
            // });

            // Callback successfuly if the request went through
            if (status == 200 || status == 201) {
                callback(false);
            } else {
                callback('Status code returned was '+ status);
            }
        });
        

        // Bind to the error event so it doesn't get thrown
        req.on('error', e => {
            callback(e);
        });

        // Add the payload
        req.write(stringPayload);

        // End the request
        req.end();

    } else {
        callback('Given parameters are missing or invalid.');
    }
};

// Charge a credit card with Stripe
helpers.mailgunSendEmail = function(toEmail, toName, subject, message, callback) {
    // validate parameters
    let emailRegex = /\S+@\S+\.\S+/;
    toEmail = typeof(toEmail) === 'string' && emailRegex.test(toEmail) ? toEmail.trim() : false;
    toName = typeof(toName) === 'string' && toName.trim().length > 2 ? toName.trim() : false;
    subject = typeof(subject) === 'string' && subject.trim().length > 2 ? subject.trim() : false;
    message = typeof(message) === 'string' && message.trim().length > 2 ? message.trim() : false;
    

    if (toEmail && toName && message) {
        // Configure the request payload
        let payload = {
            'from' : 'Pizza App <postmaster@sandboxa6baac78a4a64957987ab25d9b397b30.mailgun.org>',
            'to' : toEmail,
            'subject' : subject,
            'text' : message
        };

        // Stringfy the payload
        let stringPayload = querystring.stringify(payload);
        
        // Configure the request details
        let requestDetails = {
            'protocol' : 'https:',
            'hostname' : 'api.mailgun.net',
            'method' : 'POST',
            'path' : '/v3/sandboxa6baac78a4a64957987ab25d9b397b30.mailgun.org/messages',
            'auth' : 'api:6e257b0c81c03277a6a2244e6e165622-7bbbcb78-498e5946',
            'headers' : {
                'Content-type' : 'application/x-www-form-urlencoded',
                'Content-length' : Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request object
        let req = https.request(requestDetails, res => {
            // Grab the status of the sent request
            let status = res.statusCode;

            // Used for debug
            res.setEncoding('utf8');
            res.on('data', function (data) {
                console.log('Result from Mailgin: ' + data);
            });

            // Callback successfuly if the request went through
            if (status == 200 || status == 201) {
                callback(false);
            } else {
                callback('Status code returned was '+ status);
            }
        });
        

        // Bind to the error event so it doesn't get thrown
        req.on('error', e => {
            callback(e);
        });

        // Add the payload
        req.write(stringPayload);

        // End the request
        req.end();

    } else {
        callback('Given parameters are missing or invalid.');
    }
};

// Export the module
module.exports = helpers;
