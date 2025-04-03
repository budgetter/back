const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Budget API',
        version: '1.0.0',
        description: 'API documentation for the Budget application',
      },
      servers: [
        {
          url: 'http://localhost:3000/api',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
    apis: ['./routes/*.js'], // Path to the API docs
  };
  

const swaggerDocs = swaggerJsDoc(swaggerOptions);
module.exports = swaggerDocs;
