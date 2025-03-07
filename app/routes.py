from flask import Blueprint, render_template, Flask, current_app, request, redirect, url_for, flash, jsonify  # 添加 request, redirect, url_for, flash, jsonify
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user  # 添加 login_user, logout_user, login_required
from config import db_config
from .extensions import *
from .models import User  #
from . import socketio
from datetime import datetime
from bson import ObjectId
import os
from werkzeug.utils import secure_filename
import time
from config.log_config import logger
from functools import wraps
import zipfile
import io
from werkzeug.security import generate_password_hash, check_password_hash
import json
import uuid
import shutil
import psutil


bp = Blueprint('main', __name__)


# 配置文件上传
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app', 'static', 'uploads')
ALLOWED_EXTENSIONS = {
    # 文本文件
    'txt', 'log', 'md',
    # 数据文件
    'json', 'xml', 'yaml', 'yml',
    # 网页文件
    'html', 'htm', 'css', 'js',
    # 文档文件
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf',
    # 压缩文件
    'zip', 'rar', '7z', 'tar', 'gz',
    # 图片文件
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'webm',
    # 视频文件
    'mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v',
    # 代码文件
    'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'sql'
}

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm', 'ogg'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

AVATAR_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app', 'static', 'avatars')
ALLOWED_AVATAR_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

# 确保头像目录存在
os.makedirs(AVATAR_FOLDER, exist_ok=True)

def allowed_avatar(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_AVATAR_EXTENSIONS


# 添加管理员验证装饰器
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            flash('您没有权限访问此页面')
            return redirect(url_for('main.login'))
        return f(*args, **kwargs)
    return decorated_function


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
    user_agent = request.headers.get('User-Agent').lower()
    if 'mobile' in user_agent:
        return redirect(url_for('main.mobile_chat'))
    return render_template('chat.html')


# 添加系统设置集合的初始化
def init_system_settings(db):
    """初始化系统设置"""
    if not db.system_settings.find_one():
        db.system_settings.insert_one({
            'register_mode': 'apply',  # 默认为申请注册模式
        })

# 获取系统设置
def get_system_settings():
    """获取系统设置"""
    settings = current_app.db.system_settings.find_one()
    if not settings:
        init_system_settings(current_app.db)
        settings = current_app.db.system_settings.find_one()
    return settings

@bp.route('/register', methods=['GET', 'POST'])
def register():
    """用户注册页面"""
    # 获取注册模式
    settings = get_system_settings()
    register_mode = settings.get('register_mode', 'apply')
    
    # 如果是禁止注册模式，直接显示禁止注册页面
    if register_mode == 'disabled' and request.method == 'GET':
        return render_template('register.html', register_mode=register_mode)
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        introduction = request.form.get('introduction', '')
        
        # 验证用户输入
        if not username or not password:
            flash('用户名和密码不能为空')
            return render_template('register.html', register_mode=register_mode)
        
        if password != confirm_password:
            flash('两次输入的密码不一致')
            return render_template('register.html', register_mode=register_mode)
        
        # 检查用户名是否已存在
        if current_app.db.users.find_one({'username': username}):
            flash('用户名已存在')
            return render_template('register.html', register_mode=register_mode)
        
        # 处理头像上传
        avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}"  # 默认头像
        avatar_file = request.files.get('avatar')
        if avatar_file and avatar_file.filename and allowed_avatar(avatar_file.filename):
            try:
                filename = secure_filename(f"{username}_{int(time.time())}{os.path.splitext(avatar_file.filename)[1]}")
                avatar_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'avatars', filename)
                os.makedirs(os.path.dirname(avatar_path), exist_ok=True)
                avatar_file.save(avatar_path)
                avatar_url = url_for('static', filename=f'uploads/avatars/{filename}')
                logger.info(f"用户 {username} 上传了头像: {filename}")
            except Exception as e:
                logger.error(f"头像上传失败: {str(e)}")
                # 上传失败时使用默认头像，不影响注册流程
        else:
            logger.info(f"用户 {username} 使用默认头像")
        
        # 根据注册模式处理注册
        if register_mode == 'direct':
            # 直接注册模式，创建用户
            current_app.db.users.insert_one({
                'username': username,
                'password': password,
                'is_admin': False,
                'avatar_url': avatar_url,
                'introduction': introduction,
                'created_at': datetime.now(),
                'status': '正常',
                'settings': {
                    'theme': 'light',
                    'notification': True,
                    'display_name': username,
                    'bio': introduction,
                    'email': ''
                }
            })
            flash('注册成功，请登录')
            return redirect(url_for('main.login'))
        elif register_mode == 'apply':
            # 申请注册模式，创建注册申请
            apply_reason = request.form.get('apply_reason', '')
            current_app.db.register_applications.insert_one({
                'username': username,
                'password': password,
                'avatar_url': avatar_url,
                'introduction': introduction,
                'apply_reason': apply_reason,
                'created_at': datetime.now(),
                'status': 'pending'  # 待审核
            })
            flash('申请已提交，请等待管理员审核')
            return redirect(url_for('main.login'))
    
    return render_template('register.html', register_mode=register_mode)

@bp.route('/admin/application_detail/<application_id>')
@login_required
@admin_required
def application_detail(application_id):
    """获取注册申请详情"""
    try:
        app = current_app.db.register_applications.find_one({'_id': ObjectId(application_id)})
        if not app:
            return jsonify({'error': '申请不存在'}), 404
        
        # 转换ObjectId为字符串
        app['_id'] = str(app['_id'])
        # 格式化时间
        app['created_at'] = app['created_at'].strftime('%Y-%m-%d %H:%M:%S')
        
        return jsonify(app)
    except Exception as e:
        logger.error(f"获取申请详情失败: {str(e)}")
        return jsonify({'error': '获取申请详情失败'}), 500

@bp.route('/admin/approve_application/<application_id>', methods=['POST'])
@login_required
@admin_required
def approve_application(application_id):
    """批准注册申请"""
    try:
        app = current_app.db.register_applications.find_one({'_id': ObjectId(application_id)})
        if not app:
            return jsonify({'success': False, 'message': '申请不存在'}), 404
        
        # 创建用户
        current_app.db.users.insert_one({
            'username': app['username'],
            'password': app['password'],
            'is_admin': False,
            'avatar_url': app['avatar_url'],
            'introduction': app.get('introduction', ''),
            'created_at': datetime.now(),
            'status': '正常',
            'settings': {
                'theme': 'light',
                'notification': True,
                'display_name': app['username'],
                'bio': app.get('introduction', ''),
                'email': ''
            }
        })
        
        # 更新申请状态
        current_app.db.register_applications.update_one(
            {'_id': ObjectId(application_id)},
            {'$set': {'status': 'approved'}}
        )
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"批准申请失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@bp.route('/admin/reject_application/<application_id>', methods=['POST'])
@login_required
@admin_required
def reject_application(application_id):
    """拒绝注册申请"""
    try:
        app = current_app.db.register_applications.find_one({'_id': ObjectId(application_id)})
        if not app:
            return jsonify({'success': False, 'message': '申请不存在'}), 404
        
        # 更新申请状态
        current_app.db.register_applications.update_one(
            {'_id': ObjectId(application_id)},
            {'$set': {'status': 'rejected'}}
        )
        
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"拒绝申请失败: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@bp.route('/update_settings', methods=['POST'])
@login_required
@admin_required
def update_settings():
    """更新系统设置"""
    try:
        register_mode = request.form.get('register_mode', 'apply')
        
        # 更新系统设置
        current_app.db.system_settings.update_one(
            {},
            {'$set': {'register_mode': register_mode}},
            upsert=True
        )
        
        flash('系统设置已更新')
        return redirect(url_for('main.admin'))
    except Exception as e:
        logger.error(f"更新系统设置失败: {str(e)}")
        flash('更新系统设置失败')
        return redirect(url_for('main.admin'))

# 修改管理员页面路由，添加注册申请和系统设置
@bp.route('/admin', methods=['GET', 'POST'])
@login_required
@admin_required
def admin():
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
                    'status': '正常'
                })
                flash('用户创建成功')
            else:
                flash('用户已存在')

    users = list(current_app.db.users.find())
    
    # 获取注册申请
    register_applications = list(current_app.db.register_applications.find({'status': 'pending'}))
    
    # 获取系统设置
    system_settings = get_system_settings()
    
    return render_template('admin.html', users=users, register_applications=register_applications, system_settings=system_settings)


@bp.route('/admin/delete/<username>', methods=['POST'])
@login_required
@admin_required  # 添加管理员验证
def delete_user(username):
    if username == 'admin':
        return jsonify({'success': False, 'message': '不能删除管理员账号'})

    current_app.db.users.delete_one({'username': username})
    return jsonify({'success': True})


@bp.route('/admin/reset_password/<username>', methods=['POST'])
@login_required
@admin_required  # 添加管理员验证
def reset_password(username):
    current_app.db.users.update_one(
        {'username': username},
        {'$set': {'password': '123456'}}
    )
    return jsonify({'success': True, 'message': f'用户 {username} 的密码已重置为: 123456'})


@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        logger.info(f"User {current_user.username} connected")
        # 存储用户连接信息
        connected_users[request.sid] = current_user.username
        
        # 发送在线状态给所有用户
        emit('user_online', {'username': current_user.username}, broadcast=True)
        
        # 计算在线用户数量（去重）
        online_users = set(connected_users.values())
        online_count = len(online_users)
        
        # 广播在线人数
        emit('online_users_count', {'count': online_count}, broadcast=True)
        
        # 获取未读私信数量
        from app.models import PrivateMessage
        unread_count = PrivateMessage.get_unread_count(current_app.db, current_user.username)
        if unread_count > 0:
            emit('unread_notification', {'total_unread': unread_count})
        
        # 获取公开聊天的历史消息
        recent_messages = list(current_app.db.messages.find().sort('_id', -1).limit(50))
        recent_messages.reverse()  # 按时间正序排列
        
        # 发送历史消息给客户端
        for message_doc in recent_messages:
            if 'message' in message_doc:
                message = message_doc['message']
                # 确保消息有 read_by 字段
                if 'read_by' not in message:
                    message['read_by'] = []
                # 如果当前用户不在已读列表中，添加
                if current_user.username not in message['read_by']:
                    message['read_by'].append(current_user.username)
                    current_app.db.messages.update_one(
                        {'message.id': message['id']},
                        {'$set': {'message.read_by': message['read_by']}}
                    )
                # 发送消息给客户端
                emit('history_message', message)
        
        # 收集未读消息ID
        unread_message_ids = []
        for message_doc in recent_messages:
            if 'message' in message_doc:
                message = message_doc['message']
                if 'read_by' not in message:
                    message['read_by'] = []
                if current_user.username not in message['read_by'] and message['username'] != current_user.username:
                    unread_message_ids.append(message['id'])
        
        # 如果有未读消息，发送给客户端
        if unread_message_ids:
            emit('unread_public_messages', {
                'message_ids': unread_message_ids,
                'count': len(unread_message_ids)
            })
    else:
        logger.warning("Unauthenticated connection attempt")
        return False  # 拒绝未认证的连接

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in connected_users:
        username = connected_users[request.sid]
        logger.info(f"User {username} disconnected")
        
        # 移除用户连接信息
        del connected_users[request.sid]
        
        # 检查用户是否还有其他活跃连接
        still_connected = False
        for sid, user in connected_users.items():
            if user == username:
                still_connected = True
                break
        
        # 如果用户没有其他活跃连接，则广播离线状态
        if not still_connected:
            emit('user_offline', {'username': username}, broadcast=True)


@socketio.on('message')
@login_required
@login_required
def handle_message(data):
    logger.info(f'Handling message from {current_user.username}: {data}')  # 添加日志
    user_data = current_app.db.users.find_one({'username': current_user.username})
    avatar_url = user_data.get('avatar_url', f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}")

    message_id = str(ObjectId())
    message_data = {
        'id': message_id,
        'text': data,
        'username': current_user.username,
        'avatar_url': avatar_url,
        'timestamp': datetime.now().strftime('%H:%M'),
        'status': 'sent',
        'edited': False,
        'type': 'text'
    }

    try:
        current_app.db.messages.insert_one({'message': message_data})
        emit('message', message_data, broadcast=True)
        logger.info(f'Message sent successfully: {message_id}')  # 添加日志
        logger.info(f'Message sent successfully: {message_id}')  # 添加日志
    except Exception as e:
        logger.error(f'Error sending message: {str(e)}')  # 添加错误日志
        logger.error(f'Error sending message: {str(e)}')  # 添加错误日志


@socketio.on('edit_message')
@login_required
def handle_edit_message(data):
    message_id = data.get('id')
    new_text = data.get('text')

    if message_id and new_text:
        # 检查是否是消息作者
        message = current_app.db.messages.find_one({
            'message.id': message_id,
            'message.username': current_user.username
        })

        if message:
            current_app.db.messages.update_one(
                {'message.id': message_id},
                {'$set': {
                    'message.text': new_text,
                    'message.edited': True,
                    'message.edit_time': datetime.now().strftime('%H:%M')
                }}
            )
            emit('message_edited', {
                'id': message_id,
                'text': new_text,
                'edit_time': datetime.now().strftime('%H:%M')
            }, broadcast=True)


@socketio.on('delete_message')
@login_required
def handle_delete_message(data):
    message_id = data.get('id')

    if message_id:
        # 检查是否是消息作者
        message = current_app.db.messages.find_one({
            'message.id': message_id,
            'message.username': current_user.username
        })

        if message:
            current_app.db.messages.delete_one({'message.id': message_id})
            emit('message_deleted', {'id': message_id}, broadcast=True)


# 添加全局变量来跟踪正在输入的用户
typing_users = {}

@socketio.on('typing')
def handle_typing(data):
    if not current_user.is_authenticated:
        return

    status = data.get('status', 'typing')
    print(f"User {current_user.username} typing status: {status}")  # 添加调试日志

    if status == 'typing':
        typing_users[current_user.username] = datetime.now()
        emit('typing_status', {
            'username': current_user.username,
            'status': 'typing'
        }, broadcast=True, include_self=False)
    else:
        if current_user.username in typing_users:
            typing_users.pop(current_user.username)
            emit('typing_status', {
                'username': current_user.username,
                'status': 'stopped'
            }, broadcast=True, include_self=False)


@bp.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': '没有文件被上传'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400

    if file and allowed_file(file.filename):
        # 获取文件大小
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        file_url = url_for('static', filename=f'uploads/{filename}')

        # 获取最新的用户数据和头像URL
        user_data = current_app.db.users.find_one({'username': current_user.username})
        avatar_url = user_data.get('avatar_url', f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}")

        message_id = str(ObjectId())
        message_data = {
            'id': message_id,
            'type': 'file',
            'filename': file.filename,
            'url': file_url,
            'size': file_size,
            'username': current_user.username,
            'avatar_url': avatar_url,
            'timestamp': datetime.now().strftime('%H:%M'),
            'status': 'sent'
        }

        current_app.db.messages.insert_one({'message': message_data})
        socketio.emit('message', message_data, namespace='/')

        return jsonify({
            'success': True,
            'file_url': file_url,
            'filename': file.filename,
            'size': file_size
        })

    return jsonify({'error': '不支持的文件类型'}), 400


@bp.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'POST':
        # 处理头像上传
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and file.filename:  # 检查是否有选择文件
                if allowed_avatar(file.filename):
                    # 确保头像目录存在
                    os.makedirs(AVATAR_FOLDER, exist_ok=True)

                    # 生成唯一的文件名
                    filename = secure_filename(f"{current_user.username}_{int(time.time())}.jpg")
                    filepath = os.path.join(AVATAR_FOLDER, filename)

                    try:
                        # 保存文件
                        file.save(filepath)
                        logger.info(f"头像上传成功: {filename}")
                        # 生成URL
                        avatar_url = url_for('static', filename=f'avatars/{filename}')

                        # 更新用户头像
                        current_app.db.users.update_one(
                            {'username': current_user.username},
                            {'$set': {'avatar_url': avatar_url}}
                        )

                        # 更新所有消息中的头像URL
                        current_app.db.messages.update_many(
                            {'message.username': current_user.username},
                            {'$set': {'message.avatar_url': avatar_url}}
                        )

                        flash('头像更新成功')
                        return redirect(url_for('main.settings'))
                    except Exception as e:
                        logger.error(f"头像上传失败: {str(e)}")
                        flash('头像上传失败，请重试')
                else:
                    flash('不支持的文件格式')
            else:
                flash('请选择要上传的文件')

        # 更新用户设置
        settings = {
            'display_name': request.form.get('display_name', current_user.username),
            'bio': request.form.get('bio', ''),
            'email': request.form.get('email', '')
        }

        current_app.db.users.update_one(
            {'username': current_user.username},
            {'$set': {'settings': settings}}
        )

        flash('设置已更新')
        return redirect(url_for('main.settings'))

    # GET 请求显示设置页面
    user_data = current_app.db.users.find_one({'username': current_user.username})
    return render_template('settings.html', user=user_data)


@bp.route('/user_info/<username>')
@login_required
def user_info(username):
    user_data = current_app.db.users.find_one({'username': username})
    if user_data:
        settings = user_data.get('settings', {})
        # 使用用户的实际头像URL，如果没有则使用默认头像
        avatar_url = user_data.get('avatar_url', f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}")
        return jsonify({
            'username': user_data['username'],
            'display_name': settings.get('display_name', user_data['username']),
            'avatar_url': avatar_url,
            'bio': settings.get('bio', ''),
        })
    return jsonify({'error': 'User not found'}), 404


@bp.route('/contact_admin')
def contact_admin():
    return render_template('contact_admin.html')


STICKER_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app', 'static', 'stickers')
os.makedirs(STICKER_FOLDER, exist_ok=True)

@bp.route('/upload_sticker', methods=['POST'])
@login_required
def upload_sticker():
    logger.info('收到贴纸上传请求')

    if 'sticker' not in request.files:
        logger.error('没有文件被上传')
        return jsonify({'error': '没有文件被上传'}), 400

    file = request.files['sticker']
    if file.filename == '':
        logger.error('未选择文件')
        return jsonify({'error': '未选择文件'}), 400

    if allowed_file(file.filename):
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
        filename = timestamp + filename
        sticker_path = os.path.join(STICKER_FOLDER, filename)

        logger.info(f'保存贴纸到: {sticker_path}')
        file.save(sticker_path)

        # 保存贴纸信息到数据库
        sticker_url = url_for('static', filename=f'stickers/{filename}')
        current_app.db.stickers.insert_one({
            'username': current_user.username,
            'url': sticker_url,
            'created_at': datetime.now(),
            'pack_name': '我的贴纸'
        })

        logger.info(f'贴纸上传成功: {sticker_url}')
        return jsonify({
            'success': True,
            'url': sticker_url
        })

    logger.error('不支持的文件类型')
    return jsonify({'error': '不支持的文件类型'}), 400

@bp.route('/get_stickers')
@login_required
def get_stickers():
    try:
        # 只获取没有 pack_id 的贴纸（单个贴纸）
        stickers = list(current_app.db.stickers.find({
            'username': current_user.username,
            'pack_id': {'$exists': False}  # 只获取不属于任何贴纸包的贴纸
        }, {
            '_id': 0,
            'url': 1
        }))
        logger.info(f'获取到 {len(stickers)} 个单个贴纸')
        return jsonify(stickers)
    except Exception as e:
        logger.error(f'获取贴纸失败: {str(e)}')
        return jsonify([])

@bp.route('/delete_sticker', methods=['POST'])
@login_required
def delete_sticker():
    url = request.json.get('url')
    if not url:
        return jsonify({'error': '未指定贴纸'}), 400

    try:
        # 从数据库中删除贴纸记录
        result = current_app.db.stickers.delete_one({
            'username': current_user.username,
            'url': url
        })

        if result.deleted_count > 0:
            # 从文件系统中删除贴纸文件
            filename = url.split('/')[-1]
            file_path = os.path.join(STICKER_FOLDER, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

            return jsonify({'success': True})
        else:
            return jsonify({'error': '贴纸不存在或无权删除'}), 404

    except Exception as e:
        logger.error(f'Error deleting sticker: {str(e)}')
        return jsonify({'error': '删除贴纸失败'}), 500

@bp.route('/upload_sticker_pack', methods=['POST'])
@login_required
def upload_sticker_pack():
    if 'sticker_pack' not in request.files:
        return jsonify({'error': '没有文件被上传'}), 400

    file = request.files['sticker_pack']
    pack_name = request.form.get('pack_name', '未命名贴纸包')

    if file.filename == '' or not file.filename.endswith('.zip'):
        return jsonify({'error': '请上传ZIP格式的贴纸包'}), 400

    try:
        zip_file = zipfile.ZipFile(io.BytesIO(file.read()))
        uploaded_stickers = []

        # 创建贴纸包记录
        pack_id = str(ObjectId())
        current_app.db.sticker_packs.insert_one({
            'id': pack_id,
            'name': pack_name,
            'username': current_user.username,
            'created_at': datetime.now()
        })

        # 处理压缩包中的每个文件
        for filename in zip_file.namelist():
            # 修改这里以支持 webm 格式
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.webm')):
                # 读取文件数据
                file_data = zip_file.read(filename)

                # 生成新文件名
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
                new_filename = timestamp + secure_filename(filename)
                file_path = os.path.join(STICKER_FOLDER, new_filename)

                # 保存文件
                with open(file_path, 'wb') as f:
                    f.write(file_data)

                # 创建贴纸URL
                sticker_url = url_for('static', filename=f'stickers/{new_filename}')

                # 保存贴纸信息到数据库
                sticker_id = str(ObjectId())
                current_app.db.stickers.insert_one({
                    'id': sticker_id,
                    'username': current_user.username,
                    'url': sticker_url,
                    'pack_id': pack_id,
                    'created_at': datetime.now(),
                    'type': 'webm' if filename.lower().endswith('.webm') else 'image'  # 添加类型标记
                })

                uploaded_stickers.append(sticker_url)
                logger.info(f'成功导入贴纸: {new_filename}')

        if not uploaded_stickers:
            # 如果没有成功导入任何贴纸，删除贴纸包记录
            current_app.db.sticker_packs.delete_one({'id': pack_id})
            return jsonify({'error': '压缩包中没有有效的贴纸文件'}), 400

        return jsonify({
            'success': True,
            'pack_id': pack_id,
            'pack_name': pack_name,
            'stickers': uploaded_stickers
        })

    except Exception as e:
        logger.error(f'导入贴纸包失败: {str(e)}')
        # 发生错误时，尝试清理已创建的贴纸包
        try:
            current_app.db.sticker_packs.delete_one({'id': pack_id})
            current_app.db.stickers.delete_many({'pack_id': pack_id})
        except:
            pass
        return jsonify({'error': '导入贴纸包失败，请重试'}), 500

@bp.route('/get_sticker_packs')
@login_required
def get_sticker_packs():
    try:
        packs = list(current_app.db.sticker_packs.find(
            {'username': current_user.username},
            {'_id': 0, 'id': 1, 'name': 1}
        ))

        # 为每个贴纸包获取其包含的贴纸
        for pack in packs:
            stickers = list(current_app.db.stickers.find(
                {'pack_id': pack['id']},
                {'_id': 0, 'url': 1}
            ))
            pack['stickers'] = [s['url'] for s in stickers]

        return jsonify(packs)
    except Exception as e:
        logger.error(f'Error getting sticker packs: {str(e)}')
        return jsonify([])

@bp.route('/delete_sticker_pack', methods=['POST'])
@login_required
def delete_sticker_pack():
    pack_id = request.json.get('pack_id')
    if not pack_id:
        return jsonify({'error': '未指定贴纸包'}), 400

    try:
        # 检查贴纸包是否存在且属于当前用户
        pack = current_app.db.sticker_packs.find_one({
            'id': pack_id,
            'username': current_user.username
        })

        if not pack:
            return jsonify({'error': '贴纸包不存在或无权删除'}), 404

        # 获取包内所有贴纸
        stickers = list(current_app.db.stickers.find({
            'pack_id': pack_id,
            'username': current_user.username
        }))

        # 删除所有贴纸文件
        for sticker in stickers:
            filename = sticker['url'].split('/')[-1]
            file_path = os.path.join(STICKER_FOLDER, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        # 从数据库中删除贴纸记录
        current_app.db.stickers.delete_many({
            'pack_id': pack_id,
            'username': current_user.username
        })

        # 删除贴纸包记录
        current_app.db.sticker_packs.delete_one({
            'id': pack_id,
            'username': current_user.username
        })

        return jsonify({'success': True})

    except Exception as e:
        logger.error(f'Error deleting sticker pack: {str(e)}')
        return jsonify({'error': '删除贴纸包失败'}), 500

@bp.route('/upload_emoji', methods=['POST'])
@login_required
def upload_emoji():
    if 'emoji' not in request.files:
        return jsonify({'error': '没有文件被上传'}), 400

    file = request.files['emoji']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400

    if allowed_file(file.filename):  # 确保您有一个函数来检查文件类型
        filename = secure_filename(file.filename)
        # TODO
        # emoji_path = os.path.join(EMOJI_FOLDER, filename)  # 确保您定义了 EMOJI_FOLDER
        # file.save(emoji_path)

        # 这里可以将表情信息保存到数据库，或者直接返回成功信息
        return jsonify({'success': True, 'url': url_for('static', filename=f'emojis/{filename}')})

    return jsonify({'error': '不支持的文件类型'}), 400

@bp.route('/mobile')
@login_required
def mobile_chat():
    return render_template('chat_mobile.html')

@bp.route('/mobile/load_history')
@login_required
def load_history():
    """加载历史消息的API"""
    try:
        # 获取所有消息并按时间戳排序
        messages = list(current_app.db.messages.find().sort('timestamp', 1).limit(50))

        formatted_messages = []
        for msg in messages:
            # 处理消息格式
            if isinstance(msg.get('message'), dict):
                # 如果是新格式消息
                formatted_messages.append(msg)
            else:
                # 如果是旧格式消息，转换为新格式
                formatted_messages.append({
                    'id': str(msg['_id']),
                    'message': {
                        'text': msg.get('text', ''),
                        'username': msg.get('username', ''),
                        'timestamp': msg.get('timestamp', datetime.now()).strftime('%H:%M'),
                        'avatar_url': msg.get('avatar_url', '')
                    }
                })

        return jsonify(formatted_messages)
    except Exception as e:
        print(f"Error loading history: {e}")
        return jsonify([])

@bp.route('/api/server_status')
@login_required
def server_status():
    """获取服务器状态信息的API"""
    try:
        import psutil
        import time
        
        # 获取CPU信息
        cpu_percent = psutil.cpu_percent(interval=0.5)
        cpu_cores = psutil.cpu_percent(interval=0.5, percpu=True)
        
        # 获取内存信息
        memory = psutil.virtual_memory()
        
        # 获取硬盘信息
        disk = psutil.disk_usage('/')
        
        # 获取SWAP信息
        swap = psutil.swap_memory()
        
        # 获取网络信息
        net_start = psutil.net_io_counters()
        time.sleep(0.1)
        net_end = psutil.net_io_counters()
        
        # 计算网络速率 (MB/s)
        bytes_sent = net_end.bytes_sent - net_start.bytes_sent
        bytes_recv = net_end.bytes_recv - net_start.bytes_recv
        sent_mb = bytes_sent / 1024 / 1024 / 0.1
        recv_mb = bytes_recv / 1024 / 1024 / 0.1
        
        return jsonify({
            'cpu': {
                'usage': round(cpu_percent, 1),
                'cores': [{'id': i, 'usage': round(percent, 1)} for i, percent in enumerate(cpu_cores)]
            },
            'memory': {
                'total': memory.total // (1024 * 1024),  # MB
                'used': memory.used // (1024 * 1024),    # MB
                'usage': memory.percent
            },
            'disk': {
                'total': disk.total // (1024 * 1024 * 1024),  # GB
                'used': disk.used // (1024 * 1024 * 1024),    # GB
                'usage': disk.percent
            },
            'swap': {
                'total': swap.total // (1024 * 1024),  # MB
                'used': swap.used // (1024 * 1024),    # MB
                'usage': swap.percent
            },
            'network': {
                'sent': round(sent_mb, 2),
                'received': round(recv_mb, 2)
            }
        })
    except Exception as e:
        logger.error(f"获取服务器状态失败: {str(e)}")
        return jsonify({'error': '获取服务器状态失败'}), 500

# 私聊相关路由
@bp.route('/private_chat/<username>')
@login_required
def private_chat(username):
    """打开与指定用户的私聊页面"""
    # 检查目标用户是否存在
    target_user = current_app.db.users.find_one({'username': username})
    if not target_user:
        flash('用户不存在')
        return redirect(url_for('bp.index'))
    
    # 获取当前用户信息
    current_user_data = current_app.db.users.find_one({'username': current_user.username})
    
    # 获取两人之间的聊天记录
    from app.models import PrivateMessage
    messages = PrivateMessage.get_conversation(current_app.db, current_user.username, username)
    
    # 格式化消息时间
    for msg in messages:
        if isinstance(msg['timestamp'], datetime):
            msg['timestamp'] = msg['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
    
    # 将消息标记为已读
    unread_message_ids = [msg['id'] for msg in messages 
                          if msg['receiver'] == current_user.username and not msg['read']]
    if unread_message_ids:
        PrivateMessage.mark_as_read(current_app.db, unread_message_ids, current_user.username)
    
    # 获取所有最近的私聊会话
    recent_conversations = PrivateMessage.get_recent_conversations(current_app.db, current_user.username)
    
    # 获取所有用户列表（用于新建私聊）
    all_users = list(current_app.db.users.find({}, {'username': 1, 'avatar_url': 1}))
    
    return render_template('private_chat.html', 
                          target_user=target_user,
                          messages=messages,
                          recent_conversations=recent_conversations,
                          all_users=all_users,
                          current_user_data=current_user_data)

@bp.route('/api/private_messages/<username>')
@login_required
def get_private_messages(username):
    """获取与指定用户的私聊记录"""
    from app.models import PrivateMessage
    
    # 获取分页参数
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    skip = (page - 1) * limit
    
    # 获取聊天记录
    messages = PrivateMessage.get_conversation(
        current_app.db, 
        current_user.username, 
        username,
        limit=limit,
        skip=skip
    )
    
    # 将消息格式化为前端需要的格式
    formatted_messages = []
    for msg in messages:
        formatted_messages.append({
            'id': msg['id'],
            'content': msg['content'],
            'sender': msg['sender'],
            'receiver': msg['receiver'],
            'timestamp': msg['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
            'is_self': msg['sender'] == current_user.username,
            'type': msg['type'],
            'read': msg['read'],
            'edited': msg['edited']
        })
    
    return jsonify({
        'messages': formatted_messages,
        'has_more': len(messages) == limit
    })

@bp.route('/api/conversations')
@login_required
def get_conversations():
    """获取当前用户的所有私聊会话"""
    from app.models import PrivateMessage
    
    conversations = PrivateMessage.get_recent_conversations(current_app.db, current_user.username)
    
    # 为每个会话添加用户头像
    for conv in conversations:
        user_data = current_app.db.users.find_one({'username': conv['username']})
        if user_data and 'avatar_url' in user_data:
            conv['avatar_url'] = user_data['avatar_url']
        else:
            conv['avatar_url'] = f"https://api.dicebear.com/7.x/avataaars/svg?seed={conv['username']}"
        
        # 格式化时间
        conv['last_message_time'] = conv['last_message_time'].strftime('%Y-%m-%d %H:%M:%S')
    
    return jsonify({'conversations': conversations})

@bp.route('/api/mark_messages_read', methods=['POST'])
@login_required
def mark_messages_read():
    """将消息标记为已读"""
    data = request.json
    message_ids = data.get('message_ids', [])
    
    if not message_ids:
        return jsonify({'success': False, 'error': '没有提供消息ID'}), 400
    
    from app.models import PrivateMessage
    PrivateMessage.mark_as_read(current_app.db, message_ids, current_user.username)
    
    return jsonify({'success': True})

# WebSocket事件处理
@socketio.on('private_message')
def handle_private_message(data):
    """处理私聊消息"""
    if not current_user.is_authenticated:
        return
    
    sender = current_user.username
    receiver = data.get('receiver')
    content = data.get('content')
    message_type = data.get('type', 'text')
    
    # 验证接收者是否存在
    receiver_exists = current_app.db.users.find_one({'username': receiver})
    if not receiver_exists:
        emit('error', {'message': '接收者不存在'}, room=request.sid)
        return
    
    # 创建私聊消息
    from app.models import PrivateMessage
    message_id = PrivateMessage.create_private_message(
        current_app.db, 
        sender, 
        receiver, 
        content,
        message_type
    )
    
    # 获取发送者头像
    sender_data = current_app.db.users.find_one({'username': sender})
    sender_avatar = sender_data.get('avatar_url', f"https://api.dicebear.com/7.x/avataaars/svg?seed={sender}")
    
    # 构建消息数据
    message_data = {
        'id': message_id,
        'sender': sender,
        'receiver': receiver,
        'content': content,
        'type': message_type,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'avatar_url': sender_avatar,
        'read': False,
        'edited': False
    }
    
    # 发送给发送者
    emit('private_message', message_data, room=request.sid)
    
    # 查找接收者的sid并发送
    for session_id, session_user in connected_users.items():
        if session_user == receiver:
            emit('private_message', message_data, room=session_id)
            break
    
    # 发送未读消息通知
    unread_count = PrivateMessage.get_unread_count(current_app.db, receiver)
    for session_id, session_user in connected_users.items():
        if session_user == receiver:
            emit('unread_notification', {
                'sender': sender,
                'unread_count': unread_count
            }, room=session_id)
            break

@socketio.on('edit_private_message')
def handle_edit_private_message(data):
    """编辑私聊消息"""
    if not current_user.is_authenticated:
        return
    
    message_id = data.get('message_id')
    new_content = data.get('content')
    
    # 验证消息存在且属于当前用户
    message = current_app.db.private_messages.find_one({
        'id': message_id,
        'sender': current_user.username
    })
    
    if not message:
        emit('error', {'message': '消息不存在或无权编辑'}, room=request.sid)
        return
    
    # 更新消息
    current_app.db.private_messages.update_one(
        {'id': message_id},
        {'$set': {'content': new_content, 'edited': True}}
    )
    
    # 构建更新数据
    update_data = {
        'id': message_id,
        'content': new_content,
        'edited': True
    }
    
    # 发送给发送者
    emit('private_message_updated', update_data, room=request.sid)
    
    # 发送给接收者
    receiver = message['receiver']
    for session_id, session_user in connected_users.items():
        if session_user == receiver:
            emit('private_message_updated', update_data, room=session_id)
            break

@socketio.on('delete_private_message')
def handle_delete_private_message(data):
    """删除私聊消息"""
    if not current_user.is_authenticated:
        return
    
    message_id = data.get('message_id')
    
    # 验证消息存在且属于当前用户
    message = current_app.db.private_messages.find_one({
        'id': message_id,
        'sender': current_user.username
    })
    
    if not message:
        emit('error', {'message': '消息不存在或无权删除'}, room=request.sid)
        return
    
    # 删除消息
    current_app.db.private_messages.delete_one({'id': message_id})
    
    # 通知发送者和接收者
    delete_data = {'id': message_id}
    
    # 发送给发送者
    emit('private_message_deleted', delete_data, room=request.sid)
    
    # 发送给接收者
    receiver = message['receiver']
    for session_id, session_user in connected_users.items():
        if session_user == receiver:
            emit('private_message_deleted', delete_data, room=session_id)
            break

# 添加全局变量来跟踪连接的用户
connected_users = {}

# 添加WebSocket事件处理函数，用于标记消息为已读
@socketio.on('mark_messages_read')
def handle_mark_messages_read(data):
    """处理标记消息为已读的请求"""
    if not current_user.is_authenticated:
        return
    
    message_ids = data.get('message_ids', [])
    if not message_ids:
        return
    
    from app.models import PrivateMessage
    PrivateMessage.mark_as_read(current_app.db, message_ids, current_user.username)
    
    # 通知发送者消息已读
    for message_id in message_ids:
        message = current_app.db.private_messages.find_one({'id': message_id})
        if message:
            sender = message['sender']
            # 查找发送者的sid并发送通知
            for session_id, session_user in connected_users.items():
                if session_user == sender:
                    emit('message_read', {
                        'message_id': message_id,
                        'reader': current_user.username
                    }, room=session_id)
                    break
