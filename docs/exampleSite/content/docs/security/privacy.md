---
title: Privacy & Security
weight: 1
---

One Calendar is built with privacy and security as core principles.

## Privacy First

- **No AI tracking**: No behavioral profiling or data mining
- **No analytics by default**: Zero third-party tracking scripts
- **Local-first**: Data stored in encrypted local storage by default
- **User-controlled exports**: Backup and portability without lock-in

## Encryption

### Local Storage

All calendar data stored in the browser is encrypted using AES encryption with the configured `SALT`.

### Share Encryption

Shared data uses **AES-256-GCM** encryption:

| Version          | Method                                         |
| ---------------- | ---------------------------------------------- |
| v2 (unprotected) | SHA-256 key derivation from share ID           |
| v3 (password)    | scrypt key derivation from password + share ID |

### Cloud Backups

Backup data is encrypted client-side before transmission. The server stores only ciphertext.

## Data Processing Location

All personal data is processed and stored on servers located in **Sweden**, within the European Economic Area (EEA), ensuring GDPR compliance.

## Authentication Security

- **bcrypt password hashing** with cost factor 10
- **Two-factor authentication** (TOTP) support
- **Email verification** required by default
- **Sentinel protection**: Credential stuffing detection, compromised password alerts, bot blocking
- **Cloudflare Turnstile**: Privacy-first CAPTCHA

## Data Minimization

- Only minimal metadata (backup timestamps, sync status) is stored server-side
- Event content is never accessible to the server in plaintext
- Authentication data is limited to what is strictly necessary

## Self-Hosting

When self-hosting, you retain complete sovereignty over your data. The platform provides guidance on:

- Network segmentation and firewall hardening
- Database configuration best practices
- Cryptographic key management
- Granular access controls
- Regular security audits and monitoring

## Open Source

The entire codebase is open source under the MIT license, allowing for:

- Independent security audits
- Community code review
- Custom modifications and extensions
