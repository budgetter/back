// Docker-only entrypoint: back/app.js and back/server.js just export the
// Express app for Netlify Functions and never call .listen(). This wraps
// app.js (the production entry point) so it can run as a standalone
// container process.
require('dotenv').config();
const app = require('../app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Budgetter API listening on port ${PORT}`);
});
