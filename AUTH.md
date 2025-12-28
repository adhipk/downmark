# Passkey Authentication

This app supports secure, passwordless authentication using **Passkeys (WebAuthn)**.

## Features

- **No passwords** - Use your fingerprint, face, or device PIN
- **Phishing-resistant** - Cryptographic authentication bound to your domain
- **No tokens to manage** - Sessions use HttpOnly cookies, no JWT to store
- **No secrets stored** - Server only stores public keys

## How It Works

1. **Registration**: Create an account with your username, then create a passkey on your device
2. **Login**: Sign in by selecting your username and authenticating with your device
3. **Session**: After authentication, you get a 7-day session cookie

## Setup

### 1. Enable Authentication

In your `.env` file:

```bash
AUTH_ENABLED=true
```

### 2. Configure for Your Domain

For **localhost** (development):

```bash
RP_ID=localhost
ORIGIN=http://localhost:3000
RP_NAME=HTML to Markdown Converter
```

For **production** (replace with your domain):

```bash
RP_ID=yourdomain.com
ORIGIN=https://yourdomain.com
RP_NAME=HTML to Markdown Converter
```

**Important**:
- `RP_ID` must match your domain (without protocol)
- `ORIGIN` must match your full URL (with protocol)
- Passkeys created on `localhost` won't work on production and vice versa

### 3. Restart the Server

```bash
bun run dev
```

## Usage

### First Time

1. Visit the app - you'll see the login screen
2. Enter a username
3. Click "Create Passkey"
4. Your device will prompt you to create a passkey (fingerprint, face, or PIN)
5. You're logged in!

### Subsequent Logins

1. Enter your username
2. Click "Sign In with Passkey"
3. Authenticate with your device
4. You're logged in!

## Security Notes

### What's Stored

- **Server**: Public keys only (safe to expose)
- **Client**: Session cookie (HttpOnly, SameSite=Lax, 7-day expiry)
- **Device**: Private key (in secure hardware, never leaves device)

### Current Limitations

- **In-memory storage**: Users and sessions are stored in RAM and lost on restart
- **For production**: Replace in-memory storage with a database (PostgreSQL, SQLite, etc.)

## Migrating to Production

To use this in production, you'll need to:

1. **Replace in-memory storage** in `src/auth.ts`:
   - Store users in a database
   - Store sessions in Redis or a database

2. **Use HTTPS**:
   - Passkeys require HTTPS in production
   - `localhost` works for development without HTTPS

3. **Update environment variables**:
   - Set `RP_ID` to your domain
   - Set `ORIGIN` to your HTTPS URL

## Disable Authentication

To disable authentication and make the app public:

```bash
AUTH_ENABLED=false
```

Or remove the variable entirely. The app will work without authentication.

## Troubleshooting

### "User not found" on login
- Make sure you registered first
- Passkeys are tied to the domain (localhost vs production)

### "Registration failed"
- Check your browser supports WebAuthn (most modern browsers do)
- Ensure you're on HTTPS (or localhost for dev)

### "Authentication verification failed"
- Your passkey might be from a different domain
- Try registering again

## Browser Support

Passkeys work on:
- Chrome/Edge 67+
- Firefox 60+
- Safari 13+
- All modern mobile browsers

## API Endpoints

- `POST /auth/register/start` - Start passkey registration
- `POST /auth/register/finish` - Complete passkey registration
- `POST /auth/login/start` - Start passkey authentication
- `POST /auth/login/finish` - Complete passkey authentication
- `POST /auth/logout` - Log out (clear session)
- `GET /auth/status` - Check authentication status
