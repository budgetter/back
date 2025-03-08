const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
    id:{
        type: DataTypes.UUID,
        primaryKey:true,
        defaultValue:DataTypes.UUIDV4,
        allowNull:false,
    },
    amount:{
        type:DataTypes.DECIMAL(10,2),
        allowNull:false,
    },
    description:{
        type: DataTypes.STRING,

    },
    proofImage:{
        type: DataTypes.STRING,
    }
});

module.exports = Transaction;