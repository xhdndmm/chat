// 服务器状态监控脚本

// 图表数据存储
const chartData = {
    cpu: [],
    memory: [],
    disk: [],
    swap: [],
    network: {
        sent: [],
        received: []
    }
};

// 图表配置
const chartConfig = {
    maxDataPoints: 60, // 最多显示60个数据点
    updateInterval: 1000, // 更新间隔（毫秒）
    colors: {
        cpu: '#2196F3',
        memory: '#FF9800',
        disk: '#9C27B0',
        swap: '#F44336',
        networkSent: '#4CAF50',
        networkReceived: '#00BCD4'
    }
};

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

// 更新图表数据
function updateChartData(data) {
    const timestamp = new Date().getTime();
    
    // 更新CPU数据
    chartData.cpu.push({
        time: timestamp,
        value: data.cpu.usage
    });
    
    // 更新内存数据
    chartData.memory.push({
        time: timestamp,
        value: data.memory.usage
    });
    
    // 更新硬盘数据
    chartData.disk.push({
        time: timestamp,
        value: data.disk.usage
    });
    
    // 更新SWAP数据
    chartData.swap.push({
        time: timestamp,
        value: data.swap.usage
    });
    
    // 更新网络数据
    chartData.network.sent.push({
        time: timestamp,
        value: data.network.sent
    });
    chartData.network.received.push({
        time: timestamp,
        value: data.network.received
    });
    
    // 限制数据点数量
    Object.keys(chartData).forEach(key => {
        if (Array.isArray(chartData[key])) {
            if (chartData[key].length > chartConfig.maxDataPoints) {
                chartData[key].shift();
            }
        } else if (typeof chartData[key] === 'object') {
            Object.keys(chartData[key]).forEach(subKey => {
                if (chartData[key][subKey].length > chartConfig.maxDataPoints) {
                    chartData[key][subKey].shift();
                }
            });
        }
    });
}

// 绘制图表
function drawCharts() {
    // 绘制CPU使用率图表
    drawChart('cpuChart', chartData.cpu, 'CPU使用率 (%)', chartConfig.colors.cpu);
    
    // 绘制内存使用率图表
    drawChart('memoryChart', chartData.memory, '内存使用率 (%)', chartConfig.colors.memory);
    
    // 绘制硬盘使用率图表
    drawChart('diskChart', chartData.disk, '硬盘使用率 (%)', chartConfig.colors.disk);
    
    // 绘制SWAP使用率图表
    drawChart('swapChart', chartData.swap, 'SWAP使用率 (%)', chartConfig.colors.swap);
    
    // 绘制网络流量图表
    drawNetworkChart('networkChart', chartData.network);
}

// 绘制单个图表
function drawChart(canvasId, data, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // 绘制数据线
    if (data.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        data.forEach((point, index) => {
            const x = (width * index) / (chartConfig.maxDataPoints - 1);
            const y = height - (point.value * height) / 100;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }
    
    // 绘制标签
    ctx.fillStyle = '#333';
    ctx.font = '12px "Segoe UI"';
    ctx.fillText(label, 10, 20);
}

// 绘制网络流量图表
function drawNetworkChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 清空画布
    ctx.clearRect(0, 0, width, height);
    
    // 绘制网格
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (height * i) / 4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // 绘制发送数据线
    if (data.sent.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = chartConfig.colors.networkSent;
        ctx.lineWidth = 2;
        
        data.sent.forEach((point, index) => {
            const x = (width * index) / (chartConfig.maxDataPoints - 1);
            const y = height - (point.value * height) / 100;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }
    
    // 绘制接收数据线
    if (data.received.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = chartConfig.colors.networkReceived;
        ctx.lineWidth = 2;
        
        data.received.forEach((point, index) => {
            const x = (width * index) / (chartConfig.maxDataPoints - 1);
            const y = height - (point.value * height) / 100;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }
    
    // 绘制标签
    ctx.fillStyle = '#333';
    ctx.font = '12px "Segoe UI"';
    ctx.fillText('网络流量 (MB/s)', 10, 20);
}

// 更新管理员视图
function updateAdminView(data) {
    if (!data) return;
    
    // 更新图表数据
    updateChartData(data);
    
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
    
    // 更新网络状态
    const networkSentValue = document.querySelector('.network-sent-value');
    const networkReceivedValue = document.querySelector('.network-received-value');
    if (networkSentValue && networkReceivedValue) {
        networkSentValue.textContent = `${data.network.sent} MB/s`;
        networkReceivedValue.textContent = `${data.network.received} MB/s`;
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
    
    // 绘制图表
    drawCharts();
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
    
    // 在小屏幕设备上默认最小化
    if (window.innerWidth <= 480) {
        adminView.classList.add('minimized');
    }
    
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
                <div class="chart-container">
                    <canvas id="cpuChart" width="400" height="200"></canvas>
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
                <div class="chart-container">
                    <canvas id="diskChart" width="400" height="200"></canvas>
                </div>
            </div>
            
            <div class="status-section">
                <h5>网络</h5>
                <div class="network-stats">
                    <div class="network-stat">
                        <div class="network-stat-title">发送</div>
                        <div class="network-stat-value network-sent-value">0 MB/s</div>
                    </div>
                    <div class="network-stat">
                        <div class="network-stat-title">接收</div>
                        <div class="network-stat-value network-received-value">0 MB/s</div>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="networkChart" width="400" height="200"></canvas>
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
            // 检查是否是管理员
            const isAdmin = window.CHAT_CONFIG && window.CHAT_CONFIG.currentUser && window.CHAT_CONFIG.currentUser.isAdmin;
            
            if (isAdmin) {
                updateAdminView(data);
            } else {
                updateUserView(data);
            }
        }
    } catch (error) {
        console.error('更新服务器状态出错:', error);
    }
}

// 使元素可拖动（优化版本）
function makeDraggable(element) {
    const header = element.querySelector('.status-header');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.addEventListener('mousedown', dragStart);
    
    function dragStart(e) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        
        if (e.target === header || e.target.parentNode === header) {
            isDragging = true;
        }
    }
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            xOffset = currentX;
            yOffset = currentY;
            
            setTranslate(currentX, currentY, element);
        }
    }
    
    function dragEnd() {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }
    
    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }
}

// 当页面加载完成时初始化
document.addEventListener('DOMContentLoaded', initServerStatus); 