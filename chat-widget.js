// Real Estate Bot Chat Widget

class RealEstateChat {
  constructor() {
    this.ws = null;
    this.sessionKey = localStorage.getItem('realtor_session_key') || 'realtor-demo-' + Date.now();
    this.gatewayUrl = this.getGatewayUrl();
    this.chatMessages = [];
    this.isConnecting = false;
    this.isWaitingForInput = false;

    this.initElements();
    this.setupEventListeners();
  }

  getGatewayUrl() {
    // Check for custom gateway URL in query params
    const params = new URLSearchParams(window.location.search);
    if (params.has('gateway')) {
      return params.get('gateway');
    }
    // Default to localhost (change to your VPS IP for production)
    return 'ws://localhost:18789';
  }

  initElements() {
    this.chatWidget = document.getElementById('chat-widget');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.closeBtn = document.getElementById('close-chat');
    this.startBtn = document.getElementById('start-chat');
    this.overlay = document.getElementById('chat-overlay');
  }

  setupEventListeners() {
    this.startBtn.addEventListener('click', () => this.openChat());
    this.closeBtn.addEventListener('click', () => this.closeChat());
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  openChat() {
    this.chatWidget.classList.remove('hidden');
    this.overlay.classList.remove('hidden');
    this.chatInput.focus();
    this.connect();
  }

  closeChat() {
    this.chatWidget.classList.add('hidden');
    this.overlay.classList.add('hidden');
  }

  connect() {
    if (this.isConnecting || this.ws) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`${this.gatewayUrl}/ws`);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.addMessage('bot', 'Hi! I\'m here to help you find the perfect home in Albuquerque. What brings you here today?');
        this.isWaitingForInput = true;
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      };

      this.ws.onerror = (error) => {
        this.isConnecting = false;
        this.addMessage('bot', '❌ Connection error. Please try again.');
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
      };
    } catch (err) {
      this.isConnecting = false;
      this.addMessage('bot', '❌ Failed to connect. Make sure the gateway is running.');
    }
  }

  sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    this.addMessage('user', message);
    this.chatInput.value = '';
    this.chatInput.focus();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'chat.send',
        sessionKey: this.sessionKey,
        message: message,
      }));
    } else {
      this.addMessage('bot', 'Connection lost. Please refresh the page.');
      this.connect();
    }
  }

  handleMessage(data) {
    if (data.type === 'chat') {
      this.addMessage('bot', data.text);
      this.isWaitingForInput = true;
    } else if (data.type === 'error') {
      this.addMessage('bot', `Error: ${data.message}`);
    }
  }

  addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;

    messageDiv.appendChild(contentDiv);
    this.chatMessages.appendChild(messageDiv);

    // Auto-scroll to bottom
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
}

// Initialize chat on page load
document.addEventListener('DOMContentLoaded', () => {
  window.realestateChat = new RealEstateChat();
});
