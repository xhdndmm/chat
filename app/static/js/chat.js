// 全局函数
function checkAdminAccess() {
    if (window.CHAT_CONFIG.currentUser.isAdmin) {
        window.location.href = window.CHAT_CONFIG.urls.admin;
    } else {
        alert('您不是管理员，无权访问管理面板');
    }
}

function closeUserInfoModal() {
    const modal = document.getElementById('userInfoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleUserMenu() {
    const menu = document.getElementById('userMenu');
    menu.classList.toggle('active');
}

function showTab(tabId) {
    console.log('Switching to tab:', tabId);
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => {
        if (tab.id === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        if (button.getAttribute('onclick').includes(tabId)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (tabId === 'stickers-tab') {
        loadStickers();
    }
}

// 贴纸相关函数
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
                input.value = '';
            } else {
                alert(result.error || '上传失败');
            }
        })
        .catch(error => {
            console.error('上传贴纸包失败:', error);
            alert('上传失败，请重试');
        });
    }
}

function loadStickers() {
    console.log('开始加载贴纸');
    
    fetch('/get_sticker_packs')
        .then(response => response.json())
        .then(packs => {
            console.log('获取到的贴纸包:', packs);
            const container = document.querySelector('.sticker-container');
            if (!container) {
                console.error('找不到贴纸容器');
                return;
            }
            
            container.innerHTML = '';
            
            packs.forEach(pack => {
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
                    } else {
                        element = document.createElement('img');
                        element.src = url;
                    }
                    
                    element.onclick = () => insertSticker(url);
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
        });
}

// 删除和插入贴纸相关函数
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

function insertSticker(url) {
    const socket = io();
    socket.emit('message', `[sticker]${url}[/sticker]`);
    
    // 如果是从预览窗口发送，关闭预览窗口
    const previewModal = document.getElementById('stickerPreviewModal');
    if (previewModal.style.display === 'flex') {
        previewModal.style.display = 'none';
    }
    
    // 关闭表情面板
    document.getElementById('emoji-panel').style.display = 'none';
}

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
                input.value = '';
            } else {
                alert(result.error || '上传失败');
            }
        })
        .catch(error => {
            console.error('上传贴纸失败:', error);
            alert('上传失败，请重试');
        });
    }
}

// 消息处理相关函数
function appendMessage(msgData) {
    console.log('Appending message:', msgData);
    const messageDiv = document.createElement('div');
    const isOwn = msgData.username === window.CHAT_CONFIG.currentUser.username;
    messageDiv.className = `message ${isOwn ? 'message-own' : 'message-other'}`;
    messageDiv.setAttribute('data-message-id', msgData.id);

    // 添加头像
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = msgData.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msgData.username}`;
    avatarImg.alt = msgData.username;
    avatarImg.onclick = () => showUserInfo(msgData.username);
    avatarDiv.appendChild(avatarImg);
    messageDiv.appendChild(avatarDiv);

    // 内容容器
    const contentContainer = document.createElement('div');
    contentContainer.className = 'message-container';

    // 用户名
    const usernameDiv = document.createElement('div');
    usernameDiv.className = 'message-username';
    usernameDiv.textContent = msgData.username;
    contentContainer.appendChild(usernameDiv);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';

    // 消息内容
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // 根据消息类型显示不同内容
    if (msgData.text && msgData.text.startsWith('[sticker]') && msgData.text.endsWith('[/sticker]')) {
        // 贴纸消息处理
        const stickerUrl = msgData.text.replace('[sticker]', '').replace('[/sticker]', '');
        contentDiv.className = 'message-content sticker-message';
        
        const fileExt = stickerUrl.split('.').pop().toLowerCase();
        
        if (fileExt === 'webm') {
            const video = document.createElement('video');
            video.src = stickerUrl;
            video.className = 'sticker-image webm-sticker';
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            video.onclick = () => showStickerPreview(stickerUrl);
            contentDiv.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = stickerUrl;
            img.className = 'sticker-image';
            img.onclick = () => showStickerPreview(stickerUrl);
            contentDiv.appendChild(img);
        }
    } else if (msgData.type === 'file') {
        // 文件消息处理
        handleFileMessage(msgData, contentDiv);
    } else {
        // 普通文本消息
        contentDiv.textContent = msgData.text;
    }
    
    contentWrapper.appendChild(contentDiv);

    // 添加消息信息（时间等）
    const infoDiv = document.createElement('div');
    infoDiv.className = 'message-info';
    
    // 添加时间
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = msgData.timestamp || new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    infoDiv.appendChild(timeSpan);

    // 如果消息被编辑过，添加编辑标记
    if (msgData.edited) {
        const editedSpan = document.createElement('span');
        editedSpan.className = 'message-edited';
        editedSpan.textContent = '(已编辑)';
        infoDiv.appendChild(editedSpan);
    }

    contentWrapper.appendChild(infoDiv);
    contentContainer.appendChild(contentWrapper);
    messageDiv.appendChild(contentContainer);

    // 为消息添加右键菜单事件（仅限自己的消息）
    if (isOwn) {
        messageDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            currentMessageId = msgData.id;
            showContextMenu(e.pageX, e.pageY);
        });
    }

    const messages = document.getElementById('messages');
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

// 文件消息处理函数
function handleFileMessage(msgData, contentDiv) {
    const fileExt = msgData.filename.split('.').pop().toLowerCase();
    const fileLink = document.createElement('a');
    fileLink.href = msgData.url;
    fileLink.target = '_blank';
    fileLink.className = 'file-message';

    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(fileExt)) {
        // 图片文件
        contentDiv.className = 'message-content image-message';
        const img = document.createElement('img');
        img.src = msgData.url;
        img.className = 'image-preview';
        fileLink.appendChild(img);
    } else if (['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v'].includes(fileExt)) {
        // 视频文件
        contentDiv.className = 'message-content video-message';
        const video = document.createElement('video');
        video.src = msgData.url;
        video.className = 'video-preview';
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        
        video.onerror = () => {
            video.style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'video-error';
            errorDiv.textContent = '视频加载失败';
            fileLink.appendChild(errorDiv);
        };
        
        fileLink.appendChild(video);
    } else {
        // 其他类型文件
        let iconPath;
        let iconClass;
        
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(fileExt)) {
            iconPath = 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z';
            iconClass = 'archive';
        } else if (['pdf'].includes(fileExt)) {
            iconPath = 'M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z';
            iconClass = 'pdf';
        } else {
            iconPath = 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z';
            iconClass = 'doc';
        }

        fileLink.innerHTML = `
            <svg class="file-icon ${iconClass}" viewBox="0 0 24 24">
                <path d="${iconPath}"/>
            </svg>
            <div class="file-info">
                <span class="file-name">${msgData.filename}</span>
                <span class="file-size">${formatFileSize(msgData.size)}</span>
            </div>
        `;
    }
    contentDiv.appendChild(fileLink);
}

// 文件大小格式化
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 消息编辑和删除
function editMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const contentDiv = messageDiv.querySelector('.message-content');
    
    // 如果是贴纸消息，不允许编辑
    if (contentDiv.classList.contains('sticker-message')) {
        return;
    }
    
    const originalText = contentDiv.textContent;
    
    contentDiv.innerHTML = `
        <input type="text" class="edit-input" value="${originalText}">
        <button class="save-edit">保存</button>
        <button class="cancel-edit">取消</button>
    `;
    
    const editInput = contentDiv.querySelector('.edit-input');
    editInput.focus();
    
    contentDiv.querySelector('.save-edit').onclick = () => {
        const newText = editInput.value.trim();
        if (newText && newText !== originalText) {
            socket.emit('edit_message', {
                id: messageId,
                text: newText
            });
        }
        contentDiv.textContent = originalText;
    };
    
    contentDiv.querySelector('.cancel-edit').onclick = () => {
        contentDiv.textContent = originalText;
    };
}

function deleteMessage(messageId) {
    if (confirm('确定要删除这条消息吗？')) {
        socket.emit('delete_message', { id: messageId });
    }
}

// 右键菜单相关
function showContextMenu(x, y) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'none';
}

// 用户信息相关
async function showUserInfo(username) {
    const userInfoModal = document.getElementById('userInfoModal');
    try {
        const response = await fetch(`/user_info/${username}`);
        const userData = await response.json();
        
        document.getElementById('userInfoAvatar').src = userData.avatar_url;
        document.getElementById('userInfoUsername').textContent = userData.username;
        document.getElementById('userInfoDisplayName').textContent = userData.display_name || userData.username;
        document.getElementById('userInfoBio').textContent = userData.bio || '这个用户很懒，还没有填写简介';
        
        userInfoModal.style.display = 'flex';
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const form = document.getElementById('message-form');
    const input = document.getElementById('input');
    const fileInput = document.getElementById('file-input');
    const emojiBtn = document.querySelector('.emoji-btn');
    const emojiPanel = document.getElementById('emoji-panel');
    const emojis = document.querySelectorAll('.emoji');
    let currentMessageId = null;
    let typingTimer;

    // Socket.io 事件监听
    socket.on('message', (msgData) => {
        console.log('Received message:', msgData);
        appendMessage(msgData);
    });

    socket.on('message_status', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            const statusSpan = messageDiv.querySelector('.message-status');
            if (statusSpan) statusSpan.textContent = data.status;
        }
    });

    socket.on('message_edited', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector('.message-content');
            contentDiv.textContent = data.text;
            
            const infoDiv = messageDiv.querySelector('.message-info');
            if (!infoDiv.querySelector('.message-edited')) {
                const editedSpan = document.createElement('span');
                editedSpan.className = 'message-edited';
                editedSpan.textContent = '(已编辑)';
                infoDiv.insertBefore(editedSpan, infoDiv.firstChild);
            }
        }
    });

    socket.on('message_deleted', (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    });

    // 表单提交
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        clearTimeout(typingTimer);
        socket.emit('typing', { status: 'stopped' });
        
        if (input.value.trim()) {
            socket.emit('message', input.value);
            input.value = '';
        }
    });

    // 输入状态监听
    input.addEventListener('input', () => {
        if (input.value.trim()) {
            clearTimeout(typingTimer);
            socket.emit('typing', { status: 'typing' });
            
            typingTimer = setTimeout(() => {
                socket.emit('typing', { status: 'stopped' });
            }, 2000);
        } else {
            clearTimeout(typingTimer);
            socket.emit('typing', { status: 'stopped' });
        }
    });

    // 文件上传处理
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.error) {
                alert(result.error);
            }
            
            fileInput.value = '';
        } catch (error) {
            console.error('Upload failed:', error);
            alert('文件上传失败');
        }
    });

    // 表情面板相关事件
    emojiBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = emojiPanel.style.display !== 'none';
        emojiPanel.style.display = isVisible ? 'none' : 'block';
        
        if (!isVisible) {
            const btnRect = emojiBtn.getBoundingClientRect();
            emojiPanel.style.left = `${btnRect.left}px`;
            emojiPanel.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
        }
    });

    // 点击其他地方关闭表情面板和右键菜单
    document.addEventListener('click', (e) => {
        if (!emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPanel.style.display = 'none';
        }
        hideContextMenu();
    });

    // 表情点击事件
    emojis.forEach(emoji => {
        emoji.addEventListener('click', function() {
            const emojiText = this.getAttribute('data-emoji');
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + emojiText + input.value.slice(end);
            input.focus();
            const newCursorPos = start + emojiText.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
            input.dispatchEvent(new Event('input'));
            emojiPanel.style.display = 'none';
        });
    });

    // 右键菜单事件
    const editMenuItem = document.getElementById('editMenuItem');
    const deleteMenuItem = document.getElementById('deleteMenuItem');

    editMenuItem.addEventListener('click', () => {
        if (currentMessageId) {
            editMessage(currentMessageId);
            hideContextMenu();
        }
    });

    deleteMenuItem.addEventListener('click', () => {
        if (currentMessageId) {
            deleteMessage(currentMessageId);
            hideContextMenu();
        }
    });

    // 阻止右键菜单冒泡
    document.getElementById('contextMenu').addEventListener('click', (e) => {
        e.stopPropagation();
    });
});