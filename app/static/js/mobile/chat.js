// 适用于移动端的聊天逻辑
const socket = io();

// 获取 DOM 元素
const form = document.getElementById('message-form');
const input = document.getElementById('message-input');
const messages = document.getElementById('messages');
const fileInput = document.getElementById('file-input');
const emojiBtn = document.querySelector('.emoji-btn');
const emojiPanel = document.getElementById('emoji-panel');
const stickerPanel = document.getElementById('sticker-panel');
const emojis = document.querySelectorAll('.emoji');

// 添加调试日志
console.log('Mobile chat.js loaded');

// 记录是否已加载历史消息
let historyLoaded = false;

// 初始化表情面板
initEmojiPanel(emojiBtn, emojiPanel, emojis, input);

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
        const stickerUrl = message.text.replace('[sticker]', '').replace('[/sticker]', '');
        const fileExt = stickerUrl.split('.').pop().toLowerCase();
        let element;

        if (fileExt === 'webm') {
            element = document.createElement('video');
            element.src = stickerUrl;
            element.autoplay = true;
            element.loop = true;
            element.muted = true;
            element.playsInline = true;
            element.className = 'message-sticker webm-sticker';
        } else {
            element = document.createElement('img');
            element.src = stickerUrl;
            element.className = 'message-sticker';
        }

        contentDiv.appendChild(element);
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
            avatar_url: window.CHAT_CONFIG.currentUser.avatar_url,
            type: 'text' // 添加消息类型
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

// 切换表情/贴纸面板
function switchPanel(type) {
    const emojiPanel = document.getElementById('emoji-panel');
    const stickerPanel = document.getElementById('sticker-panel');
    const tabs = document.querySelectorAll('.panel-tab');

    // 更新标签状态
    tabs.forEach(tab => {
        if (tab.textContent.includes(type === 'emoji' ? '表情' : '贴纸')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (type === 'emoji') {
        emojiPanel.querySelector('.emoji-grid').style.display = 'grid';
        stickerPanel.style.display = 'none';
        stickerPanel.classList.remove('show');
        if (!emojiPanel.classList.contains('show')) {
            loadStickers(); // 预加载贴纸
        }
        emojiPanel.classList.add('show');
    } else {
        emojiPanel.querySelector('.emoji-grid').style.display = 'none';
        emojiPanel.classList.remove('show');
        stickerPanel.style.display = 'flex';
        stickerPanel.classList.add('show');
        loadStickers();
    }
}

// 修改初始化表情面板函数
function initEmojiPanel(emojiBtn, emojiPanel, emojis, input) {
    let isAnimating = false;

    // 添加点击事件监听器来关闭面板
    document.addEventListener('click', (e) => {
        if (!emojiPanel.contains(e.target) &&
            !document.getElementById('sticker-panel').contains(e.target) &&
            !emojiBtn.contains(e.target)) {
            if (isAnimating) return;
            isAnimating = true;
            emojiPanel.classList.remove('show');
            document.getElementById('sticker-panel').classList.remove('show');
            setTimeout(() => {
                emojiPanel.style.display = 'none';
                document.getElementById('sticker-panel').style.display = 'none';
                isAnimating = false;
            }, 300);
        }
    });

    emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isAnimating) return;

        console.log('Emoji button clicked');

        isAnimating = true;

        if (emojiPanel.classList.contains('show') || stickerPanel.classList.contains('show')) {
            emojiPanel.classList.remove('show');
            stickerPanel.classList.remove('show');
            setTimeout(() => {
                emojiPanel.style.display = 'none';
                stickerPanel.style.display = 'none';
                isAnimating = false;
            }, 300);
        } else {
            emojiPanel.style.display = 'flex';
            // 默认显示表情面板
            switchPanel('emoji');
            requestAnimationFrame(() => {
                emojiPanel.classList.add('show');
                setTimeout(() => {
                    isAnimating = false;
                }, 300);
            });
        }
    });

    emojis.forEach(emoji => {
        emoji.addEventListener('click', function() {
            const emojiText = this.getAttribute('data-emoji');
            console.log('Emoji clicked:', emojiText);
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + emojiText + input.value.slice(end);
            input.focus();
            const newCursorPos = start + emojiText.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
            input.dispatchEvent(new Event('input'));
            if (isAnimating) return;
            isAnimating = true;
            emojiPanel.classList.remove('show');
            setTimeout(() => {
                if (!emojiPanel.classList.contains('show')) {
                    emojiPanel.style.display = 'none';
                    isAnimating = false;
                }
            }, 300);
        });
    });
}

// 切换标签页
function showTab(tabId) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.tab-button');

    // 隐藏所有标签页内容
    tabs.forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
    });

    // 移除所有按钮的激活状态
    buttons.forEach(button => {
        button.classList.remove('active');
    });

    // 显示选中的标签页
    const selectedTab = document.getElementById(tabId);
    selectedTab.classList.add('active');
    selectedTab.style.display = 'flex';

    // 激活对应的按钮
    document.querySelector(`[onclick*="${tabId}"]`).classList.add('active');

    // 如果是贴纸标签页，加载贴纸
    if (tabId === 'stickers-tab') {
        loadStickers();
    }
}

// 加载贴纸
async function loadStickers() {
    const container = document.querySelector('.sticker-container');
    if (!container) return;

    try {
        const response = await fetch('/get_sticker_packs');
        const packs = await response.json();

        container.innerHTML = '';

        // 处理单个贴纸（没有包名的贴纸）
        const singleStickers = [];

        packs.forEach(pack => {
            if (typeof pack === 'string') {
                singleStickers.push(pack);
            } else if (pack.stickers) {
                if (!pack.name) {
                    singleStickers.push(...pack.stickers);
                }
            }
        });

        // 显示单个贴纸
        if (singleStickers.length > 0) {
            const packDiv = document.createElement('div');
            packDiv.className = 'sticker-pack';
            packDiv.setAttribute('data-pack-name', '未分组贴纸');

            const header = document.createElement('div');
            header.className = 'pack-header';
            header.innerHTML = `<span class="pack-name">未分组贴纸</span>`;

            const grid = document.createElement('div');
            grid.className = 'sticker-grid';

            singleStickers.forEach(url => {
                const wrapper = document.createElement('div');
                wrapper.className = 'sticker-wrapper';

                const fileExt = url.split('.').pop().toLowerCase();
                let element;

                if (fileExt === 'webm') {
                    element = document.createElement('video');
                    element.src = url;
                    element.autoplay = true;
                    element.loop = true;
                    element.muted = true;
                    element.playsInline = true;
                    element.className = 'sticker-image webm-sticker';
                } else {
                    element = document.createElement('img');
                    element.src = url;
                    element.className = 'sticker-image';
                }

                element.onclick = () => insertSticker(url);

                // 添加删除按钮 - 所有用户都可以删除
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'sticker-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('确定要删除这个贴纸吗？')) {
                        deleteSticker(url);
                    }
                };
                wrapper.appendChild(deleteBtn);

                wrapper.appendChild(element);
                grid.appendChild(wrapper);
            });

            packDiv.appendChild(header);
            packDiv.appendChild(grid);
            container.appendChild(packDiv);
        }

        // 处理贴纸包
        packs.filter(p => p.name && p.name !== '').forEach(pack => {
            const packDiv = document.createElement('div');
            packDiv.className = 'sticker-pack';
            packDiv.setAttribute('data-pack-name', pack.name);

            const header = document.createElement('div');
            header.className = 'pack-header';
            header.innerHTML = `
                <span class="pack-name">${pack.name}</span>
                <button class="pack-delete" onclick="deleteStickerPack('${pack.id}')" title="删除贴纸包">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            `;

            const grid = document.createElement('div');
            grid.className = 'sticker-grid';

            pack.stickers.forEach(url => {
                const wrapper = document.createElement('div');
                wrapper.className = 'sticker-wrapper';

                const fileExt = url.split('.').pop().toLowerCase();
                let element;

                if (fileExt === 'webm') {
                    element = document.createElement('video');
                    element.src = url;
                    element.autoplay = true;
                    element.loop = true;
                    element.muted = true;
                    element.playsInline = true;
                    element.className = 'sticker-image webm-sticker';
                } else {
                    element = document.createElement('img');
                    element.src = url;
                    element.className = 'sticker-image';
                }

                element.onclick = () => insertSticker(url);

                // 添加删除按钮 - 所有用户都可以删除
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'sticker-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (confirm('确定要删除这个贴纸吗？')) {
                        deleteSticker(url);
                    }
                };
                wrapper.appendChild(deleteBtn);

                wrapper.appendChild(element);
                grid.appendChild(wrapper);
            });

            packDiv.appendChild(header);
            packDiv.appendChild(grid);
            container.appendChild(packDiv);

            const videos = packDiv.querySelectorAll('video');
            videos.forEach(video => {
                video.play().catch(e => console.log('视频自动播放失败:', e));
            });
        });
    } catch (error) {
        console.error('加载贴纸失败:', error);
        container.innerHTML = '<div class="error-message">加载贴纸失败</div>';
    }
}

// 插入贴纸
function insertSticker(url) {
    socket.emit('message', `[sticker]${url}[/sticker]`);

    // 关闭表情面板和贴纸面板
    const emojiPanel = document.getElementById('emoji-panel');
    const stickerPanel = document.getElementById('sticker-panel');
    emojiPanel.classList.remove('show');
    stickerPanel.classList.remove('show');
    setTimeout(() => {
        emojiPanel.style.display = 'none';
        stickerPanel.style.display = 'none';
        // 重置选项卡状态为表情
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            if (tab.textContent.includes('表情')) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        // 重置面板显示状态
        emojiPanel.querySelector('.emoji-grid').style.display = 'grid';
        stickerPanel.style.display = 'none';
    }, 300);
}

// 上传贴纸包
function uploadStickerPack(input) {
    if (input.files && input.files[0]) {
        const packName = prompt('请输入贴纸包名称：');
        if (!packName) {
            input.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('sticker_pack', input.files[0]);
        formData.append('pack_name', packName);

        fetch('/upload_sticker_pack', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadStickers();
            } else {
                alert(result.error || '上传失败');
            }
            input.value = '';
        })
        .catch(error => {
            console.error('上传贴纸包失败:', error);
            alert('上传失败，请重试');
            input.value = '';
        });
    }
}

// 上传单个贴纸
function uploadSticker(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append('sticker', input.files[0]);

        fetch('/upload_sticker', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadStickers();
            } else {
                alert(result.error || '上传失败');
            }
            input.value = '';
        })
        .catch(error => {
            console.error('上传贴纸失败:', error);
            alert('上传失败，请重试');
            input.value = '';
        });
    }
}

// 删除贴纸包
function deleteStickerPack(packId) {
    if (confirm('确定要删除这个贴纸包吗？这将删除包内所有贴纸。')) {
        fetch('/delete_sticker_pack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pack_id: packId })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                loadStickers();
            } else {
                alert(result.error || '删除失败');
            }
        })
        .catch(error => {
            console.error('删除贴纸包失败:', error);
            alert('删除失败，请重试');
        });
    }
}

// 删除单个贴纸
function deleteSticker(url) {
    fetch('/delete_sticker', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: url })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            loadStickers();
        } else {
            alert(result.error || '删除失败');
        }
    })
    .catch(error => {
        console.error('删除贴纸失败:', error);
        alert('删除失败，请重试');
    });
}
