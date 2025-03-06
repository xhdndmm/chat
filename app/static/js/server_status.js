// 服务器状态监控脚本

// 从后端API获取服务器状态数据
async function getServerStatus() {
    try {
        const response = await fetch('/api/server_status');
        if (!response.ok) {
            throw new Error('获取服务器状态失败');
        }
        return await response.json();
    } catch (error) {
        console.error('获取服务器状态出错:', error);
        // 如果API调用失败，显示错误信息
        showErrorMessage('无法获取服务器状态数据');
        return null;
    }
}

// 显示错误信息
function showErrorMessage(message) {
    // 普通用户视图错误显示
    const userStatusElement = document.querySelector('.server-status-user');
    if (userStatusElement) {
        userStatusElement.innerHTML = `
            <h4>服务器状态</h4>
            <div class="error-message">${message}</div>
        `;
    }
    
    // 管理员视图错误显示
    const adminStatusElement = document.querySelector('.server-status-admin');
    if (adminStatusElement) {
        adminStatusElement.querySelector('.status-body').innerHTML = `
            <div class="error-message">${message}</div>
        `;
    }
}

// 更新普通用户视图
function updateUserView(data) {
    if (!data) return;
    
    const cpuFill = document.querySelector('.cpu-fill');
    const cpuValue = document.querySelector('.cpu-value');
    const memoryFill = document.querySelector('.memory-fill');
    const memoryValue = document.querySelector('.memory-value');
    
    if (cpuFill && cpuValue) {
        cpuFill.style.width = `${data.cpu.usage}%`;
        cpuValue.textContent = `${data.cpu.usage}%`;
    }
    
    if (memoryFill && memoryValue) {
        memoryFill.style.width = `${data.memory.usage}%`;
        memoryValue.textContent = `${data.memory.usage}% (${Math.round(data.memory.used/1024*10)/10}GB/${Math.round(data.memory.total/1024*10)/10}GB)`;
    }
}

// 更新管理员视图
function updateAdminView(data) {
    if (!data) return;
    
    // 更新CPU使用率
    const adminCpuFill = document.querySelector('.admin-cpu-fill');
    const adminCpuValue = document.querySelector('.admin-cpu-value');
    if (adminCpuFill && adminCpuValue) {
        adminCpuFill.style.width = `${data.cpu.usage}%`;
        adminCpuValue.textContent = `${data.cpu.usage}%`;
    }
    
    // 更新内存使用率
    const adminMemoryFill = document.querySelector('.admin-memory-fill');
    const adminMemoryValue = document.querySelector('.admin-memory-value');
    if (adminMemoryFill && adminMemoryValue) {
        adminMemoryFill.style.width = `${data.memory.usage}%`;
        adminMemoryValue.textContent = `${data.memory.usage}% (${Math.round(data.memory.used/1024*10)/10}GB/${Math.round(data.memory.total/1024*10)/10}GB)`;
    }
    
    // 更新硬盘使用率
    const adminDiskFill = document.querySelector('.admin-disk-fill');
    const adminDiskValue = document.querySelector('.admin-disk-value');
    if (adminDiskFill && adminDiskValue) {
        adminDiskFill.style.width = `${data.disk.usage}%`;
        adminDiskValue.textContent = `${data.disk.usage}% (${data.disk.used}GB/${data.disk.total}GB)`;
    }
    
    // 更新SWAP使用率
    const adminSwapFill = document.querySelector('.admin-swap-fill');
    const adminSwapValue = document.querySelector('.admin-swap-value');
    if (adminSwapFill && adminSwapValue) {
        adminSwapFill.style.width = `${data.swap.usage}%`;
        adminSwapValue.textContent = `${data.swap.usage}% (${Math.round(data.swap.used/1024*10)/10}GB/${Math.round(data.swap.total/1024*10)/10}GB)`;
    }
    
    // 更新IO使用率
    const adminIoFill = document.querySelector('.admin-io-fill');
    const adminIoValue = document.querySelector('.admin-io-value');
    if (adminIoFill && adminIoValue) {
        adminIoFill.style.width = `${data.io.usage}%`;
        adminIoValue.textContent = `读取: ${data.io.read}MB/s | 写入: ${data.io.write}MB/s`;
    }
    
    // 更新CPU核心
    const coresContainer = document.querySelector('.cpu-cores');
    if (coresContainer && data.cpu.cores) {
        coresContainer.innerHTML = '';
        data.cpu.cores.forEach(core => {
            const coreElement = document.createElement('div');
            coreElement.className = 'cpu-core';
            coreElement.innerHTML = `
                <div class="core-title">核心 ${core.id}</div>
                <div class="metric-bar">
                    <div class="metric-fill cpu-fill" style="width: ${core.usage}%"></div>
                </div>
                <div class="metric-value">${core.usage}%</div>
            `;
            coresContainer.appendChild(coreElement);
        });
    }
}

// 初始化服务器状态监控
function initServerStatus() {
    // 检查是否是管理员
    const isAdmin = window.CHAT_CONFIG && window.CHAT_CONFIG.currentUser && window.CHAT_CONFIG.currentUser.isAdmin;
    
    // 创建普通用户视图
    createUserView();
    
    // 如果是管理员，创建管理员视图
    if (isAdmin) {
        createAdminView();
    }
    
    // 定期更新状态
    updateStatus();
    setInterval(updateStatus, 3000);
}

// 创建普通用户视图
function createUserView() {
    const devTeam = document.querySelector('.dev-team');
    if (!devTeam) return;
    
    const serverStatus = document.createElement('div');
    serverStatus.className = 'server-status-user';
    serverStatus.innerHTML = `
        <h4>服务器状态</h4>
        <div class="status-metrics">
            <div class="metric">
                <div class="metric-title">CPU</div>
                <div class="metric-bar">
                    <div class="metric-fill cpu-fill" style="width: 0%"></div>
                </div>
                <div class="metric-value cpu-value">0%</div>
            </div>
            <div class="metric">
                <div class="metric-title">内存</div>
                <div class="metric-bar">
                    <div class="metric-fill memory-fill" style="width: 0%"></div>
                </div>
                <div class="metric-value memory-value">0%</div>
            </div>
        </div>
    `;
    
    devTeam.after(serverStatus);
}

// 创建管理员视图
function createAdminView() {
    const adminView = document.createElement('div');
    adminView.className = 'server-status-admin';
    adminView.innerHTML = `
        <div class="status-header">
            <h4>服务器状态监控</h4>
            <div class="status-controls">
                <button class="status-control minimize-btn" title="最小化">-</button>
                <button class="status-control maximize-btn" title="最大化">□</button>
                <button class="status-control close-btn" title="关闭">×</button>
            </div>
        </div>
        <div class="status-body">
            <div class="status-section essential">
                <h5>基本信息</h5>
                <div class="status-metrics">
                    <div class="metric">
                        <div class="metric-title">CPU</div>
                        <div class="metric-bar">
                            <div class="metric-fill cpu-fill admin-cpu-fill" style="width: 0%"></div>
                        </div>
                        <div class="metric-value admin-cpu-value">0%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-title">内存</div>
                        <div class="metric-bar">
                            <div class="metric-fill memory-fill admin-memory-fill" style="width: 0%"></div>
                        </div>
                        <div class="metric-value admin-memory-value">0%</div>
                    </div>
                </div>
            </div>
            
            <div class="status-section">
                <h5>存储</h5>
                <div class="status-metrics">
                    <div class="metric">
                        <div class="metric-title">硬盘</div>
                        <div class="metric-bar">
                            <div class="metric-fill disk-fill admin-disk-fill" style="width: 0%"></div>
                        </div>
                        <div class="metric-value admin-disk-value">0%</div>
                    </div>
                    <div class="metric">
                        <div class="metric-title">SWAP</div>
                        <div class="metric-bar">
                            <div class="metric-fill swap-fill admin-swap-fill" style="width: 0%"></div>
                        </div>
                        <div class="metric-value admin-swap-value">0%</div>
                    </div>
                </div>
            </div>
            
            <div class="status-section">
                <h5>I/O</h5>
                <div class="status-metrics">
                    <div class="metric">
                        <div class="metric-title">磁盘 I/O</div>
                        <div class="metric-bar">
                            <div class="metric-fill io-fill admin-io-fill" style="width: 0%"></div>
                        </div>
                        <div class="metric-value admin-io-value">读取: 0MB/s | 写入: 0MB/s</div>
                    </div>
                </div>
            </div>
            
            <div class="status-section">
                <h5>CPU 核心</h5>
                <div class="cpu-cores">
                    <!-- CPU核心信息将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(adminView);
    
    // 添加事件监听器
    const minimizeBtn = adminView.querySelector('.minimize-btn');
    const maximizeBtn = adminView.querySelector('.maximize-btn');
    const closeBtn = adminView.querySelector('.close-btn');
    
    minimizeBtn.addEventListener('click', () => {
        adminView.classList.add('minimized');
        adminView.classList.remove('maximized');
    });
    
    maximizeBtn.addEventListener('click', () => {
        if (adminView.classList.contains('maximized')) {
            adminView.classList.remove('maximized');
        } else {
            adminView.classList.add('maximized');
            adminView.classList.remove('minimized');
        }
    });
    
    closeBtn.addEventListener('click', () => {
        adminView.style.display = 'none';
    });
    
    // 添加拖动功能
    makeDraggable(adminView);
}

// 更新状态
async function updateStatus() {
    try {
        const data = await getServerStatus();
        if (data) {
            updateUserView(data);
            
            // 如果管理员视图存在，更新它
            const adminView = document.querySelector('.server-status-admin');
            if (adminView && adminView.style.display !== 'none') {
                updateAdminView(data);
            }
        }
    } catch (error) {
        console.error('更新服务器状态出错:', error);
    }
}

// 使元素可拖动
function makeDraggable(element) {
    const header = element.querySelector('.status-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    header.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // 获取鼠标位置
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        // 鼠标移动时调用函数
        document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // 计算新位置
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // 设置元素的新位置
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        element.style.bottom = "auto";
        element.style.right = "auto";
    }
    
    function closeDragElement() {
        // 停止移动
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', initServerStatus); 