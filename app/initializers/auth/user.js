'use strict';

let UserInvalidTokenError = require('../../../lib/errors/user-invalid-token-error'),
    UserNotFoundError = require('../../../lib/errors/user-not-found-error');

var async = require('async');

var tokens = require('./../../../lib/tokens'),
    query = require('./../../../lib/sql/query');

module.exports = function(app, callback) {

    app.use(function(req, res, next) {
        req.user = {
            id: null,
            admin: false,
            verified: false
        };

        if(!req.headers['x-user-token']) return next();

        req.user.token = req.headers['x-user-token'];
        req.user.decoded = tokens.decode(req.user.token);

        if(!req.user.decoded) return next(new UserInvalidTokenError);

        req.user.email = req.user.decoded.email;

        async.series([
            function(callback) {
                query('SELECT user_id AS id FROM user_token WHERE token = ?', [req.user.token], function(err, results) {
                    if(err) return callback(err);

                    if(results.length === 0) return callback(new UserInvalidTokenError);

                    req.user.id = parseInt(results[0].id);

                    callback();
                });
            },
            function(callback) {
                query('SELECT id,admin,verified FROM user WHERE id = ?', [req.user.id], function(err, results) {
                    if(err) return callback(err);

                    if(!results[0]) return callback(new UserNotFoundError);

                    req.user.admin = !!results[0].admin;
                    req.user.verified = !!results[0].verified;

                    callback();
                });
            }
        ], function(err) {
            next(err);
        });
    });

    callback();
};
