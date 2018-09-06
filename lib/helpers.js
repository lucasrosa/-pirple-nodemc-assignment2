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

// Send a SMS message via Twilio
helpers.sendTwilioSms = function(phone, msg, callback) {
    // validate parameters
    phone = typeof(phone) === "string" && phone.trim().length === 10? phone.trim() : false;
    msg = typeof(msg) === "string" && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;

    if (phone && msg) {
        // Configure the request payload
        let payload = {
            'From' : config.twilio.fromPhone,
            'To' : '+1' + phone,
            'Body' : msg
        };

        // Stringfy the payload
        let stringPayload = querystring.stringify(payload);

        // Configure the request details
        let requestDetails = {
            'protocol' : 'https:',
            'hostname' : 'api.twilio.com',
            'method' : 'POST',
            'path' : '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
            'auth' : config.twilio.accountSid + ':' + config.twilio.authToken,
            'headers' : {
                'Content-type' : 'application/x-www-form-urlencoded',
                'Content-length' : Buffer.byteLength(stringPayload)
            }
        };

        // Instantiate the request object
        let req = https.request(requestDetails, res => {
            // Grab the status of the sent request
            let status = res.statusCode;
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
