from flask import Blueprint, render_template, Flask, current_app, request, redirect, url_for, flash  # 添加 request, redirect, url_for, flash
from flask_socketio import SocketIO, emit
from flask_login import LoginManager, login_user, logout_user, login_required, current_user  # 添加 login_user, logout_user, login_required
from config import db_config
from .extensions import *
from .models import User  #
from . import socketio


bp = Blueprint('main', __name__)


@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user_data = current_app.db.users.find_one({'username': username})
        if user_data:
            user = User(user_data['username'], user_data['password'])
            if user.check_password(password):
                login_user(user)
                return redirect(url_for('main.index'))
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
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if User.create_user(current_app.db, username, password):
            flash('用户创建成功')
        else:
            flash('用户已存在')
    return render_template('admin.html')


@socketio.on('connect')
def handle_connect():
    if not current_user.is_authenticated:
        return False  # 阻止未登录用户连接
    messages = current_app.db.messages.find()
    for message in messages:
        emit('message', message['message'])


@socketio.on('message')
@login_required
def handle_message(data):
    current_app.db.messages.insert_one({'message': data})
    emit('message', data, broadcast=True)


@bp.route('/authenticate', methods=['POST'])
def authenticate():
    username = request.form['auth_username']
    password = request.form['auth_password']
    user_data = current_app.db.users.find_one({'username': username})

    if user_data and User(user_data['username'], user_data['password']).check_password(password):
        flash('身份验证成功')
        return redirect(url_for('main.index'))
    else:
        flash('用户名或密码错误')
        return redirect(url_for('main.admin'))
