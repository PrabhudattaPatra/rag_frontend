const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Generate session thread_id
const threadId = 'thread_' + Math.random().toString(36).substr(2, 9);

function addMessage(text, role) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    if (text) {
        bubble.innerText = text;
    } else {
        // Typing indicator
        bubble.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    }
    
    msgDiv.appendChild(bubble);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    return bubble;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Add user message
    addMessage(text, 'user');
    userInput.value = '';

    // Add empty assistant message for streaming
    const aiBubble = addMessage('', 'assistant');

    try {
        // We use a relative path here so Vercel's proxy rewrite handles the routing securely
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: text,
                thread_id: threadId
            })
        });

        if (!response.ok) {
            aiBubble.innerText = "Error: Sorry, something went wrong with the server.";
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let aiText = "";
        let buffer = "";
        aiBubble.innerHTML = ''; // clear typing indicator

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // The last item might be an incomplete line, keep it in the buffer
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.trim() === '') continue;
                
                // Parse Server Sent Events format
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        aiText += data.text;
                        aiBubble.innerHTML = marked.parse(aiText);
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } catch (e) {
                        console.error("Error parsing chunk", e, line);
                    }
                }
            }
        }
    } catch (err) {
        console.error(err);
        aiBubble.innerText = "Error: Cannot reach server.";
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
