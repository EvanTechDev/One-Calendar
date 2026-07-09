---
title: Sharing
weight: 5
---

Share calendar events securely with end-to-end encryption.

## How Sharing Works

1. Select an event and click the share action
2. Optionally set a password for additional protection
3. A unique share link is generated
4. Share the link with anyone

## Encryption

All shared data is encrypted using **AES-256-GCM**:

- **Unprotected shares**: Encryption key derived from the share ID using SHA-256
- **Password-protected shares**: Encryption key derived from the password using scrypt key derivation
- Data is encrypted before sending to the server
- The server never has access to plaintext data

## Share Options

### Burn After Read

Shares that are automatically deleted after being viewed once. Perfect for sensitive information.

### Password Protection

Require a password to view the shared event. The password is used to derive the encryption key.

### Protected vs Unprotected

- **Protected**: Shows "protected" metadata; requires password to decrypt
- **Unprotected**: Anyone with the link can view the event

## Share Management

View and manage all your shared events from Settings:

- See list of all active shares
- View share links
- Delete shares you no longer need
- Protected shares show as "protected" in the list

## API Endpoints

- **POST /api/share** - Create a new share
- **GET /api/share?id=xxx** - Retrieve a share
- **DELETE /api/share** - Delete a share
- **GET /api/share/list** - List all shares for the authenticated user
