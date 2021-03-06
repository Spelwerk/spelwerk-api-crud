'use strict';

const routes = require('../../lib/routes/generic/routes');

module.exports = (router) => {
    const tableName = 'assettype';

    const rootQuery = 'SELECT id, canon, name, icon, created FROM ' + tableName;

    const singleQuery = 'SELECT ' +
        'assettype.id, ' +
        'assettype.canon, ' +
        'assettype.name, ' +
        'assettype.icon, ' +
        'assettype.created, ' +
        'assettype.updated, ' +
        'assettype_is_copy.copy_id, ' +
        'user.id AS user_id, ' +
        'user.displayname AS user_name ' +
        'FROM assettype ' +
        'LEFT JOIN assettype_is_copy ON assettype_is_copy.assettype_id = assettype.id ' +
        'LEFT JOIN user ON user.id = assettype.user_id';

    routes.root(router, tableName, rootQuery);
    routes.insert(router, tableName);
    routes.removed(router, tableName, rootQuery);
    routes.schema(router, tableName);
    routes.single(router, tableName, singleQuery);
    routes.update(router, tableName);

    routes.automatic(router, tableName);
};
