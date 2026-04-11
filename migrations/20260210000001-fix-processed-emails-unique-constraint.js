'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Fetch existing indexes on ProcessedEmails
        const indexes = await queryInterface.showIndex('ProcessedEmails');

        // 1. Drop any single-column unique index on messageId alone
        //    (should not exist if original migration ran correctly, but this is a safety net)
        for (const index of indexes) {
            const columnNames = Array.isArray(index.fields)
                ? index.fields.map(f => (typeof f === 'string' ? f : f.attribute || f.name))
                : [];

            const isSingleMessageId =
                index.unique &&
                columnNames.length === 1 &&
                columnNames[0] === 'messageId';

            if (isSingleMessageId) {
                await queryInterface.removeIndex('ProcessedEmails', index.name);
            }
        }

        // 2. Ensure composite unique index on (integrationId, messageId) exists
        const refreshedIndexes = await queryInterface.showIndex('ProcessedEmails');
        const hasCompositeUnique = refreshedIndexes.some(index => {
            const cols = Array.isArray(index.fields)
                ? index.fields.map(f => (typeof f === 'string' ? f : f.attribute || f.name))
                : [];
            return (
                index.unique &&
                cols.length === 2 &&
                cols.includes('integrationId') &&
                cols.includes('messageId')
            );
        });

        if (!hasCompositeUnique) {
            await queryInterface.addIndex('ProcessedEmails', ['integrationId', 'messageId'], {
                unique: true,
                name: 'unique_processed_email'
            });
        }
    },

    down: async (queryInterface, Sequelize) => {
        // Reverse: remove composite unique and add back single-column unique on messageId
        const indexes = await queryInterface.showIndex('ProcessedEmails');
        const compositeIndex = indexes.find(index => {
            const cols = Array.isArray(index.fields)
                ? index.fields.map(f => (typeof f === 'string' ? f : f.attribute || f.name))
                : [];
            return (
                index.unique &&
                cols.length === 2 &&
                cols.includes('integrationId') &&
                cols.includes('messageId')
            );
        });

        if (compositeIndex) {
            await queryInterface.removeIndex('ProcessedEmails', compositeIndex.name);
        }

        // Re-add single-column unique on messageId
        await queryInterface.addIndex('ProcessedEmails', ['messageId'], {
            unique: true,
            name: 'unique_message_id'
        });
    }
};
