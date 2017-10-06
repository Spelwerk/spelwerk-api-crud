var async = require('async'),
    _ = require('underscore'),
    chai = require('chai'),
    validator = require('validator');

var should = chai.should(),
    assert = chai.assert,
    expect = chai.expect;

var app = require('../app'),
    verifier = require('../verifier'),
    hasher = require('../../lib/hasher');

describe('/backgrounds', function() {

    var baseRoute = '/backgrounds';

    var temporaryId;

    before(function(done) {
        app.login(done);
    });

    var manifestationId;
    before(function(done) {
        app.get('/manifestations')
            .expect(200)
            .end(function(err, res) {
                if(err) return done(err);

                manifestationId = res.body.results[0].id;

                done();
            });
    });

    var speciesId;
    before(function(done) {
        app.get('/species')
            .expect(200)
            .end(function(err, res) {
                if(err) return done(err);

                speciesId = res.body.results[0].id;

                done();
            });
    });

    function verifyList(body) {
        assert.isNumber(body.length);

        assert.isArray(body.results);
        assert.lengthOf(body.results, body.length);

        if(body.length > 0) {
            _.each(body.results, function(item) {
                verifyItem(item);
            });
        }

        assert.isObject(body.fields);
    }

    function verifyItem(item) {
        verifier.generic(item);

        if(item.manifestation_id) assert.isNumber(item.manifestation_id);
        if(item.species_id) assert.isNumber(item.species_id);
    }


    describe('POST', function() {

        it('/ should create a new item', function(done) {
            var payload = {
                name: hasher(20),
                description: hasher(20),
                icon: 'http://fakeicon.com/' + hasher(20) + '.png',
                manifestation_id: manifestationId,
                species_id: speciesId
            };

            app.post(baseRoute, payload)
                .expect(201)
                .end(function(err, res) {
                    if(err) return done(err);

                    assert.isNumber(res.body.id);

                    temporaryId = res.body.id;

                    done();
                });
        });

        it('/:id/clone should create a copy', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/clone')
                .expect(201)
                .end(function(err, res) {
                    if(err) return done(err);

                    assert.isNumber(res.body.id);

                    done();
                });
        });

        it('/:id/comments should create a new comment', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/comments', { comment: hasher(20) })
                .expect(201)
                .end(function(err, res) {
                    if(err) return done(err);

                    assert.isNumber(res.body.id);

                    done();
                });
        });

    });

    describe('PUT', function() {

        it('/:id should update the item with new values', function(done) {
            var payload = {
                name: hasher(20),
                description: hasher(20)
            };

            app.put(baseRoute + '/' + temporaryId, payload)
                .expect(204)
                .end(done);
        });

        it('/:id/canon/:canon should update the canon status', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/canon/1')
                .expect(204)
                .end(done);
        });

    });

    describe('GET', function() {

        it('/ should return a list', function(done) {
            app.get(baseRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    verifyList(res.body);

                    done();
                });
        });

        it('/deleted should return a list of deleted items', function(done) {
            app.get(baseRoute + '/deleted')
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    verifyList(res.body);

                    done();
                });
        });

        it('/manifestation/:manifestationId should return a list', function(done) {
            app.get('/backgrounds/manifestation/' + manifestationId)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    verifyList(res.body);

                    done();
                });
        });

        it('/species/:speciesId should return a list', function(done) {
            app.get('/backgrounds/species/' + speciesId)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    verifyList(res.body);

                    done();
                });
        });

        it('/:id should return one item', function(done) {
            app.get(baseRoute + '/' + temporaryId)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    verifyItem(res.body.result);

                    done();
                })
        });

        it('/:id/ownership should return ownership status', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/ownership').expect(200).end(function(err, res) { verifier.ownership(err, res, done); });
        });

        it('/:id/comments should get all available comments', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/comments').expect(200).end(function(err, res) { verifier.comments(err, res, done); });
        });

    });

    describe('/assets', function() {
        var relationRoute = 'assets',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId, value: 2}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

    describe('/attributes', function() {
        var relationRoute = 'attributes',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId, value: 2}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

    describe('/bionics', function() {
        var relationRoute = 'bionics',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

    describe('/doctrines', function() {
        var relationRoute = 'doctrines',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId, value: 2}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

    describe('/skills', function() {
        var relationRoute = 'skills',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId, value: 2}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

    describe('/weapons', function() {
        var relationRoute = 'weapons',
            relationId;

        before(function(done) {
            app.get('/' + relationRoute)
                .expect(200)
                .end(function(err, res) {
                    if(err) return done(err);

                    var length = res.body.length - 1;
                    relationId = res.body.results[length].id;

                    done();
                });
        });

        it('POST / should add an item', function(done) {
            app.post(baseRoute + '/' + temporaryId + '/' + relationRoute, {insert_id: relationId}).expect(201).end(done);
        });

        it('PUT /:id should change the value of the item', function(done) {
            app.put(baseRoute + '/' + temporaryId + '/' + relationRoute + '/' + relationId, {value: 4}).expect(204).end(done);
        });

        it('GET / should get a list of items', function(done) {
            app.get(baseRoute + '/' + temporaryId + '/' + relationRoute).expect(200).end(function(err, res) { verifier.relations(err, res, done); });
        });

    });

});