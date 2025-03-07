function showAddModal() {
    document.getElementById('modalTitle').textContent = '添加用户';
    document.getElementById('userForm').reset();
    document.getElementById('editUsername').value = '';
    document.getElementById('userModal').style.display = 'flex';
}

function showEditModal(username) {
    document.getElementById('modalTitle').textContent = '编辑用户';
    document.getElementById('editUsername').value = username;
    document.getElementById('username').value = username;
    document.getElementById('userModal').style.display = 'flex';
}

function hideModal() {
    document.getElementById('userModal').style.display = 'none';
}

function deleteUser(username) {
    if (confirm('确定要删除用户 ' + username + ' 吗？')) {
        fetch('/admin/delete/' + username, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert(data.message);
                }
            });
    }
}

function resetPassword(username) {
    if (confirm('确定要重置用户 ' + username + ' 的密码吗？')) {
        fetch('/admin/reset_password/' + username, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                alert(data.message);
            });
    }
}

// 点击模态框外部关闭
window.onclick = function(event) {
    if (event.target == document.getElementById('userModal')) {
        hideModal();
    }
} 