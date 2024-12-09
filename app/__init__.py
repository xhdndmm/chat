from flask import Flask
from flask_socketio import SocketIO
from flask_login import LoginManager
from config import db_config
from .models import User

socketio = SocketIO()
login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'your_secret_key'

    # Initialize MongoDB client
    client = db_config.get_mongo_client()
    app.db = client.chat_db

    from .routes import bp
    app.register_blueprint(bp)
    socketio.init_app(app)

    # Initialize LoginManager
    login_manager.login_view = 'main.login'  # 设置登录视图
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        user_data = app.db.users.find_one({'username': user_id})
        if user_data:
            return User(
                user_data['username'], 
                user_data['password'],
                user_data.get('is_admin', False)  # 获取管理员标识，默认为 False
            )
        return None

    return app