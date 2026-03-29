# ⚡ P2P Messenger

End-to-end encrypted, peer-to-peer cross-device messenger with QR code pairing.

## How It Works

```
┌──────────┐    QR Code     ┌──────────┐
│    PC    │──────────────→│  Mobile  │
│ (Browser)│               │ (Browser)│
└────┬─────┘               └────┬─────┘
     │    Signaling Server       │
     │◄─────── WebSocket ───────►│
     │   (only for handshake)    │
     │                           │
     │◄══════ WebRTC P2P ══════►│
     │  (direct encrypted data)  │
     │   Text, Files, Audio      │
     └───────────────────────────┘
```

1. **PC** opens the app → generates a room → shows QR code
2. **Mobile** scans the QR code → joins the room via signaling server
3. Both devices exchange ECDH public keys → derive shared AES-256-GCM key
4. WebRTC data channel established → **all data flows directly between devices**
5. The signaling server is only used for the initial handshake. It never sees your messages.

## Security

- **ECDH P-256** key exchange (Elliptic Curve Diffie-Hellman)
- **AES-256-GCM** encryption for all messages, files, and audio
- **WebRTC DTLS** transport encryption
- Keys are generated fresh per session — no key reuse
- The server **never** sees your data. It only relays WebRTC signaling.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` on your **PC**.

The server will also print your LAN IP (e.g., `http://192.168.1.x:3000`). 
The QR code will contain this URL so your phone can connect over the local network.

## Features

- 📱 **QR Code Pairing** — Scan to connect instantly
- 💬 **Text Messages** — Send unlimited length messages
- 📎 **File Transfer** — Send any file type, any size (chunked transfer with progress)
- 🎙️ **Voice Messages** — Hold to record, auto-sends when released
- 🖼️ **Image Preview** — Images display inline with download option
- 🔒 **E2E Encryption** — AES-256-GCM, keys never leave your device
- ⚡ **P2P Direct** — Data flows between devices, not through a server
- 📂 **Drag & Drop** — Drop files onto the chat to send

## Architecture

```
p2p-messenger/
├── server.js          # Signaling server (Socket.io + Express)
├── public/
│   └── index.html     # Complete client app (single file)
├── package.json
└── README.md
```

### Why Single File Client?

The entire client is a single HTML file with no build step. This means:
- Zero build tools needed
- Works on any device with a browser
- Easy to audit — all code is right there
- CDN-loaded dependencies (Socket.io, QRCode, jsQR)

## Network Requirements

Both devices must be on the **same local network** for P2P to work without a TURN server.
If you need cross-network support, add a TURN server to the ICE configuration.

## HTTPS for Mobile Camera

Mobile browsers require HTTPS for camera access (QR scanning).
For local development, you can use:

```bash
# Option 1: Use ngrok
npx ngrok http 3000

# Option 2: Generate self-signed cert and modify server.js to use HTTPS
```

Or use the **manual room code** input on mobile instead of camera scanning.

## License

MIT
