'use strict';

var async = require('async'),
    nconf = require('nconf'),
    moment = require('moment');

var query = require('./../../lib/sql/query'),
    sequel = require('./../../lib/sql/sequel'),
    hasher = require('./../../lib/hasher'),
    mailer = require('./../../lib/mailer'),
    onion = require('./../../lib/onion');

var users = require('./../../lib/specific/users');

module.exports = function(router) {
    var sql = 'SELECT ' +
        'id, ' +
        'displayname, ' +
        'email, ' +
        'verified, ' +
        'admin, ' +
        'firstname, ' +
        'surname, ' +
        'created, ' +
        'updated, ' +
        'deleted ' +
        'FROM user';

    // Basic user routes

    router.route('/')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted is NULL';

            sequel.get(req, res, next, call);
        })
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.email = req.body.email;
            insert.password = req.body.password || hasher(128);
            insert.displayname = req.body.displayname || req.body.email;

            async.series([
                function(callback) {
                    onion.encrypt(insert.password, function(err, result) {
                        if(err) return callback(err);

                        insert.encrypted = result;

                        callback();
                    });
                },
                function(callback) {
                    insert.verify = {};
                    insert.verify.secret = hasher(128);
                    insert.verify.timeout = moment().add(nconf.get('timeouts:users:verify:amount'), nconf.get('timeouts:users:verify:time')).format("YYYY-MM-DD HH:mm:ss");

                    query('INSERT INTO user (email,password,displayname,verify_secret,verify_timeout) VALUES (?,?,?,?,?)', [insert.email, insert.encrypted, insert.displayname, insert.verify.secret, insert.verify.timeout], function(err, result) {
                        if(err) return callback(err);

                        user.id = result.insertId;

                        callback();
                    });
                },
                function(callback) {
                    var subject = 'User Verification';
                    var text =
                        '<b>Hello!</b>' +
                        '<br/>' +
                        'Use the following verification code to verify your account creation: <a href="' + nconf.get('links:base') + nconf.get('links:users:create') + insert.verify.secret + '">' + insert.verify.secret + '</a>' +
                        '<br/>'
                    ;

                    mailer(insert.email, subject, text, callback);
                },
                function(callback) {
                    users.token(req, user.id, function(err, result) {
                        if(err) return callback(err);

                        user.token = result;

                        callback();
                    });
                }
            ], function(err) {
                if(err) return next(err);

                res.status(201).send({id: user.id, token: user.token});
            });
        });

    // Information about current user

    router.route('/info')
        .get(function(req, res, next) {
            if(!req.user) return next('Forbidden');

            var user = {
                id: req.user.id,
                email: req.user.email,
                verified: req.user.verified,
                admin: req.user.admin
            };

            res.status(200).send({user: user});
        });

    // Tokens belonging to current user

    router.route('/tokens')
        .get(function(req, res, next) {
            if(!req.user.id) return next({status: 403, message: 'Forbidden', error: 'User is not logged in'});

            query('SELECT * FROM usertoken WHERE user_id = ?', [req.user.id], function(err, results, fields) {
                if(err) return next(err);

                res.status(200).send({results: results, fields: fields});
            });
        });

    router.route('/tokens/:tokenId')
        .get(function(req, res, next) {
            if(!req.user.id) return next({status: 403, message: 'Forbidden', error: 'User is not logged in'});

            query('SELECT * FROM usertoken WHERE user_id = ? AND id = ?', [req.user.id, req.params.tokenId], function(err, results, fields) {
                if(err) return next(err);

                if(!results[0]) return next({status: 404, message: 'Not Found', error: 'The requested object was not found.'});

                res.status(200).send({result: results[0], fields: fields});
            })
        })
        .delete(function(req, res, next) {
            if(!req.user.id) return next({status: 403, message: 'Forbidden', error: 'User is not logged in'});

            query('DELETE FROM usertoken WHERE user_id = ? AND id = ?', [req.user.id, req.params.tokenId], function(err, result) {
                if(err) return next(err);

                res.status(200).send();
            });
        });

    // Logging in

    router.route('/login/password')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.email = req.body.email;
            insert.password = req.body.password;

            async.series([
                function(callback) {
                    query('SELECT id,password FROM user WHERE email = ? AND deleted IS NULL', [insert.email], function(err, result) {
                        if(err) return callback(err);

                        if(result.length === 0) return callback({message: 'Missing Email'});

                        user.id = result[0].id;
                        user.password = result[0].password;

                        callback();
                    });
                },
                function(callback) {
                    onion.decrypt(insert.password, user.password, function(err, result) {
                        if(err) return callback(err);

                        if(!result) return callback({message: 'Wrong Password'});

                        callback();
                    });
                },
                function(callback) {
                    users.token(req, user.id, function(err, result) {
                        if(err) return callback(err);

                        user.token = result;

                        callback();
                    });
                }
            ], function(err) {
                if(err) return next(err);

                res.status(200).send({id: user.id, token: user.token});
            });
        });

    router.route('/login/email')
        .post(function(req, res, next) {
            var insert = {};

            insert.email = req.body.email;

            insert.login = {};
            insert.login.secret = hasher(128);
            insert.login.timeout = moment().add(nconf.get('timeouts:users:login:amount'), nconf.get('timeouts:users:login:time')).format("YYYY-MM-DD HH:mm:ss");

            async.series([
                function(callback) {
                    query('UPDATE user SET login_secret = ?, login_timeout = ? WHERE email = ? AND deleted IS NULL', [insert.login.secret, insert.login.timeout, insert.email], callback);
                },
                function(callback) {
                    var subject = 'User Verification';
                    var text =
                        '<b>Hello!</b>' +
                        '<br/>' +
                        'Use the following verification code to login to your account: <a href="' + nconf.get('links:base') + nconf.get('links:users:login') + insert.login.secret + '">' + insert.login.secret + '</a>' +
                        '<br/>'
                    ;

                    mailer(insert.email, subject, text, callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    router.route('/login/verify')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.secret = req.body.secret;

            async.series([
                function(callback) {
                    query('SELECT id, login_timeout AS timeout FROM user WHERE login_secret = ?', [insert.secret], function(err, result) {
                        if(err) return callback(err);

                        if(!result[0]) return callback('Wrong Secret.');

                        user.id = result[0].id;
                        user.timeout = result[0].timeout;

                        callback();
                    });
                },
                function(callback) {
                    if(moment(user.timeout).isBefore(moment())) return callback('Timeout Expired.');

                    callback();
                },
                function(callback) {
                    query('UPDATE user SET login_secret = NULL, login_timeout = NULL WHERE id = ?', [user.id], callback);
                },
                function(callback) {
                    users.token(req, user.id, function(err, result) {
                        if(err) return callback(err);

                        user.token = result;

                        callback();
                    });
                },
                function(callback) {
                    query('UPDATE user SET login_secret = NULL, login_timeout = NULL WHERE id = ?', [user.id], callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(200).send({id: user.id, token: user.token});
            });
        });

    // Verifying user

    router.route('/verify/email')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.email = req.body.email;

            insert.verify = {};
            insert.verify.secret = hasher(128);
            insert.verify.timeout = moment().add(nconf.get('timeouts:users:verify:amount'), nconf.get('timeouts:users:verify:time')).format("YYYY-MM-DD HH:mm:ss");

            async.series([
                function(callback) {
                    query('UPDATE user SET verify_secret = ?, verify_timeout = ? WHERE email = ?', [insert.verify.secret, insert.verify.timeout, insert.email], callback);
                },
                function(callback) {
                    var subject = 'User Verification';
                    var text =
                        '<b>Hello!</b>' +
                        '<br/>' +
                        'Use the following verification code to verify your account creation: <a href="' + nconf.get('links:base') + nconf.get('links:users:create') + insert.verify.secret + '">' + insert.verify.secret + '</a>' +
                        '<br/>'
                    ;

                    mailer(insert.email, subject, text, callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    router.route('/verify/verify')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.secret = req.body.secret;
            insert.displayname = req.body.displayname;
            insert.firstname = req.body.firstname;
            insert.surname = req.body.surname;
            insert.password = req.body.password;
            insert.timeout = moment().format("YYYY-MM-DD HH:mm:ss");

            async.series([
                function(callback) {
                    query('SELECT id, verify_timeout AS timeout FROM user WHERE verify_secret = ?', [insert.secret], function(err, result) {
                        if(err) return callback(err);

                        if(!result[0]) return callback('Wrong Secret.');

                        user.id = result[0].id;
                        user.timeout = result[0].timeout;

                        callback();
                    });
                },
                function(callback) {
                    if(moment(user.timeout).isBefore(moment())) return callback('Timeout Expired.');

                    callback();
                },
                function(callback) {
                    onion.encrypt(insert.password, function(err, result) {
                        if(err) return callback(err);

                        insert.encrypted = result;

                        callback();
                    });
                },
                function(callback) {
                    query('UPDATE user SET password = ?, displayname = ?, firstname = ?, surname = ?, verified = 1, verify_secret = NULL, verify_timeout = NULL WHERE id = ?', [insert.encrypted, insert.displayname, insert.firstname, insert.surname, user.id], callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    // Changing email

    router.route('/email/email')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.email = req.body.email;

            insert.reset = {};
            insert.reset.secret = hasher(128);
            insert.reset.timeout = moment().add(nconf.get('timeouts:users:email:amount'), nconf.get('timeouts:users:email:time')).format("YYYY-MM-DD HH:mm:ss");

            async.series([
                function(callback) {
                    query('UPDATE user SET reset_secret = ?, reset_timeout = ? WHERE email = ? AND deleted IS NULL', [insert.reset.secret, insert.reset.timeout, insert.email], callback);
                },
                function(callback) {
                    var subject = 'Email Change';
                    var text =
                        '<b>Hello!</b>' +
                        '<br/>' +
                        'Use the following verification code to change your email: <a href="' + nconf.get('links:base') + nconf.get('links:users:email') + insert.reset.secret + '">' + insert.reset.secret + '</a>' +
                        '<br/>'
                    ;

                    mailer(insert.email, subject, text, callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    router.route('/email/verify')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.secret = req.body.secret;
            insert.email = req.body.email;

            async.series([
                function(callback) {
                    query('SELECT id, reset_timeout AS timeout FROM user WHERE reset_secret = ?', [insert.secret], function(err, result) {
                        if(err) return callback(err);

                        if(!result[0]) return callback('Wrong Secret.');

                        user.id = result[0].id;
                        user.timeout = result[0].timeout;

                        callback();
                    });
                },
                function(callback) {
                    if(moment(user.timeout).isBefore(moment())) return callback('Timeout Expired.');

                    callback();
                },
                function(callback) {
                    query('UPDATE user SET email = ?, reset_secret = NULL, reset_timeout = NULL WHERE id = ?', [insert.email, user.id], callback);
                },
                function(callback) {
                    users.token(req, user.id, function(err, result) {
                        if(err) return callback(err);

                        user.token = result;

                        callback();
                    });
                }
            ], function(err) {
                if(err) return next(err);

                res.status(200).send({id: user.id, token: user.token});
            });
        });

    // Changing password

    router.route('/password/email')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.email = req.body.email;

            insert.reset = {};
            insert.reset.secret = hasher(128);
            insert.reset.timeout = moment().add(nconf.get('timeouts:users:password:amount'), nconf.get('timeouts:users:password:time')).format("YYYY-MM-DD HH:mm:ss");

            async.series([
                function(callback) {
                    query('UPDATE user SET reset_secret = ?, reset_timeout = ? WHERE email = ? AND deleted IS NULL', [insert.reset.secret, insert.reset.timeout, insert.email], callback);
                },
                function(callback) {
                    var subject = 'Password Reset';
                    var text =
                        '<b>Hello!</b>' +
                        '<br/>' +
                        'Use the following verification code to reset your password: <a href="' + nconf.get('links:base') + nconf.get('links:users:password') + insert.reset.secret + '">' + insert.reset.secret + '</a>' +
                        '<br/>'
                    ;

                    mailer(insert.email, subject, text, callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    router.route('/password/verify')
        .post(function(req, res, next) {
            var user = {},
                insert = {};

            insert.secret = req.body.secret;
            insert.password = req.body.password;

            async.series([
                function(callback) {
                    query('SELECT id, reset_timeout AS timeout FROM user WHERE reset_secret = ?', [insert.secret], function(err, result) {
                        if(err) return callback(err);

                        if(!result[0]) return callback('Wrong Secret.');

                        user.id = result[0].id;
                        user.timeout = result[0].timeout;

                        callback();
                    });
                },
                function(callback) {
                    if(moment(user.timeout).isBefore(moment())) return callback('Timeout Expired.');

                    callback();
                },
                function(callback) {
                    onion.encrypt(insert.password, function(err, result) {
                        if(err) return callback(err);

                        insert.encrypted = result;

                        callback();
                    });
                },
                function(callback) {
                    query('UPDATE user SET password = ?, reset_secret = NULL, reset_timeout = NULL WHERE id = ?', [insert.encrypted, user.id], callback);
                }
            ], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    // User specific

    router.route('/:id')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NULL AND id = ?';

            sequel.get(req, res, next, call, [req.params.id], true);
        })
        .put(function(req, res, next) {
            var insert = {};

            insert.id = parseInt(req.params.id);
            insert.displayname = req.body.displayname;
            insert.firstname = req.body.firstname;
            insert.surname = req.body.surname;

            if(!req.user.token) return next({status: 403, message: 'Forbidden', error: 'User is not logged in'});

            if(!req.user.admin && req.user.id !== insert.id) return next({status: 403, message: 'Forbidden', error: 'User is not administrator and may not edit other users'});

            query('UPDATE user SET displayname = ?, firstname = ?, surname = ? WHERE id = ?', [insert.displayname, insert.firstname, insert.surname, insert.id], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        })
        .delete(function(req, res, next) {
            var insert = {};

            insert.id = req.params.id;

            if(!req.user.admin && req.user.id !== insert.id) return next({status: 403, message: 'Forbidden', error: 'User is not administrator and may not remove other users'});

            insert.email = 'DELETED {{' + insert.id + '}}';
            insert.displayname = 'DELETED {{' + insert.id + '}}';
            insert.password = hasher(128);

            var sql = 'UPDATE user SET email = ?, displayname = ?, password = ?, firstname = NULL, surname = NULL, deleted = CURRENT_TIMESTAMP WHERE id = ?',
                array = [insert.email, insert.displayname, insert.password, insert.id];

            query(sql, array, function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    router.route('/:id/admin')
        .put(function(req, res, next) {
            if(!req.user.admin) return next({status: 403, message: 'Forbidden.', error: 'User is not administrator'});

            var insert = {};

            insert.id = req.params.id;
            insert.admin = req.body.admin;

            query('UPDATE user SET admin = ? WHERE id = ?', [insert.admin, insert.id], function(err) {
                if(err) return next(err);

                res.status(204).send();
            });
        });

    // Relations

    users.relation(router, 'assetgroups', 'assetgroup');
    users.relation(router, 'assets', 'asset');
    users.relation(router, 'assettypes', 'assettype');
    users.relation(router, 'attributes', 'attribute');
    users.relation(router, 'augmentations', 'augmentation');
    users.relation(router, 'backgrounds', 'background');
    users.relation(router, 'bionics', 'bionic');
    users.relation(router, 'bodyparts', 'bodypart');
    users.relation(router, 'countries', 'country');
    users.relation(router, 'doctrines', 'doctrine');
    users.relation(router, 'expertises', 'expertise');
    users.relation(router, 'focuses', 'focus');
    users.relation(router, 'gifts', 'gift');
    users.relation(router, 'identities', 'identity');
    users.relation(router, 'imperfections', 'imperfection');
    users.relation(router, 'languages', 'language');
    users.relation(router, 'loyalties', 'loyalty');
    users.relation(router, 'manifestations', 'manifestation');
    users.relation(router, 'milestones', 'milestone');
    users.relation(router, 'natures', 'nature');
    users.relation(router, 'protection', 'protection');
    users.relation(router, 'skills', 'skill');
    users.relation(router, 'software', 'software');
    users.relation(router, 'species', 'species');
    users.relation(router, 'weaponmods', 'weaponmod');
    users.relation(router, 'weapons', 'weapon');
    users.relation(router, 'weapontypes', 'weapontype');
};