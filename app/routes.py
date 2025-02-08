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
    # 通过 User-Agent 判断是否为移动设备
    user_agent = request.headers.get('User-Agent', '').lower()
    is_mobile = any(device in user_agent for device in ['iphone', 'android', 'mobile'])

    if is_mobile:
        print("检测到移动设备，加载移动端模板")  # 添加调试日志
        return render_template('mobile/chat.html')
    print("检测到桌面设备，加载桌面端模板")  # 添加调试日志
    return render_template('chat.html')


@bp.route('/admin', methods=['GET', 'POST'])
@login_required
@admin_required  # 添加管理员验证
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
    register_requests = list(current_app.db.register_requests.find())
    return render_template('admin.html', users=users, register_requests=register_requests)


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


@bp.route('/admin/approve_request/<username>', methods=['POST'])
@login_required
@admin_required
def approve_request(username):
    request_data = current_app.db.register_requests.find_one({'username': username})
    if request_data:
        current_app.db.users.insert_one({
            'username': request_data['username'],
            'password': request_data['password'],
            'is_admin': False,
            'created_at': datetime.now(),
            'status': '正常'
        })
        current_app.db.register_requests.delete_one({'username': username})
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': '注册申请不存在'})

@bp.route('/admin/reject_request/<username>', methods=['POST'])
@login_required
@admin_required
def reject_request(username):
    current_app.db.register_requests.delete_one({'username': username})
    return jsonify({'success': True})


@bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        info = request.form['info']

        if current_app.db.register_requests.find_one({'username': username}):
            flash('注册申请已存在')
        else:
            current_app.db.register_requests.insert_one({
                'username': username,
                'password': password,
                'info': info,
                'created_at': datetime.now()
            })
            flash('注册申请已提交')

    return render_template('contact_admin.html')


@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return False
    messages = current_app.db.messages.find()
    for message in messages:
        if isinstance(message.get('message'), dict):
            msg_data = message['message']
            # 如果消息没有头像URL，尝试从用户数据获取
            if 'avatar_url' not in msg_data:
                user_data = current_app.db.users.find_one({'username': msg_data['username']})
                if user_data and 'avatar_url' in user_data:
                    msg_data['avatar_url'] = user_data['avatar_url']
        else:
            user_data = current_app.db.users.find_one({'username': current_user.username})
            msg_data = {
                'text': message.get('message', ''),
                'username': current_user.username,
                'avatar_url': user_data.get('avatar_url', f"https://api.dicebear.com/7.x/avataaars/svg?seed={current_user.username}"),
                'timestamp': datetime.now().strftime('%H:%M')
            }
        emit('message', msg_data)


@socketio.on('message')
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
    except Exception as e:
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
        emoji_path = os.path.join(EMOJI_FOLDER, filename)  # 确保您定义了 EMOJI_FOLDER
        file.save(emoji_path)

        # 这里可以将表情信息保存到数据库，或者直接返回成功信息
        return jsonify({'success': True, 'url': url_for('static', filename=f'emojis/{filename}')})

    return jsonify({'error': '不支持的文件类型'}), 400

#服务器状态
@bp.route('/server_status')
def server_status():
    cpu_usage = psutil.cpu_percent(interval=1)
    memory_info = psutil.virtual_memory()
    memory_usage = memory_info.percent

    return jsonify({
        'cpu_usage': cpu_usage,
        'memory_usage': memory_usage
    })