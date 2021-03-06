'use strict';

const routes = require('../../lib/routes/generic/routes');
const basic = require('../../lib/routes/generic/generic');

module.exports = (router) => {
    const tableName = 'attribute';

    const rootQuery = 'SELECT id, canon, name, icon, created FROM ' + tableName;

    const singleQuery = 'SELECT ' +
        'attribute.id, ' +
        'attribute.canon, ' +
        'attribute.name, ' +
        'attribute.description, ' +
        'attribute.icon, ' +
        'attribute.optional, ' +
        'attribute.minimum, ' +
        'attribute.maximum, ' +
        'attribute.created, ' +
        'attribute.updated, ' +
        'attributetype.id AS type_id, ' +
        'attributetype.name AS type_name, ' +
        'attribute_is_copy.copy_id, ' +
        'user.id AS user_id, ' +
        'user.displayname AS user_name ' +
        'FROM attribute ' +
        'LEFT JOIN attribute_is_copy ON attribute_is_copy.attribute_id = attribute.id ' +
        'LEFT JOIN attributetype ON attributetype.id = attribute.attributetype_id ' +
        'LEFT JOIN user ON user.id = attribute.user_id';

    routes.root(router, tableName, rootQuery);
    routes.insert(router, tableName);
    routes.removed(router, tableName, rootQuery);
    routes.schema(router, tableName);

    router.route('/type/:id')
        .get(async (req, res, next) => {
            let call = rootQuery + ' WHERE deleted IS NULL AND ' +
                'attributetype_id = ?';

            await basic.select(req, res, next, call, [req.params.id]);
        });

    routes.single(router, tableName, singleQuery);
    routes.update(router, tableName);

    routes.automatic(router, tableName);
};
