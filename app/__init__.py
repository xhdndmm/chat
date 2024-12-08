from flask import Flask
from flask_socketio import SocketIO
from config import db_config
from .extensions import *

socketio = SocketIO()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'your_secret_key'

    # app.config.from_object('config.Config') # 如有需要，引入配置
    # 在此处初始化扩展，如 db.init_app(app)
    from .routes import bp as main_bp
    # Initialize MongoDB client
    client = db_config.get_mongo_client()
    app.db = client.chat_db

    from .routes import bp
    app.register_blueprint(bp)
    socketio.init_app(app)
    return app
