// 适用于移动端的聊天逻辑
const socket = io();

// 获取 DOM 元素
const form = document.getElementById('message-form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const fileInput = document.getElementById('file-input');
const emojiBtn = document.querySelector('.emoji-btn');
const emojiPanel = document.getElementById('emoji-panel');

// 添加调试日志
console.log('Mobile chat.js loaded');

// 记录是否已加载历史消息
let historyLoaded = false;

// Socket.IO 事件处理
socket.on('connect', () => {
    console.log('Socket connected');
    if (!historyLoaded) {
        requestHistoryMessages();
    }
});

socket.on('message', (data) => {
    console.log('Received message:', data);
    appendMessage(data);
});

// 添加重连逻辑
socket.on('disconnect', () => {
    console.log('Socket disconnected');
});

socket.on('reconnect', () => {
    console.log('Socket reconnected');
    // 重新加载历史消息
    requestHistoryMessages();
});

// 请求历史消息
function requestHistoryMessages() {
    console.log('Requesting history messages');
    messages.innerHTML = '';
    
    fetch('/mobile/load_history')
        .then(response => response.json())
        .then(historyMessages => {
            console.log('Received history messages:', historyMessages);
            if (Array.isArray(historyMessages)) {
                // 不需要排序，服务器已经排序好了
                historyMessages.forEach(msg => {
                    console.log('Processing history message:', msg); // 添加调试日志
                    appendMessage(msg);
                });
            }
            historyLoaded = true;
            messages.scrollTop = messages.scrollHeight;
        })
        .catch(error => {
            console.error('Error loading history:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.textContent = '加载历史消息失败，请刷新重试';
            messages.appendChild(errorDiv);
        });
}

// 添加消息到界面
function appendMessage(msgData) {
    console.log('Raw message data:', msgData);
    
    // 处理文件类型消息
    if (msgData.type === 'file') {
        const messageText = msgData.url.toLowerCase().endsWith('.mp4') ? 
            `[video]${msgData.url}[/video]` :
            msgData.url.match(/\.(jpg|jpeg|png|gif)$/i) ?
            `[image]${msgData.url}[/image]` :
            `[file]${msgData.url}[/file]`;
            
        msgData = {
            id: msgData.id,
            text: messageText,
            username: msgData.username,
            timestamp: msgData.timestamp,
            avatar_url: msgData.avatar_url
        };
    }
    
    // 确保消息格式一致
    const message = msgData;
    if (!message || typeof message.text === 'object') {
        message.text = message.text.text || '';
    }
    
    console.log('Processed message:', message);
    console.log('Message text:', message.text);
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.username === window.CHAT_CONFIG.currentUser.username ? 'message-own' : 'message-other'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // 处理不同类型的消息
    if (typeof message.text === 'string' && message.text.startsWith('[sticker]')) {
        // 处理贴纸消息
        const stickerUrl = message.text.replace('[sticker]', '').replace('[/sticker]', '');
        const img = document.createElement('img');
        img.src = stickerUrl;
        img.className = 'message-sticker';
        contentDiv.appendChild(img);
    } else if (typeof message.text === 'string' && message.text.includes('[image]') && message.text.includes('[/image]')) {
        // 处理图片消息
        const imageUrl = message.text.substring(
            message.text.indexOf('[image]') + 7,
            message.text.indexOf('[/image]')
        );
        // 设置消息内容的特殊类名
        contentDiv.className = 'message-content image-message';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'message-image';
        
        // 添加图片加载事件
        img.onload = () => {
            messages.scrollTop = messages.scrollHeight;
        };
        
        contentDiv.appendChild(img);
    } else if (typeof message.text === 'string' && message.text.includes('[video]') && message.text.includes('[/video]')) {
        // 处理视频消息
        const videoUrl = message.text.substring(
            message.text.indexOf('[video]') + 7,
            message.text.indexOf('[/video]')
        );
        console.log('Creating video element for URL:', videoUrl);
        
        const videoContainer = document.createElement('div');
        videoContainer.className = 'message-video';
        
        const video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        video.src = videoUrl;
        
        videoContainer.appendChild(video);
        contentDiv.appendChild(videoContainer);
    } else {
        // 处理普通文本消息
        contentDiv.textContent = message.text;
    }
    
    messageDiv.appendChild(contentDiv);
    
    if (message.username && message.timestamp) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'message-meta';
        metaDiv.textContent = `${message.username} ${message.timestamp}`;
        messageDiv.appendChild(metaDiv);
    }
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// 发送消息
form.addEventListener('submit', (e) => {
    e.preventDefault();
    const messageText = input.value.trim();
    
    if (messageText) {
        console.log('Sending message:', messageText);
        // 修改消息格式，直接发送文本
        const messageData = {
            text: messageText,
            username: window.CHAT_CONFIG.currentUser.username,
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            avatar_url: window.CHAT_CONFIG.currentUser.avatar_url
        };
        socket.emit('message', messageData);
        input.value = '';
    }
});

// 错误处理
socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

window.onerror = function(msg, url, line, col, error) {
    console.error('Global error:', {msg, url, line, col, error});
};

// 添加窗口大小改变时的处理
window.addEventListener('resize', () => {
    // 当键盘弹出或收起时，确保滚动到底部
    requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
    });
});

// 添加初始加载完成后的处理
window.addEventListener('load', () => {
    // 确保初始加载时滚动到底部
    requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
    });
});

// 修改文件上传处理
fileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/mobile/upload_file', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.url) {
            let messageText;
            if (data.type.startsWith('video/')) {
                messageText = `[video]${data.url}[/video]`;
            } else if (data.type.startsWith('image/')) {
                messageText = `[image]${data.url}[/image]`;
            } else {
                messageText = `[file]${data.url}[/file]`;
            }
            // 修改文件消息格式
            const messageData = {
                text: messageText,
                username: window.CHAT_CONFIG.currentUser.username,
                timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
                avatar_url: window.CHAT_CONFIG.currentUser.avatar_url
            };
            console.log('Sending file message:', messageData);
            socket.emit('message', messageData);
        }
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('文件上传失败，请重试');
    });

    fileInput.value = '';
});

// 添加侧边栏切换功能
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) {
        sidebar.classList.toggle('open');
        document.body.style.overflow = sidebar.classList.contains('open') ? 'hidden' : '';
    } else {
        console.error('未找到 .sidebar 元素');
    }
}

// 点击侧边栏外部区域时关闭侧边栏
document.addEventListener('click', function(event) {
    const sidebar = document.querySelector('.sidebar');
    const menuButton = document.querySelector('.nav-icon');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && !sidebar.contains(event.target) && 
        menuButton && !menuButton.contains(event.target)) {
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
    }
});

// 添加遮罩层点击事件
document.querySelector('.sidebar-overlay')?.addEventListener('click', function() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
        document.body.style.overflow = '';
    }
});
