## Project 

This is the proxy service to forward requests to OpenCode server. Created using Hono and Bun.

## Future Plans

- Add support for better auth
    - Add Google OAuth support
    - Ability to generate API keys
    - Auth Middleware to validate API Keys before forwarding requests to opencode service.
    - Log model request against the API key
- Add sentry error tracking
