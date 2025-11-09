## Project 

This is the proxy service to forward requests to OpenCode server. Created using Hono and Bun.

## Route Structure

- /opencode/:apiKey/* -> Proxy all requests to OpenCode server
- /p8n/* -> All future api requests will be under /p8n which are not part of opencode.

## Future Plans

- Add support for better auth
    - Add Google OAuth support
    - Ability to generate API keys
    - Auth Middleware to validate API Keys before forwarding requests to opencode service.
    - Log model request against the API key
- Add sentry error tracking
