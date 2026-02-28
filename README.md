# Real Estate Bot Landing Page

Beautiful, responsive landing page with embedded chatbot for real estate lead qualification.

## Features

✅ Clean, modern design
✅ Embedded chat widget
✅ Connects to OpenClaw Gateway
✅ Real-time lead qualification
✅ Auto-push to HubSpot
✅ Mobile responsive

## Setup

### 1. Push to GitHub

```bash
cd realtor-landing
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Champ24xxu/realtor-bot.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to your repo: https://github.com/Champ24xxu/realtor-bot
2. Settings → Pages
3. Source: Deploy from a branch
4. Branch: main
5. Save

Your page will be live at: `https://champ24xxu.github.io/realtor-bot`

### 3. Configure Gateway Connection

Edit `chat-widget.js` line 20:

```javascript
// Change from:
return 'ws://localhost:18789';

// To your VPS IP:
return 'ws://YOUR_VPS_IP:18789';
```

Or pass gateway URL in query param:
```
https://champ24xxu.github.io/realtor-bot?gateway=ws://YOUR_VPS_IP:18789
```

## Customization

### Change Colors

Edit `styles.css`:
```css
/* Current gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to your brand colors */
background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
```

### Change Realtor Name

Edit `index.html`:
```html
<h1>Find Your Dream Home</h1>
<!-- Change to -->
<h1>[Realtor Name]'s Home Finder</h1>
```

### Add Logo

Add to `index.html` in header:
```html
<img src="logo.png" alt="Logo" class="logo">
```

## How It Works

1. User visits landing page
2. Clicks "Start Now"
3. Chat widget opens
4. Bot asks 8 qualifying questions
5. Bot scores lead (hot/warm/cold)
6. Shows matched properties
7. Automatically pushes to HubSpot

## Gateway Requirements

- OpenClaw Gateway running on VPS
- WebSocket accessible from internet
- Real estate bot skill configured
- HubSpot API key set up

## Troubleshooting

**Chat won't connect:**
- Check gateway is running: `openclaw status`
- Verify WebSocket URL is correct
- Check firewall allows port 18789

**Messages not sending:**
- Check browser console for errors
- Verify session key is stored in localStorage
- Restart gateway: `openclaw gateway restart`

## Deploy Per Realtor

Create separate folders in the repo:

```
realtor-bot/
  ├── realtor-1/
  │   ├── index.html (customized)
  │   ├── styles.css
  │   └── chat-widget.js
  ├── realtor-2/
  │   ├── index.html (customized)
  │   ├── styles.css
  │   └── chat-widget.js
```

URLs:
- https://champ24xxu.github.io/realtor-bot/realtor-1
- https://champ24xxu.github.io/realtor-bot/realtor-2

Each realtor gets a personalized landing page!
