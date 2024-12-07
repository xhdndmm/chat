from flask import Flask
from .extensions import *

def create_app():
    app = Flask(__name__)
    # app.config.from_object('config.Config') # 如有需要，引入配置
    # 在此处初始化扩展，如 db.init_app(app)
    from .routes import bp as main_bp
    app.register_blueprint(main_bp)
    return app
