from flask import Blueprint, render_template, Flask, current_app, request, redirect, url_for, flash, jsonify  # 添加 request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user  # 添加 login_user, logout_user, login_required
from config import db_config
from .extensions import *
from .models import User  #
from . import socketio
from datetime import datetime


bp = Blueprint('main', __name__)


@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        print(f"尝试登录: {username}")  # 调试日志
        
        user_data = current_app.db.users.find_one({'username': username})
        print(f"数据库查询结果: {user_data}")  # 调试日志
        
        if user_data:
            user = User(user_data['username'], user_data['password'])
            if user.check_password(password):
                print("密码验证成功")  # 调试日志
                login_user(user)
                return redirect(url_for('main.index'))
            print("密码验证失败")  # 调试日志
        flash('用户名或密码错误')
    return render_template('login.html')


@bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('main.login'))


@bp.route('/')
@login_required
def index():
    return render_template('chat.html')


@bp.route('/admin', methods=['GET', 'POST'])
def admin():
    if not current_user.is_authenticated or not current_user.is_admin:
        flash('只有管理员可以访问此页面')
        return redirect(url_for('main.login'))
        
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        is_admin = 'is_admin' in request.form
        
        # 检查是否是编辑操作
        edit_username = request.form.get('editUsername')
        if edit_username:
            # 更新用户信息
            current_app.db.users.update_one(
                {'username': edit_username},
                {'$set': {
                    'username': username,
                    'password': password,
                    'is_admin': is_admin
                }}
            )
            flash('用户更新成功')
        else:
            # 创建新用户
            if not current_app.db.users.find_one({'username': username}):
                current_app.db.users.insert_one({
                    'username': username,
                    'password': password,
                    'is_admin': is_admin,
                    'created_at': datetime.now(),
                    'status': '正常'  # 添加状态字段
                })
                flash('用户创建成功')
            else:
                flash('用户已存在')
    
    # 获取所有用户并添加默认值
    users = list(current_app.db.users.find())
    for user in users:
        if 'created_at' not in user:
            user['created_at'] = None
        if 'status' not in user:
            user['status'] = '正常'
    
    return render_template('admin.html', users=users)


@bp.route('/admin/delete/<username>', methods=['POST'])
def delete_user(username):
    if not current_user.is_authenticated or not current_user.is_admin:
        return jsonify({'success': False, 'message': '无权限'})
    
    if username == 'admin':
        return jsonify({'success': False, 'message': '不能删除管理员账号'})
    
    current_app.db.users.delete_one({'username': username})
    return jsonify({'success': True})


@bp.route('/admin/reset_password/<username>', methods=['POST'])
def reset_password(username):
    if not current_user.is_authenticated or not current_user.is_admin:
        return jsonify({'success': False, 'message': '无权限'})
    
    # 重置为默认密码
    current_app.db.users.update_one(
        {'username': username},
        {'$set': {'password': '123456'}}
    )
    return jsonify({'success': True, 'message': f'用户 {username} 的密码已重置为: 123456'})


@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return False  # 阻止未登录用户连接
    messages = current_app.db.messages.find()
    for message in messages:
        # 确保消息数据是字典格式
        if isinstance(message.get('message'), dict):
            msg_data = message['message']
        else:
            # 如果是旧格式的消息，转换为新格式
            msg_data = {
                'text': message.get('message', ''),
                'username': current_user.username,
                'timestamp': datetime.now().strftime('%H:%M')
            }
        emit('message', msg_data)


@socketio.on('message')
@login_required
def handle_message(data):
    message_data = {
        'text': data,
        'username': current_user.username,
        'timestamp': datetime.now().strftime('%H:%M')
    }
    current_app.db.messages.insert_one({'message': message_data})
    emit('message', message_data, broadcast=True)


