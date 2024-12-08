from flask import Blueprint, render_template, current_app
from flask_socketio import emit
from . import socketio

bp = Blueprint('main', __name__)

@bp.route('/')
def index():
    return render_template('chat.html')

@socketio.on('connect')
def handle_connect():
    # 从 MongoDB 中读取历史消息
    messages = current_app.db.messages.find()
    # 将每条消息发送给客户端
    for message in messages:
        emit('message', message['message'])

@socketio.on('message')
def handle_message(data):
    # 将新消息保存到 MongoDB
    current_app.db.messages.insert_one({'message': data})
    # 广播新消息给所有客户端
    emit('message', data, broadcast=True)