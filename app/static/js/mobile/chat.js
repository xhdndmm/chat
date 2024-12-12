let socket = io();
let sidebar = document.getElementById('sidebar');
let emojiPanel = document.getElementById('emoji-panel');
let typingTimer;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initSocketEvents();
    initMessageForm();
    initEmojiPanel();
    initFileUpload();
    initSidebar();
});

// 初始化 Socket.IO 事件
function initSocketEvents() {
    socket.on('message', (data) => {
        appendMessage(data);
    });

    socket.on('typing_status', (data) => {
        updateTypingStatus(data);
    });

    // 添加消息编辑事件监听
    socket.on('message_edited', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content');
            // 检查是否是贴纸消息
            if (data.text.startsWith('[sticker]') && data.text.endsWith('[/sticker]')) {
                const stickerUrl = data.text.replace('[sticker]', '').replace('[/sticker]', '');
                contentDiv.innerHTML = `<img src="${stickerUrl}" alt="sticker" class="sticker-image">`;
                contentDiv.className = 'message-content sticker-message';
            } else {
                contentDiv.textContent = data.text;
                contentDiv.className = 'message-content';
            }
            
            // 添加编辑标记
            if (!messageDiv.querySelector('.edit-mark')) {
                const editMark = document.createElement('div');
                editMark.className = 'edit-mark';
                editMark.textContent = '(已编辑)';
                messageDiv.appendChild(editMark);
            }
        }
    });

    // 添加消息删除事件监听
    socket.on('message_deleted', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    });
}

// 初始化消息表单
function initMessageForm() {
    const form = document.getElementById('message-form');
    const input = document.getElementById('message-input');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (input.value.trim()) {
            socket.emit('message', input.value);
            input.value = '';
        }
    });

    // 输入状态
    input.addEventListener('input', () => {
        clearTimeout(typingTimer);
        socket.emit('typing', { status: 'typing' });
        
        typingTimer = setTimeout(() => {
            socket.emit('typing', { status: 'stopped' });
        }, 2000);
    });
}

// 初始化表情面板
function initEmojiPanel() {
    const emojiBtn = document.getElementById('emoji-btn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const emojiContent = document.getElementById('emoji-content');
    const stickersContent = document.getElementById('stickers-content');

    // 表情按钮点击事件
    emojiBtn.addEventListener('click', () => {
        emojiPanel.style.display = emojiPanel.style.display === 'none' ? 'block' : 'none';
        if (emojiPanel.style.display === 'block') {
            loadEmojis();
            loadStickers();
        }
    });

    // 标签切换
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabName = btn.dataset.tab;
            if (tabName === 'emoji') {
                emojiContent.style.display = 'grid';
                stickersContent.style.display = 'none';
            } else {
                emojiContent.style.display = 'none';
                stickersContent.style.display = 'grid';
            }
        });
    });

    // 点击其他地方关闭面板
    document.addEventListener('click', (e) => {
        if (!emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPanel.style.display = 'none';
        }
    });
}

// 加载表情
function loadEmojis() {
    const emojiContent = document.getElementById('emoji-content');
    const emojis = ['😊', '😂', '🤣', '❤️', '😍', '😒', '👍', '😁', '😘', '🙄', 
                    '😭', '😅', '😩', '😡', '🥰', '😎', '🤔', '🤗', '😴', '😷'];
    
    emojiContent.innerHTML = emojis.map(emoji => `
        <div class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</div>
    `).join('');
}

// 加载贴纸
function loadStickers() {
    const stickersContent = document.getElementById('stickers-content');
    
    fetch('/get_stickers')
        .then(response => response.json())
        .then(stickers => {
            stickersContent.innerHTML = stickers.map(sticker => `
                <div class="sticker-item" onclick="insertSticker('${sticker.url}')">
                    <img src="${sticker.url}" alt="sticker">
                </div>
            `).join('');
        });
}

// 插入表情
function insertEmoji(emoji) {
    const input = document.getElementById('message-input');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;
}

// 插入贴纸
function insertSticker(url) {
    socket.emit('message', `[sticker]${url}[/sticker]`);
    emojiPanel.style.display = 'none';
}

// 初始化侧边栏
function initSidebar() {
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !e.target.closest('.menu-btn')) {
            sidebar.classList.remove('active');
        }
    });
}

// 切换侧边栏
function toggleSidebar() {
    sidebar.classList.toggle('active');
}

// 添加消息到聊天区域
function appendMessage(data) {
    const messages = document.getElementById('messages');
    const isOwn = data.username === window.CHAT_CONFIG.currentUser.username;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'message-own' : ''}`;
    messageDiv.setAttribute('data-message-id', data.id);
    
    // 处理贴纸消息
    if (data.text && data.text.startsWith('[sticker]') && data.text.endsWith('[/sticker]')) {
        const stickerUrl = data.text.replace('[sticker]', '').replace('[/sticker]', '');
        messageDiv.innerHTML = `
            <div class="message-content sticker-message">
                <img src="${stickerUrl}" alt="sticker" class="sticker-image">
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                ${data.text}
            </div>
        `;
    }
    
    // 为自己发送的消息添加长按事件
    if (isOwn) {
        let pressTimer;
        let touchStartX;
        let touchStartY;
        
        messageDiv.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            pressTimer = setTimeout(() => {
                showMessageActions(data.id, e.touches[0].clientX, e.touches[0].clientY);
            }, 500);
        });

        messageDiv.addEventListener('touchmove', (e) => {
            if (Math.abs(e.touches[0].clientX - touchStartX) > 10 ||
                Math.abs(e.touches[0].clientY - touchStartY) > 10) {
                clearTimeout(pressTimer);
            }
        });

        messageDiv.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
    }
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// 更新输入状态
function updateTypingStatus(data) {
    const statusDiv = document.getElementById('typing-status');
    if (data.status === 'typing') {
        statusDiv.textContent = `${data.username} 正在输入...`;
        statusDiv.style.display = 'block';
    } else {
        statusDiv.style.display = 'none';
    }
}

// 文件上传处理
function initFileUpload() {
    const fileInput = document.getElementById('file-input');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        // 显示上传进度
        const progressBar = document.createElement('div');
        progressBar.className = 'upload-progress';
        progressBar.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">0%</div>
        `;
        document.querySelector('.chat-footer').insertBefore(progressBar, null);

        // 发送文件
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded * 100) / e.total);
                progressBar.querySelector('.progress-fill').style.width = percent + '%';
                progressBar.querySelector('.progress-text').textContent = percent + '%';
            }
        };

        xhr.onload = function() {
            progressBar.remove();
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                    socket.emit('message', `[file]${response.file_url}[/file]`);
                }
            }
        };

        xhr.onerror = function() {
            progressBar.remove();
            alert('上传失败，请重试');
        };

        xhr.open('POST', '/upload', true);
        xhr.send(formData);
    });
}

// 显示消息操作菜单
function showMessageActions(messageId, x, y) {
    // 移除已存在的操作菜单
    const existingMenu = document.querySelector('.message-actions-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'message-actions-menu';
    menu.innerHTML = `
        <div class="action-item edit-action">编辑</div>
        <div class="action-item delete-action">删除</div>
    `;
    
    // 定位菜单
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    
    // 添加事件处理
    menu.querySelector('.edit-action').onclick = () => {
        editMessage(messageId);
        menu.remove();
    };
    
    menu.querySelector('.delete-action').onclick = () => {
        if (confirm('确定要删除这条消息吗？')) {
            deleteMessage(messageId);
            menu.remove();
        }
    };
    
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// 编辑消息
function editMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const contentDiv = messageDiv.querySelector('.message-content');
    const currentText = contentDiv.textContent;
    
    // 创建编辑框
    const editContainer = document.createElement('div');
    editContainer.className = 'edit-container';
    editContainer.innerHTML = `
        <input type="text" class="edit-input" value="${currentText}">
        <div class="edit-actions">
            <button class="save-edit">保存</button>
            <button class="cancel-edit">取消</button>
        </div>
    `;
    
    contentDiv.replaceWith(editContainer);
    
    const input = editContainer.querySelector('.edit-input');
    input.focus();
    
    // 保存编辑
    editContainer.querySelector('.save-edit').onclick = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            socket.emit('edit_message', {
                id: messageId,
                text: newText
            });
        }
        editContainer.replaceWith(contentDiv);
    };
    
    // 取消编辑
    editContainer.querySelector('.cancel-edit').onclick = () => {
        editContainer.replaceWith(contentDiv);
    };
}

// 删除消息
function deleteMessage(messageId) {
    socket.emit('delete_message', { id: messageId });
} 