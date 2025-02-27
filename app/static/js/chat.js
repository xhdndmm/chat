// 全局变量
let socket;
let typingTimer;
let typingUsers = new Set();
let currentMessageId = null;

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
    // 初始化 Socket.IO
    socket = io();

    // 获取DOM元素
    const form = document.getElementById("message-form");
    const input = document.getElementById("input");
    const messages = document.getElementById("messages");
    const fileInput = document.getElementById("file-input");
    const emojiBtn = document.querySelector(".emoji-btn");
    const emojiPanel = document.getElementById("emoji-panel");
    const emojis = document.querySelectorAll(".emoji");
    const typingStatus = document.getElementById("typing-status");

    // 初始化贴纸面板
    const stickerTab = document.getElementById("stickers-tab");
    if (stickerTab) {
        loadStickers();
    }

    // 表情面板相关事件
    initEmojiPanel(emojiBtn, emojiPanel, emojis, input);

    // Socket.IO 事件监听
    initSocketEvents(socket);

    // 表单提交事件
    initFormSubmit(form, input, socket);

    // 文件上传事件
    initFileUpload(fileInput);

    // 输入状态监听
    initTypingStatus(input, socket);

    // 关闭预览按钮点击事件
    const closePreview = document.querySelector(".close-preview");
    if (closePreview) {
        closePreview.onclick = function () {
            document.getElementById("stickerPreviewModal").style.display = "none";
        };
    }

    // 点击模态框外部关闭
    window.onclick = function (event) {
        const modal = document.getElementById("stickerPreviewModal");
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };

    // 右键菜单事件
    const editMenuItem = document.getElementById("editMenuItem");
    const deleteMenuItem = document.getElementById("deleteMenuItem");

    editMenuItem.addEventListener("click", () => {
        if (currentMessageId) {
            editMessage(currentMessageId);
            hideContextMenu();
        }
    });

    deleteMenuItem.addEventListener("click", () => {
        if (currentMessageId) {
            deleteMessage(currentMessageId);
            hideContextMenu();
        }
    });

    // 点击其他地方关闭右键菜单
    document.addEventListener("click", hideContextMenu);

    // 阻止右键菜单冒泡
    document.getElementById("contextMenu").addEventListener("click", (e) => {
        e.stopPropagation();
    });
});

// 初始化表情面板
function initEmojiPanel(emojiBtn, emojiPanel, emojis, input) {
    emojiBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isVisible = emojiPanel.style.display !== "none";
        emojiPanel.style.display = isVisible ? "none" : "block";

        if (!isVisible) {
            const btnRect = emojiBtn.getBoundingClientRect();
            emojiPanel.style.left = `${btnRect.left}px`;
            emojiPanel.style.bottom = `${window.innerHeight - btnRect.top + 10}px`;
        }
    });

    document.addEventListener("click", (e) => {
        if (!emojiPanel.contains(e.target) && !emojiBtn.contains(e.target)) {
            emojiPanel.style.display = "none";
        }
    });

    emojis.forEach((emoji) => {
        emoji.addEventListener("click", function () {
            const emojiText = this.getAttribute("data-emoji");
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = input.value.slice(0, start) + emojiText + input.value.slice(end);
            input.focus();
            const newCursorPos = start + emojiText.length;
            input.setSelectionRange(newCursorPos, newCursorPos);
            input.dispatchEvent(new Event("input"));
            emojiPanel.style.display = "none";
        });
    });
}

// 初始化 Socket.IO 事件
function initSocketEvents(socket) {
    // 消息接收
    socket.on("message", (msgData) => {
        console.log("Received message:", msgData);
        if (!msgData) {
            console.error("Invalid message data received");
            return;
        }
        appendMessage(msgData);
    });

    // 消息状态更新
    socket.on('message_read_status', function(data) {
        console.log('收到已读状态更新:', data);
        updateMessageReadStatus(data.message_id, data.read_by, data.unread_by);
    });

    // 消息编辑
    socket.on("message_edited", (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            const contentDiv = messageDiv.querySelector(".message-content");
            contentDiv.textContent = data.text;

            const infoDiv = messageDiv.querySelector(".message-info");
            if (!infoDiv.querySelector(".message-edited")) {
                const editedSpan = document.createElement("span");
                editedSpan.className = "message-edited";
                editedSpan.textContent = "(已编辑)";
                infoDiv.insertBefore(editedSpan, infoDiv.firstChild);
            }
        }
    });

    // 消息删除
    socket.on("message_deleted", (data) => {
        const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageDiv) {
            messageDiv.remove();
        }
    });

    // 输入状态
    socket.on("typing_status", (data) => {
        console.log("Received typing status:", data);
        if (data.status === "typing") {
            typingUsers.add(data.username);
        } else {
            typingUsers.delete(data.username);
        }
        updateTypingStatus();
    });
}

// 初始化表单提交
function initFormSubmit(form, input, socket) {
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearTimeout(typingTimer);
        socket.emit("typing", { status: "stopped" });

        if (input.value.trim()) {
            socket.emit("message", input.value);
            input.value = "";
        }
    });
}

// 初始化文件上传
function initFileUpload(fileInput) {
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        // 显示进度条
        const progressBar = document.getElementById("upload-progress");
        const progressFill = progressBar.querySelector(".progress-fill");
        const progressText = progressBar.querySelector(".progress-text");
        progressBar.style.display = "block";

        const xhr = new XMLHttpRequest();

        // 监听上传进度
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                const percentCompleted = Math.round((e.loaded * 100) / e.total);
                progressFill.style.width = `${percentCompleted}%`;
                progressText.textContent = `${percentCompleted}%`;
            }
        });

        // 监听上传完成
        xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    alert(response.error);
                }
            } else {
                alert("上传失败");
            }

            // 重置和隐藏进度条
            fileInput.value = "";
            setTimeout(() => {
                progressBar.style.display = "none";
                progressFill.style.width = "0";
                progressText.textContent = "0%";
            }, 1000);
        });

        // 监听上传错误
        xhr.addEventListener("error", () => {
            alert("上传失败");
            progressBar.style.display = "none";
        });

        xhr.open("POST", "/upload", true);
        xhr.send(formData);
    });
}

// 初始化输入状态监听
function initTypingStatus(input, socket) {
    input.addEventListener("input", () => {
        if (input.value.trim()) {
            clearTimeout(typingTimer);
            socket.emit("typing", { status: "typing" });

            typingTimer = setTimeout(() => {
                socket.emit("typing", { status: "stopped" });
            }, 2000);
        } else {
            clearTimeout(typingTimer);
            socket.emit("typing", { status: "stopped" });
        }
    });
}

// 更新输入状态显示
function updateTypingStatus() {
    const typingStatus = document.getElementById("typing-status");
    if (typingUsers.size === 0) {
        typingStatus.textContent = "";
        typingStatus.style.display = "none";
        return;
    }

    const users = Array.from(typingUsers);
    let text = "";

    if (users.length === 1) {
        text = `${users[0]} 正在输入...`;
    } else if (users.length === 2) {
        text = `${users[0]} 和 ${users[1]} 正在输入...`;
    } else {
        text = `${users[0]} 和其他 ${users.length - 1} 人正在输入...`;
    }

    typingStatus.textContent = text;
    typingStatus.style.display = "block";
}

// 添加消息到聊天界面
function appendMessage(msgData) {
    console.log("Appending message:", msgData);

    // 基本验证
    if (!msgData || !msgData.username) {
        console.error("Invalid message data:", msgData);
        return;
    }

    const messageDiv = document.createElement("div");
    const isOwn = msgData.username === window.CHAT_CONFIG.currentUser.username;
    messageDiv.className = `message ${isOwn ? "message-own" : "message-other"}`;
    messageDiv.setAttribute("data-message-id", msgData.id);

    // 构建消息 HTML
    let messageHtml = `
        <div class="message-avatar">
            <img src="${msgData.avatar_url}" alt="${msgData.username}" onclick="showUserInfo('${msgData.username}')">
        </div>
        <div class="message-container">
            <div class="message-username">${msgData.username}</div>
            <div class="message-content-wrapper">
                <div class="message-content">
    `;

    // 根据消息类型添加内容
    if (msgData.type === 'file') {
        messageHtml += renderFileMessage(msgData);
    } else if (msgData.text && msgData.text.startsWith('[sticker]') && msgData.text.endsWith('[/sticker]')) {
        const stickerUrl = msgData.text.replace('[sticker]', '').replace('[/sticker]', '');
        messageHtml += renderStickerMessage(stickerUrl);
    } else {
        messageHtml += `<div class="message-text">${msgData.text}</div>`;
    }

    // 添加消息时间和状态
    messageHtml += `
                </div>
                <div class="message-info">
                    <span class="message-time">${msgData.timestamp}</span>
                    <div class="message-status"></div>
                </div>
            </div>
        </div>
    `;

    messageDiv.innerHTML = messageHtml;

    // 添加右键菜单事件
    if (isOwn) {
        messageDiv.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            currentMessageId = msgData.id;
            showContextMenu(e.pageX, e.pageY);
        });
    }

    // 添加到消息列表
    const messages = document.getElementById("messages");
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;

    // 更新消息状态
    updateMessageReadStatus(msgData.id, msgData.read_by || [], msgData.unread_by || []);
}

// 处理贴纸消息
function handleStickerMessage(msgData, contentDiv) {
    const stickerUrl = msgData.text.replace("[sticker]", "").replace("[/sticker]", "");
    contentDiv.className = "message-content sticker-message";

    const fileExt = stickerUrl.split(".").pop().toLowerCase();

    if (fileExt === "webm") {
        const video = document.createElement("video");
        video.src = stickerUrl;
        video.className = "sticker-image webm-sticker";
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.onclick = () => showStickerPreview(stickerUrl);
        contentDiv.appendChild(video);
    } else {
        const img = document.createElement("img");
        img.src = stickerUrl;
        img.className = "sticker-image";
        img.onclick = () => showStickerPreview(stickerUrl);
        contentDiv.appendChild(img);
    }
}

// 处理文件消息
function handleFileMessage(msgData, contentDiv) {
    const fileExt = msgData.filename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt)) {
        // 移除消息内容的默认样式
        contentDiv.className = "message-content image-message";

        const img = document.createElement("img");
        img.src = msgData.url;
        img.className = "message-image";
        img.onclick = (e) => {
            e.preventDefault();
            showImagePreview(msgData.url);
        };
        contentDiv.appendChild(img);
    } else {
        const fileLink = document.createElement("a");
        fileLink.href = msgData.url;
        fileLink.target = "_blank";
        fileLink.className = "file-message";

        if (["mp4", "webm", "avi", "mov", "wmv", "flv", "m4v"].includes(fileExt)) {
            handleVideoFile(msgData, contentDiv, fileLink);
        } else {
            handleOtherFile(msgData, contentDiv, fileLink);
        }

        contentDiv.appendChild(fileLink);
    }
}

// 处理图片文件
function handleImageFile(msgData, contentDiv, fileLink) {
    contentDiv.className = "message-content image-message";
    const img = document.createElement("img");
    img.src = msgData.url;
    img.className = "image-preview";
    fileLink.appendChild(img);
}

// 处理视频文件
function handleVideoFile(msgData, contentDiv, fileLink) {
    contentDiv.className = "message-content video-message";
    const video = document.createElement("video");
    video.src = msgData.url;
    video.className = "video-preview";
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;

    video.onerror = () => {
        video.style.display = "none";
        const errorDiv = document.createElement("div");
        errorDiv.className = "video-error";
        errorDiv.textContent = "视频加载失败";
        fileLink.appendChild(errorDiv);
    };

    fileLink.appendChild(video);
}

// 处理其他类型文件
function handleOtherFile(msgData, fileExt, fileLink) {
    let iconPath;
    let iconClass;

    if (["zip", "rar", "7z", "tar", "gz"].includes(fileExt)) {
        iconPath =
            "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z";
        iconClass = "archive";
    } else if (["pdf"].includes(fileExt)) {
        iconPath =
            "M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z";
        iconClass = "pdf";
    } else {
        iconPath = "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z";
        iconClass = "doc";
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

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// 显示用户信息
async function showUserInfo(username) {
    const userInfoModal = document.getElementById("userInfoModal");
    try {
        const response = await fetch(`/user_info/${username}`);
        const userData = await response.json();

        document.getElementById("userInfoAvatar").src = userData.avatar_url;
        document.getElementById("userInfoUsername").textContent = userData.username;
        document.getElementById("userInfoDisplayName").textContent = userData.display_name || userData.username;
        document.getElementById("userInfoBio").textContent = userData.bio || "这个用户很懒，还没有填写简介";

        userInfoModal.style.display = "flex";
    } catch (error) {
        console.error("获取用户信息失败:", error);
    }
}

// 关闭用户信息模态框
function closeUserInfoModal() {
    const modal = document.getElementById("userInfoModal");
    if (modal) {
        modal.style.display = "none";
    }
}

// 切换用户菜单
function toggleUserMenu() {
    const menu = document.getElementById("userMenu");
    menu.classList.toggle("active");
}

// 检查管理员权限
function checkAdminAccess() {
    if (window.CHAT_CONFIG.currentUser.isAdmin) {
        window.location.href = window.CHAT_CONFIG.urls.admin;
    } else {
        alert("您不是管理员，无权访问管理面板");
    }
}

// 显示标签页
function showTab(tabId) {
    console.log("Switching to tab:", tabId);
    const tabContents = document.querySelectorAll(".tab-content");
    tabContents.forEach((tab) => {
        if (tab.id === tabId) {
            tab.classList.add("active");
        } else {
            tab.classList.remove("active");
        }
    });

    const tabButtons = document.querySelectorAll(".tab-button");
    tabButtons.forEach((button) => {
        if (button.getAttribute("onclick").includes(tabId)) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    if (tabId === "stickers-tab") {
        loadStickers();
    }
}

// 贴纸相关函数
function loadStickers() {
    console.log("开始加载贴纸...");

    fetch("/get_sticker_packs")
        .then((response) => response.json())
        .then((packs) => {
            console.log("获取到的贴纸包数据:", packs);
            const container = document.querySelector(".sticker-container");
            if (!container) {
                console.error("找不到贴纸容器");
                return;
            }

            container.innerHTML = "";

            // 处理单个贴纸（没有包名的贴纸）
            const singleStickers = [];

            // 遍历所有数据
            packs.forEach((pack) => {
                console.log("处理贴纸包:", pack);
                if (typeof pack === "string") {
                    // 如果是单个贴纸 URL
                    singleStickers.push(pack);
                } else if (pack.stickers) {
                    // 如果是贴纸包
                    if (!pack.name) {
                        singleStickers.push(...pack.stickers);
                    }
                }
            });

            console.log("收集到的单个贴纸:", singleStickers);

            // 显示单个贴纸
            if (singleStickers.length > 0) {
                const packDiv = document.createElement("div");
                packDiv.className = "sticker-pack";
                packDiv.setAttribute("data-pack-name", "未分组贴纸");

                const header = document.createElement("div");
                header.className = "pack-header";
                header.innerHTML = `<span class="pack-name">未分组贴纸</span>`;

                const grid = document.createElement("div");
                grid.className = "sticker-grid";

                singleStickers.forEach((url) => {
                    const wrapper = document.createElement("div");
                    wrapper.className = "sticker-wrapper";

                    const fileExt = url.split(".").pop().toLowerCase();
                    let element;

                    if (fileExt === "webm") {
                        element = document.createElement("video");
                        element.src = url;
                        element.autoplay = true;
                        element.loop = true;
                        element.muted = true;
                        element.playsInline = true;
                    } else {
                        element = document.createElement("img");
                        element.src = url;
                    }

                    element.onclick = () => insertSticker(url);
                    wrapper.appendChild(element);
                    grid.appendChild(wrapper);
                });

                packDiv.appendChild(header);
                packDiv.appendChild(grid);
                container.appendChild(packDiv);
            }

            // 处理贴纸包
            packs
                .filter((p) => p.name && p.name !== "")
                .forEach((pack) => {
                    const packDiv = document.createElement("div");
                    packDiv.className = "sticker-pack";
                    packDiv.setAttribute("data-pack-name", pack.name);

                    const header = document.createElement("div");
                    header.className = "pack-header";
                    header.innerHTML = `
                    <span class="pack-name">${pack.name}</span>
                    <button class="pack-delete" onclick="deleteStickerPack('${pack.id}')" title="删除贴纸包">
                        <svg viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                `;

                    const grid = document.createElement("div");
                    grid.className = "sticker-grid";

                    pack.stickers.forEach((url) => {
                        const wrapper = document.createElement("div");
                        wrapper.className = "sticker-wrapper";

                        const fileExt = url.split(".").pop().toLowerCase();
                        let element;

                        if (fileExt === "webm") {
                            element = document.createElement("video");
                            element.src = url;
                            element.autoplay = true;
                            element.loop = true;
                            element.muted = true;
                            element.playsInline = true;
                        } else {
                            element = document.createElement("img");
                            element.src = url;
                        }

                        element.onclick = () => insertSticker(url);
                        wrapper.appendChild(element);
                        grid.appendChild(wrapper);
                    });

                    packDiv.appendChild(header);
                    packDiv.appendChild(grid);
                    container.appendChild(packDiv);

                    const videos = packDiv.querySelectorAll("video");
                    videos.forEach((video) => {
                        video.play().catch((e) => console.log("视频自动播放失败:", e));
                    });
                });
        })
        .catch((error) => {
            console.error("加载贴纸失败:", error);
        });
}

function uploadStickerPack(input) {
    if (input.files && input.files[0]) {
        const packName = prompt("请输入贴纸包名称：");
        if (!packName) {
            input.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("sticker_pack", input.files[0]);
        formData.append("pack_name", packName);

        fetch("/upload_sticker_pack", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.success) {
                    loadStickers();
                    input.value = "";
                } else {
                    alert(result.error || "上传失败");
                }
            })
            .catch((error) => {
                console.error("上传贴纸包失败:", error);
                alert("上传失败，请重试");
            });
    }
}

function uploadSticker(input) {
    if (input.files && input.files[0]) {
        const formData = new FormData();
        formData.append("sticker", input.files[0]);

        fetch("/upload_sticker", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.success) {
                    console.log("贴纸上传成功:", result);

                    // 手动添加到贴纸列表
                    const container = document.querySelector(".sticker-container");
                    if (!container) return;

                    // 检查是否已存在未分组贴纸区域
                    let unGroupedDiv = container.querySelector('[data-pack-name="未分组贴纸"]');
                    if (!unGroupedDiv) {
                        // 如果不存在，创建新的未分组区域
                        unGroupedDiv = document.createElement("div");
                        unGroupedDiv.className = "sticker-pack";
                        unGroupedDiv.setAttribute("data-pack-name", "未分组贴纸");

                        const header = document.createElement("div");
                        header.className = "pack-header";
                        header.innerHTML = `<span class="pack-name">未分组贴纸</span>`;

                        const grid = document.createElement("div");
                        grid.className = "sticker-grid";

                        unGroupedDiv.appendChild(header);
                        unGroupedDiv.appendChild(grid);
                        container.insertBefore(unGroupedDiv, container.firstChild);
                    }

                    // 添加新贴纸
                    const grid = unGroupedDiv.querySelector(".sticker-grid");
                    const wrapper = document.createElement("div");
                    wrapper.className = "sticker-wrapper";

                    const img = document.createElement("img");
                    img.src = result.url;
                    img.onclick = () => insertSticker(result.url);

                    // 添加删除按钮
                    const deleteBtn = document.createElement("button");
                    deleteBtn.className = "sticker-delete-btn";
                    deleteBtn.innerHTML = "×";
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); // 阻止事件冒泡
                        if (confirm("确定要删除这个贴纸吗？")) {
                            deleteSticker(result.url);
                        }
                    };

                    wrapper.appendChild(img);
                    wrapper.appendChild(deleteBtn); // 添加删除按钮到包装器
                    grid.appendChild(wrapper);

                    input.value = "";
                } else {
                    console.error("上传失败:", result.error);
                    alert(result.error || "上传失败");
                }
            })
            .catch((error) => {
                console.error("上传贴纸失败:", error);
                alert("上传失败，请重试");
                input.value = "";
            });
    }
}

function deleteStickerPack(packId) {
    if (confirm("确定要删除这个贴纸包吗？这将删除包内所有贴纸。")) {
        fetch("/delete_sticker_pack", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ pack_id: packId }),
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.success) {
                    loadStickers();
                } else {
                    alert(result.error || "删除失败");
                }
            })
            .catch((error) => {
                console.error("删除贴纸包失败:", error);
                alert("删除失败，请重试");
            });
    }
}

function deleteSticker(url) {
    fetch("/delete_sticker", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url }),
    })
        .then((response) => response.json())
        .then((result) => {
            if (result.success) {
                loadStickers();
            } else {
                alert(result.error || "删除失败");
            }
        })
        .catch((error) => {
            console.error("删除贴纸失败:", error);
            alert("删除失败，请重试");
        });
}

function insertSticker(url) {
    socket.emit("message", `[sticker]${url}[/sticker]`);

    // 如果是从预览窗口发送，关闭预览窗口
    const previewModal = document.getElementById("stickerPreviewModal");
    if (previewModal.style.display === "flex") {
        previewModal.style.display = "none";
    }

    // 关闭表情面板
    document.getElementById("emoji-panel").style.display = "none";
}

// 在文件末尾添加贴纸预览相关函数
async function showStickerPreview(url) {
    const modal = document.getElementById("stickerPreviewModal");
    const grid = document.getElementById("previewGrid");
    grid.innerHTML = ""; // 清空现有内容

    try {
        // 获取贴纸包内容
        const response = await fetch("/get_sticker_packs");
        const packs = await response.json();

        // 找到对应的贴纸包
        const pack = packs.find((p) => p.stickers.includes(url));

        if (pack) {
            // 显示贴纸包中的所有贴纸
            pack.stickers.forEach((stickerUrl) => {
                const wrapper = document.createElement("div");
                wrapper.className = "preview-sticker-wrapper";

                const fileExt = stickerUrl.split(".").pop().toLowerCase();
                let element;

                if (fileExt === "webm") {
                    element = document.createElement("video");
                    element.src = stickerUrl;
                    element.className = "preview-sticker webm-sticker";
                    element.autoplay = true;
                    element.loop = true;
                    element.muted = true;
                    element.playsInline = true;
                } else {
                    element = document.createElement("img");
                    element.src = stickerUrl;
                    element.className = "preview-sticker";
                }

                element.onclick = () => {
                    insertSticker(stickerUrl);
                    modal.style.display = "none";
                };

                wrapper.appendChild(element);
                grid.appendChild(wrapper);
            });

            modal.style.display = "flex";

            // 确保所有视频都开始播放
            const videos = grid.querySelectorAll("video");
            videos.forEach((video) => {
                video.play().catch((e) => console.log("视频自动播放失败:", e));
            });
        }
    } catch (error) {
        console.error("加载贴纸包预览失败:", error);
    }
}

// 添加关闭预览功能
document.addEventListener("DOMContentLoaded", () => {
    // 关闭预览按钮点击事件
    const closePreview = document.querySelector(".close-preview");
    if (closePreview) {
        closePreview.onclick = function () {
            document.getElementById("stickerPreviewModal").style.display = "none";
        };
    }

    // 点击模态框外部关闭
    window.onclick = function (event) {
        const modal = document.getElementById("stickerPreviewModal");
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
});

// 添加右键菜单相关函数
function showContextMenu(x, y) {
    const contextMenu = document.getElementById("contextMenu");
    contextMenu.style.display = "block";
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
    document.getElementById("contextMenu").style.display = "none";
}

// 添加编辑和删除消息功能
function editMessage(messageId) {
    if (!socket) {
        console.error("Socket connection not established");
        return;
    }
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        const contentDiv = messageDiv.querySelector(".message-content");
        const currentText = contentDiv.textContent;
        const newText = prompt("编辑消息:", currentText);

        if (newText && newText !== currentText) {
            socket.emit("edit_message", {
                id: messageId,
                text: newText,
            });
        }
    }
}

function deleteMessage(messageId) {
    if (!socket) {
        console.error("Socket connection not established");
        return;
    }
    if (confirm("确定要删除这条消息吗？")) {
        socket.emit("delete_message", { id: messageId });
    }
}

// 添加图片预览函数（如果还没有的话）
function showImagePreview(url) {
    const modal = document.getElementById("imagePreviewModal");
    const previewImg = document.getElementById("previewImage");

    previewImg.src = url;
    modal.style.display = "block";

    // 点击关闭按钮关闭预览
    modal.querySelector(".close-preview").onclick = () => {
        modal.style.display = "none";
    };

    // 点击背景关闭预览
    modal.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    };

    // ESC 键关闭预览
    const escHandler = (event) => {
        if (event.key === "Escape") {
            modal.style.display = "none";
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
}

// 添加拖动功能相关代码
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

// 保存面板位置到localStorage
function savePanelPosition() {
    const panel = document.getElementById('serverStatusPanel');
    if (panel) {
        const position = {
            x: xOffset,
            y: yOffset
        };
        localStorage.setItem('serverStatusPosition', JSON.stringify(position));
    }
}

// 从localStorage加载面板位置
function loadPanelPosition() {
    const panel = document.getElementById('serverStatusPanel');
    if (panel) {
        const savedPosition = localStorage.getItem('serverStatusPosition');
        if (savedPosition) {
            const position = JSON.parse(savedPosition);
            xOffset = position.x;
            yOffset = position.y;
            setTranslate(xOffset, yOffset, panel);
        }
    }
}

// 重置面板位置
function resetPosition(e) {
    e.stopPropagation(); // 防止事件冒泡
    const panel = document.getElementById('serverStatusPanel');
    if (panel) {
        xOffset = 0;
        yOffset = 0;
        setTranslate(0, 0, panel);
        savePanelPosition();
    }
}

// 设置面板位置
function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// 开始拖动
function dragStart(e) {
    if (e.type === "touchstart") {
        initialX = e.touches[0].clientX - xOffset;
        initialY = e.touches[0].clientY - yOffset;
    } else {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
    }

    const header = e.target.closest('#serverStatusHeader');
    if (header) {
        isDragging = true;
        const panel = document.getElementById('serverStatusPanel');
        panel.classList.add('dragging');
    }
}

// 拖动中
function drag(e) {
    if (isDragging) {
        e.preventDefault();
        
        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        const panel = document.getElementById('serverStatusPanel');
        setTranslate(currentX, currentY, panel);
    }
}

// 结束拖动
function dragEnd(e) {
    if (isDragging) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        
        const panel = document.getElementById('serverStatusPanel');
        panel.classList.remove('dragging');
        savePanelPosition();
    }
}

// 修改toggleServerStatus函数，阻止事件冒泡
function toggleServerStatus(e) {
    if (e) {
        e.stopPropagation(); // 防止事件冒泡
    }
    const statusPanel = document.querySelector('.server-status.admin-view');
    const statusItems = statusPanel.querySelectorAll('.status-item, .status-label:not(:first-child)');
    const toggleBtn = statusPanel.querySelector('button:last-child');

    if (isServerStatusMinimized) {
        statusItems.forEach(item => item.style.display = 'block');
        statusPanel.style.width = '300px';
        toggleBtn.textContent = '最小化';
    } else {
        statusItems.forEach(item => item.style.display = 'none');
        statusPanel.style.width = '150px';
        toggleBtn.textContent = '展开';
    }
    
    isServerStatusMinimized = !isServerStatusMinimized;
}

// 页面加载完成后初始化拖动功能
document.addEventListener('DOMContentLoaded', function() {
    const panel = document.getElementById('serverStatusPanel');
    const isAdmin = window.CHAT_CONFIG.currentUser.isAdmin === "true";
    
    // 立即更新一次状态
    updateServerStatus();
    
    // 根据用户角色设置不同的更新频率
    if (isAdmin) {
        // 管理员每1秒更新一次
        setInterval(updateServerStatus, 1000);
    } else {
        // 普通用户每10秒更新一次
        setInterval(updateServerStatus, 10000);
    }

    if (panel) {
        // 加载保存的位置
        loadPanelPosition();

        // 添加拖动事件监听器
        panel.addEventListener('mousedown', dragStart, false);
        document.addEventListener('mousemove', drag, false);
        document.addEventListener('mouseup', dragEnd, false);

        // 添加触摸事件支持
        panel.addEventListener('touchstart', dragStart, false);
        document.addEventListener('touchmove', drag, false);
        document.addEventListener('touchend', dragEnd, false);
    }
});

// 修改更新服务器状态的函数
let isServerStatusMinimized = false;
async function updateServerStatus() {
    try {
        const response = await fetch('/server_status');
        const data = await response.json();
        
        // 更新管理员视图（如果存在）
        const adminPanel = document.querySelector('.server-status.admin-view');
        if (adminPanel) {
            // 更新CPU和内存
            document.getElementById('cpu-value-admin').textContent = `${Math.round(data.cpu_usage)}%`;
            document.getElementById('cpu-progress-admin').style.width = `${data.cpu_usage}%`;
            document.getElementById('memory-value-admin').textContent = `${Math.round(data.memory_usage)}%`;
            document.getElementById('memory-progress-admin').style.width = `${data.memory_usage}%`;
            
            // 更新硬盘使用状态
            document.getElementById('disk-value-admin').textContent = `${Math.round(data.disk_usage)}%`;
            document.getElementById('disk-progress-admin').style.width = `${data.disk_usage}%`;
            document.getElementById('disk-details-admin').textContent = 
                `总容量: ${data.disk_total}GB | 已用: ${data.disk_used}GB | 可用: ${data.disk_free}GB`;
            
            updateStatusIndicator('system-status-admin', data);
        }
        
        // 更新用户视图（如果存在）
        const userPanel = document.querySelector('.server-status.user-view');
        if (userPanel) {
            document.getElementById('cpu-value').textContent = `${Math.round(data.cpu_usage)}%`;
            document.getElementById('cpu-progress').style.width = `${data.cpu_usage}%`;
            document.getElementById('memory-value').textContent = `${Math.round(data.memory_usage)}%`;
            document.getElementById('memory-progress').style.width = `${data.memory_usage}%`;
            updateStatusIndicator('system-status', data);
        }

        // 如果是管理员视图且负载过高，自动展开最小化的面板
        if ((data.cpu_usage > 90 || data.memory_usage > 90 || data.disk_usage > 90) && 
            isServerStatusMinimized && 
            adminPanel) {
            toggleServerStatus();
        }
    } catch (error) {
        console.error('获取服务器状态失败:', error);
    }
}

// 修改状态指示器的判断逻辑
function updateStatusIndicator(elementId, data) {
    const systemStatus = document.getElementById(elementId);
    if (!systemStatus) return;

    if (data.cpu_usage > 90 || data.memory_usage > 90 || data.disk_usage > 90) {
        systemStatus.innerHTML = `
            <span class="status-indicator critical"></span>
            系统负载过高
        `;
    } else if (data.cpu_usage > 70 || data.memory_usage > 70 || data.disk_usage > 80) {
        systemStatus.innerHTML = `
            <span class="status-indicator warning"></span>
            负载较高
        `;
    } else {
        systemStatus.innerHTML = `
            <span class="status-indicator good"></span>
            正常运行中
        `;
    }
}

// 更新消息的已读未读状态
function updateMessageReadStatus(messageId, readBy, unreadBy) {
    console.log('更新消息状态:', messageId, readBy, unreadBy);
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) {
        console.log('未找到消息元素:', messageId);
        return;
    }

    const statusElement = messageElement.querySelector('.message-status');
    if (!statusElement) {
        console.log('未找到状态元素:', messageId);
        return;
    }

    // 更新已读未读状态显示
    let statusHtml = '<div class="read-status">';
    
    // 显示已读用户
    if (readBy && readBy.length > 0) {
        statusHtml += `<span class="read-by">已读: ${readBy.join(', ')}</span>`;
    }
    
    // 如果既有已读也有未读用户，添加分隔符
    if (readBy && readBy.length > 0 && unreadBy && unreadBy.length > 0) {
        statusHtml += ' | ';
    }
    
    // 显示未读用户
    if (unreadBy && unreadBy.length > 0) {
        statusHtml += `<span class="unread-by">未读: ${unreadBy.join(', ')}</span>`;
    }
    
    statusHtml += '</div>';
    statusElement.innerHTML = statusHtml;
}

// 使用Intersection Observer监控消息是否可见
const messageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
                markMessageAsRead(messageId);
            }
        }
    });
}, {
    threshold: 0.5 // 当消息显示50%以上时触发
});

// 在添加新消息时注册观察
function addMessage(message) {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    messageElement.setAttribute('data-message-id', message._id || message.id);

    // 判断消息是否来自当前用户
    const isCurrentUser = message.username === window.CHAT_CONFIG.currentUser.username;
    messageElement.classList.add(isCurrentUser ? 'sent' : 'received');

    // 构建消息内容
    let messageContent = `
        <div class="message-header">
            <img src="${message.avatar_url}" alt="头像" class="message-avatar" onclick="showUserInfo('${message.username}')">
            <span class="message-username" onclick="showUserInfo('${message.username}')">${message.username}</span>
            <span class="message-time">${message.timestamp}</span>
        </div>
        <div class="message-content">
            ${message.type === 'file' 
                ? renderFileMessage(message)
                : `<p class="message-text">${formatMessageText(message.text)}</p>`
            }
        </div>
        <div class="message-status">
            <div class="read-status">
                ${message.read_by && message.read_by.length > 0 
                    ? `<span class="read-by">已读: ${message.read_by.join(', ')}</span>` 
                    : ''}
                ${message.read_by && message.read_by.length > 0 && message.unread_by && message.unread_by.length > 0 
                    ? ' | ' 
                    : ''}
                ${message.unread_by && message.unread_by.length > 0 
                    ? `<span class="unread-by">未读: ${message.unread_by.join(', ')}</span>` 
                    : ''}
            </div>
        </div>
    `;

    messageElement.innerHTML = messageContent;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // 注册消息观察
    messageObserver.observe(messageElement);
}

// 渲染文件消息
function renderFileMessage(message) {
    const fileExtension = message.filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
        return `<img src="${message.url}" alt="图片" class="message-image" onclick="showImagePreview('${message.url}')">`;
    } else {
        return `
            <a href="${message.url}" target="_blank" class="file-link">
                <span class="file-icon">📎</span>
                <span class="file-name">${message.filename}</span>
                <span class="file-size">(${formatFileSize(message.size)})</span>
            </a>
        `;
    }
}

// 在页面关闭或切换时，发送消息未读状态
window.addEventListener('beforeunload', () => {
    const visibleMessages = document.querySelectorAll('.message');
    visibleMessages.forEach(message => {
        const messageId = message.getAttribute('data-message-id');
        if (messageId) {
            socket.emit('mark_message_unread', {
                message_id: messageId
            });
        }
    });
});
