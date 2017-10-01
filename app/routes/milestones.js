'use strict';

var generic = require('../../lib/helper/generic'),
    relations = require('../../lib/helper/relations');

var sequel = require('../../lib/sql/sequel');

var milestones = require('../../lib/tables/milestones');

module.exports = function(router) {
    var tableName = 'milestone';

    var sql = 'SELECT * FROM ' + tableName + ' ' +
        'LEFT JOIN ' + tableName + '_is_copy ON ' + tableName + '_is_copy.' + tableName + '_id = ' + tableName + '.id ' +
        'LEFT JOIN ' + tableName + '_is_manifestation ON ' + tableName + '_is_manifestation.' + tableName + '_id = ' + tableName + '.id ' +
        'LEFT JOIN ' + tableName + '_is_species ON ' + tableName + '_is_species.' + tableName + '_id = ' + tableName + '.id';

    router.route('/')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NULL';

            sequel.get(req, res, next, call);
        })
        .post(function(req, res, next) {
            var name = req.body.name,
                description = req.body.description,
                backgroundId = req.body.background_id,
                manifestationId = req.body.manifestation_id,
                speciesId = req.body.species_id;

            milestones(req.user, name, description, backgroundId, manifestationId, speciesId, function(err, id) {
                if(err) return next(err);

                res.status(201).send({id: id});
            })
        });

    router.route('/deleted')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NOT NULL';

            sequel.get(req, res, next, call);
        });

    // Background

    router.route('/background/:backgroundId')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NULL AND ' +
                'background_id = ?';

            sequel.get(req, res, next, call, [req.params.backgroundId]);
        });

    // Manifestation

    router.route('/manifestation/:manifestationId')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NULL AND ' +
                'manifestation_id = ?';

            sequel.get(req, res, next, call, [req.params.manifestationId]);
        });

    // Species

    router.route('/species/:speciesId')
        .get(function(req, res, next) {
            var call = sql + ' WHERE deleted IS NULL AND ' +
                'species_id = ?';

            sequel.get(req, res, next, call, [req.params.speciesId]);
        });

    // ID

    generic.id(router, sql, tableName, false, true);
    generic.canon(router, tableName);
    generic.clone(router, tableName);
    generic.comments(router, tableName);
    generic.labels(router, tableName);
    generic.ownership(router, tableName);
    generic.revive(router, tableName);

    // Relations

    relations(router, tableName, 'assets', 'asset');
    relations(router, tableName, 'attributes', 'attribute');
    relations(router, tableName, 'bionics', 'bionic');
    relations(router, tableName, 'doctrines', 'doctrine');
    relations(router, tableName, 'loyalties', 'loyalty');
    relations(router, tableName, 'skills', 'skill');
    relations(router, tableName, 'weapons', 'weapon');
};
