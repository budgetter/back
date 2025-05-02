# Backend Documentation for Budgetter Project

## Overview

This backend is built with Express.js and uses Sequelize ORM to connect to a MySQL database. It is deployed as serverless functions on Netlify using the `serverless-http` adapter.

## Architecture

- The Express app is modularized with routes and controllers.
- Sequelize manages database models and migrations.
- Authentication is handled via Passport.js with Google OAuth.
- The backend is deployed as a Netlify serverless function located in `back/functions/api.js`.
- The Express app is exported from `back/server.js` and wrapped by `serverless-http` in the function.

## Local Development

- Use `npm start` to run the backend locally with Netlify Dev.
- The backend listens on `/api/*` routes.
- Database connection is initialized once on startup.
- Use environment variables for configuration (e.g., database credentials, OAuth keys).

## Deployment

- The project uses a `netlify.toml` file to configure functions and redirects.
- Redirects from `/api/*` to `/.netlify/functions/api/*` are configured.
- The `functions` directory contains source serverless functions.
- The `functions-build` directory is generated during build and should be gitignored.
- Push your changes to GitHub; Netlify will build and deploy automatically.

## Important Notes

- Replace `bcrypt` with `bcryptjs` to avoid native module issues in serverless.
- Avoid double wrapping Express app with `serverless-http`.
- Mount routes under `/api` to match Netlify Dev rewrites.
- Initialize database connection once on startup to prevent timeouts.
- Add `functions-build/` to `.gitignore`.

## Useful Commands

- `npm start` - Run Netlify Dev locally.
- `npm run build` - Build functions and site for deployment.
- `git add . && git commit -m "message" && git push` - Commit and push changes.

## Troubleshooting

- If you get "Cannot find module 'bcrypt'", ensure you use `bcryptjs`.
- If routes return 404 on `/api/*`, check route prefixes in `server.js`.
- If functions timeout, check database connection initialization.

## Contact

For further assistance, please contact the development team.
