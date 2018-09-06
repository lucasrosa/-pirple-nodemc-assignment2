/**
 * Request handlers
 */

// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');


// Define handlers
let handlers = {};

// Users
handlers.users = function(data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    } else {
        callback(405);
    }
}

// Container for the users submethods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = function(data, callback) {
    // Check that all required fields are filled out
    let firstName = typeof(data.payload.firstName) === 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    let lastName = typeof(data.payload.lastName) === 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    let phone = typeof(data.payload.phone) === 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    let password = typeof(data.payload.password) === 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    let tosAgreement = typeof(data.payload.tosAgreement) === 'boolean' && data.payload.tosAgreement === true ? true : false;

    if (firstName && lastName && phone & password && tosAgreement) {
        // Make sure the users doesn't already exist
        _data.read('users', phone, function(err, data){
            if(err) {
                // Hash the password
                let hashedPassword = helpers.hash(password);

                if (hashedPassword) {
                    // Create the user object
                    let userObject = {
                        'firstName' : firstName,
                        'lastName' : lastName,
                        'phone' : phone,
                        'hashedPassword' : hashedPassword,
                        'tosAgreement' : true
                    };

                    // Store the user
                    _data.create('users', phone, userObject, err => {
                        if (!err) {
                            callback(200);
                        } else {
                            console.log(err);
                            callback(500, {'Error' : 'Could not create the new user.'})
                        }
                    });
                } else {
                    callback(500, {'Error' : 'Could not hash the user\'s password.'});
                }    
            } else {
                // User already exists
                callback(400, {'Error': 'A user with that phone number already exists.'});
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required fields.'});
    }
};

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = function(data, callback) {
    // Check that the phone number is valid
    let phone = typeof(data.queryStringObject.phone) === 'string' && data.queryStringObject.phone.trim().length === 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
        // Get the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, tokenIsValid => {
            if (tokenIsValid) {
                // Lookup the user
                _data.read('users', phone, (err, data) =>{
                    if(!err && data) {
                        // Remove the hashed password before returning it to the requester
                        delete data.hashedPassword;
                        callback(200, data);
                    } else {
                        callback(404);
                    }        
                });
            } else {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field.'});
    }
};

// Users - put
// Required data: phone 
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = function(data, callback) {
    let phone = typeof(data.payload.phone) === 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;

    let firstName = typeof(data.payload.firstName) === 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    let lastName = typeof(data.payload.lastName) === 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    let password = typeof(data.payload.password) === 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;


    // Error if the phone is invalid
    if (phone) {
        if (firstName || lastName || password) {
            // Get the token from the headers
            let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            // Verify that the given token is valid for the phone number
            handlers._tokens.verifyToken(token, phone, tokenIsValid => {
                if (tokenIsValid) {
                    // Lookup the user
                    _data.read('users', phone, (err, userData) => {
                        if (!err && userData) {
                            // Update the necessary fields
                            if (firstName) {
                                userData.firstName = firstName;
                            }

                            if (lastName) {
                                userData.lastName = lastName;
                            }

                            if (password) {
                                userData.hashedPassword = helpers.hash(password);
                            }

                            // Store the new updates
                            _data.update('users', phone, userData, err => {
                                if (!err) {
                                    callback(200);
                                } else {
                                    console.log(err);
                                    callback(500, {'Error' : 'Could not update the user.'})
                                }
                            });

                        } else {
                            callback(400, {'Error' : 'The specified user does not exist.'});
                        }
                    });
                } else {
                    callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
                }
            });           
        } else {
            callback(400, {'Error': 'Missing fields to update'});
        }
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// Users -delete
// Required data: phone
handlers._users.delete = function(data, callback) {
    // Check that the phone number is valid
    let phone = typeof(data.queryStringObject.phone) === 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;

    if (phone) {
        // Get the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyToken(token, phone, tokenIsValid => {
            if (tokenIsValid) {
                // Lookup the user
                _data.read('users', phone, (err, userData) => {
                    if (!err && userData) {
                        _data.delete('users', phone, err => {
                            if (!err) {
                                // Delete each of the checks associated with the user
                                let userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                let checksToDelete = userChecks.length;
                                if (checksToDelete > 0) {
                                    let checksDeleted = 0;
                                    let deletionErrors = false;
                                    userChecks.forEach(checkId => {
                                        // Delete the check
                                        _data.delete('checks', checkId, err => {
                                            if (err) {
                                                deletionErrors = true;
                                            }
                                            checksDeleted++;

                                            if (checksDeleted == checksToDelete) {
                                                if (!deletionErrors) {
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error': 'Errors encountered while attempting to delete all of the user\'s checks. All checks may not have been deleted from the system successfully.'});
                                                }
                                            }
                                        });
                                    });
                                } else {
                                    callback(200);
                                }
                            } else {
                                callback(500, {'Error':'Could not delete the specified user.'});
                            }
                        });
                    } else {
                        callback(400, {'Error' : 'The specified user does not exist.'});
                    }
                });
            } else {
                callback(403, {'Error' : 'Missing required token in header, or token is invalid.'})
            }
        });    
    } else {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

// Tokens
handlers.tokens = function(data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        callback(405);
    }
}

// Container for all the tokens methods
handlers._tokens = {}


// Tokens - post
// Required data: phone, password
// Optional data: nome
handlers._tokens.post = function(data, callback) {
    let phone = typeof(data.payload.phone) === 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    let password = typeof(data.payload.password) === 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

    if (phone && password) {
        // Lookup the user that matches that phone number
        _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
                // Hash the sent password and compare it to the password stored in the user object
                let hashedPassword = helpers.hash(password);
                if (hashedPassword == userData.hashedPassword) {
                    // If valid create a new token with a random name. Set expiration date 1 hour into the future
                    let tokenId = helpers.createRandomString(20);
                    let expires = Date.now() + 1000 * 60 * 60;
                    let tokenObject = {
                        'phone' : phone,
                        'id': tokenId,
                        'expires': expires
                    };

                    // Store the token
                    _data.create('tokens', tokenId, tokenObject, err => {
                        if (!err) {
                            callback(200, tokenObject);
                        } else {
                            callback(500, {'Error': 'Could not create the new token.'})
                        }
                    });
                } else {
                    callback(400, {'Error': 'Password did not match specified user\'s stored password'});
                }
            } else {
                callback(400, {'Error': 'Could not find the specified user.'})
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field(s).'})
    }
};

// Tokens - get
// Required data: id
// Optional data: none
handlers._tokens.get = function(data, callback) {
    // Check that the phone number is valid
    let id = typeof(data.queryStringObject.id) === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
        // Lookup the user
        _data.read('tokens', id, (err, tokenData) =>{
            if(!err && tokenData) {
                callback(200, tokenData);
            } else {
                callback(404);
            }        
        });
    } else {
        callback(400, {'Error': 'Missing required field.'});
    }    
};

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data, callback) {
    let id = typeof(data.payload.id) === 'string' && data.payload.id.trim().length === 20 ? data.payload.id.trim() : false;
    let extend = typeof(data.payload.extend) === 'boolean' && data.payload.extend === true ? true : false;
    
    if (id && extend) {
        // Lookup the token
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                // Check to make sure the token isn't already expired
                if (tokenData.expires > Date.now()) {
                    // Set the expiration date an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;

                    // Store the new updates
                    _data.update('tokens', id, tokenData, err => {
                        if (!err) {
                            callback(200);
                        } else {
                            callback(500, {'Error' : 'Could not update the token\'s expiration'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'The token is already expired, and cannot be extended.'});
                }
            } else {
                callback(400, {'Error' : 'Specified token does not exist.'});
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required field(s) or fields are invalid.'});
    }
};

// Tokens - delete
handlers._tokens.delete = function(data, callback) {
    // Check that the id is valid
    let id = typeof(data.queryStringObject.id) === 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

    if (id) {
        // Lookup the user
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                _data.delete('tokens', id, err => {
                    if (!err) {
                        callback(200);
                    } else {
                        callback(500, {'Error':'Could not delete the specified token.'});
                    }
                });
            } else {
                callback(400, {'Error' : 'The specified token does not exist.'});
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required field.'});
    }    
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, phone, callback) {
    // Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
        if (!err && tokenData) {
            // Check that the token is for a given user and has not expired
            if (tokenData.phone == phone && tokenData.expires > Date.now()) {
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    });
}

// Checks
handlers.checks = function(data, callback) {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._checks[data.method](data, callback);
    } else {
        callback(405);
    }
}

// Container for all the checks methods
handlers._checks = {};

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none
handlers._checks.post = function(data, callback) {
    // validate inputs
    let protocol = typeof(data.payload.protocol) === 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol.trim() : false;
    let url = typeof(data.payload.url) === 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    let method = typeof(data.payload.method) === 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method.trim() : false;
    let successCodes = typeof(data.payload.successCodes) === 'object' && data.payload.successCodes instanceof Array  && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    let timeoutSeconds = typeof(data.payload.timeoutSeconds) === 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (protocol &&  url && method && successCodes) {
        // Get the token from the headers
        let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

        // Lookup the user by reading the token
        _data.read('tokens', token, function(err, tokenData){
            if (!err && tokenData) {
                let userPhone = tokenData.phone;

                // Lookup the user data
                _data.read('users', userPhone, function(err, userData) {
                    if (!err && userData) {
                        let userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                        // Verify that the usar has less than the number of max-checks-per-user
                        if (userChecks.length < config.maxChecks) {
                            // Create a random ID for the check
                            let checkId = helpers.createRandomString(20);

                            // Create the check object, and include the user's phone
                            let checkObject = {
                                'id' : checkId,
                                'userPhone' : userPhone,
                                'protocol' : protocol,
                                'url' : url,
                                'method' : method,
                                'successCodes' : successCodes,
                                'timeoutSeconds' : timeoutSeconds
                            };

                            // Save the object to disk
                            _data.create('checks', checkId, checkObject, err => {
                                if (!err) {
                                    // Add the check id to the user's object
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // Save the new user data
                                    _data.update('users', userPhone, userData, err => {
                                        if (!err) {
                                            // Return the data about the new check
                                            callback(200, checkObject);
                                        } else {
                                            callback(500, {'Error': 'Could not update the user with the new check.'});
                                        }
                                    });
                                } else {
                                    callback(500, {'Error': 'Could not create the new check.'})
                                }
                            });
                        } else {
                            callback(400, {'Error' : 'The user already has the maximum number of checks ('+config.maxChecks+').'});
                        }
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(403);
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required inputs, or inputs are invalid.'});
    }
};

// Checks - get
// Required data : id
// Optional data : none
handlers._checks.get = function(data, callback) {
    // Check that the id is valid
    let id = typeof(data.queryStringObject.id) === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;
    if (id) {

        // Lookup the check
        _data.read('checks', id, (err, checkData) => {
            if (!err && checkData) {
                // Get the token from the headers
                let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid and belongs to the user that created the check
                handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                    if (tokenIsValid) {
                        // Return the check data
                        callback(200, checkData);
                    } else {
                        callback(403)
                    }
                });
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field.'});
    }
};

// Checks - put
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = function(data, callback) {
    let id = typeof(data.payload.id) === 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

    // validate inputs
    let protocol = typeof(data.payload.protocol) === 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol.trim() : false;
    let url = typeof(data.payload.url) === 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    let method = typeof(data.payload.method) === 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method.trim() : false;
    let successCodes = typeof(data.payload.successCodes) === 'object' && data.payload.successCodes instanceof Array  && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    let timeoutSeconds = typeof(data.payload.timeoutSeconds) === 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if (id) {
        // Check to make sure one or more optional field has been sent
        if (protocol || url || method || successCodes || timeoutSeconds) {
            // Lookup the check
            _data.read('checks', id, (err, checkData) => {
                if (!err && checkData) {
                    // Get the token from the headers
                    let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                    // Verify that the given token is valid and belongs to the user that created the check
                    handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                        if (tokenIsValid) {
                            // Update the check where necessary
                            if (protocol) {
                                checkData.protocol = protocol;
                            }

                            if (url) {
                                checkData.url = url;
                            }

                            if (method) {
                                checkData.method = method;
                            }

                            if (successCodes) {
                                checkData.successCodes = successCodes;
                            }

                            if (timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds;
                            }

                            // Store the new updates
                            _data.update('checks', id, checkData, err => {
                                if (!err) {
                                    callback(200);
                                } else {
                                    callback(500, {'Error': 'Could not update the check.'})
                                }
                            });
                            
                        } else {
                            callback(403)
                        }
                    });
                } else {
                    callback(400, {'Error': 'Check ID did not exist.'})
                }     
            });
        } else {
            callback(400, {'Error':'Missing fields to update.'})
        }
    } else {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function(data, callback) {
    // Check that the id is valid
    let id = typeof(data.queryStringObject.id) === 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

    if (id) {
        // Lookup the check
        _data.read('checks', id, (err, checkData) => {
            if (!err && checkData) {
                // Get the token from the headers
                let token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid for the phone number
                handlers._tokens.verifyToken(token, checkData.userPhone, tokenIsValid => {
                    if (tokenIsValid) {

                        // Delete the check data
                        _data.delete('checks', id, err => {
                            if (!err) {
                                // Lookup the user
                                _data.read('users', checkData.userPhone, (err, userData) => {
                                    if (!err && userData) {
                                        let userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                                        
                                        // Remove the deleted check from their list of checks
                                        let checkPosition = userChecks.indexOf(id);

                                        if (checkPosition > -1) {
                                            userChecks.splice(checkPosition, 1);
                                            // Re-save the user's data
                                            _data.update('users',  checkData.userPhone, userData, err => {
                                                if (!err) {
                                                    callback(200);
                                                } else {
                                                    callback(500, {'Error':'Could not update the user.'});
                                                }
                                            });
                                        } else {
                                            callback(500, {'Error': 'Could not find the check on the user\'s object, so could not remove it.'});
                                        }
                                    } else {
                                        callback(500, {'Error' : 'Could not find user who created the check, so it could not delete the check from the list of checks in the user object.'});
                                    }
                                });
                            } else {
                                callback(500, {'Error': 'Could not delete the check data.'});
                            }
                        });
                    } else {
                        callback(403)
                    }
                }); 
            } else {
                callback(400, {'Error' : 'The specified check id does not exist.'});
            }
        });   
    } else {
        callback(400, {'Error' : 'Missing required field.'});
    }
};

// Ping handler
handlers.ping = function(data, callback) {
    callback(200);
};

// Not found handler
handlers.notFound = function(data, callback) {
    callback(404)
}

module.exports = handlers;