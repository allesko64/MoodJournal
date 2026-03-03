class AITherapist {
    constructor() {
        // Multi-turn chat history: { role: 'user' | 'model', parts: [{ text }] }
        this.chatHistory = [];

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const sendButton = document.getElementById('send-message');
        const userInput = document.getElementById('user-input');

        sendButton.addEventListener('click', () => this.handleUserMessage());

        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserMessage();
            }
        });

        document.querySelectorAll('.topic-btn').forEach(button => {
            button.addEventListener('click', () => {
                userInput.value = button.textContent;
                this.handleUserMessage();
            });
        });

        const discussBtn = document.getElementById('discuss-journal-btn');
        if (discussBtn) {
            discussBtn.addEventListener('click', () => this.discussLatestEntry(discussBtn));
        }
    }

    async discussLatestEntry(btn) {
        btn.disabled = true;
        btn.textContent = 'Loading...';

        try {
            const journals = await ApiClient.get('/api/journals');
            const entries = journals.entries || [];
            if (!entries.length) {
                this.addMessageToChat("You don't have any journal entries yet. Write one first!", 'ai');
                btn.textContent = '📓 Discuss Latest Journal Entry';
                btn.disabled = false;
                return;
            }

            const latest = entries[0];
            let insightsData = null;
            try {
                insightsData = await ApiClient.get(`/api/journal/${latest.id}/insights`);
            } catch (_) { /* insights may not be available */ }

            const title = latest.title || 'Untitled';
            const snippet = (latest.content || '').substring(0, 120);
            const insights = (insightsData && insightsData.insights) || '';

            let contextMsg = `I'd like to discuss my recent journal entry titled "${title}".`;
            if (snippet) contextMsg += ` Here's a bit of what I wrote: "${snippet}"`;
            if (insights) contextMsg += `\n\nThe AI insights for this entry were:\n${insights}`;

            document.getElementById('user-input').value = '';
            this.addMessageToChat(contextMsg, 'user');
            this.chatHistory.push({ role: 'user', parts: [{ text: contextMsg }] });

            const typingId = this.showTypingIndicator();
            const reply = await this.getAIResponse();
            this.removeTypingIndicator(typingId);
            this.addMessageToChat(reply, 'ai');
            this.chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        } catch (error) {
            console.error('Error discussing journal entry:', error);
            this.addMessageToChat(
                "I couldn't load your journal entries right now. Please make sure the backend is running.",
                'ai'
            );
        }

        btn.textContent = '📓 Discuss Latest Journal Entry';
        btn.disabled = false;
    }

    async handleUserMessage() {
        const userInput = document.getElementById('user-input');
        const message = userInput.value.trim();

        if (!message) return;

        this.addMessageToChat(message, 'user');
        userInput.value = '';

        // Add user turn to history
        this.chatHistory.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const typingId = this.showTypingIndicator();

        try {
            const reply = await this.getAIResponse();
            this.removeTypingIndicator(typingId);
            this.addMessageToChat(reply, 'ai');

            // Add AI turn to history
            this.chatHistory.push({
                role: 'model',
                parts: [{ text: reply }]
            });
        } catch (error) {
            this.removeTypingIndicator(typingId);
            console.error('Error getting AI response:', error);
            this.addMessageToChat(
                "I'm sorry, I'm having a little trouble right now. Please make sure the backend server is running and try again.",
                'ai'
            );
        }
    }

    async getAIResponse() {
        // POST the full chat history to our FastAPI backend proxy via shared ApiClient
        const data = await ApiClient.postJson('/api/chat', { history: this.chatHistory });
        return data.reply;
    }

    showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const chatMessages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'message ai-message';
        div.id = id;
        div.innerHTML = `<div class="message-content typing-dots"><span></span><span></span><span></span></div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    }

    removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    addMessageToChat(message, sender) {
        const chatMessages = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        const escaped = message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\n/g, "<br>");

        messageDiv.innerHTML = `<div class="message-content">${escaped}</div>`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AITherapist();
});
