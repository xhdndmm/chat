from config.db_config import get_mongo_client
from werkzeug.security import generate_password_hash, check_password_hash


class User:
    def __init__(self, username, password, is_admin=False):
        self.username = username
        self.password = password
        self.is_admin = is_admin

    def check_password(self, password):
        return self.password == password

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return self.username

    @staticmethod
    def create_user(db, username, password):
        if db.users.find_one({'username': username}):
            return False
        db.users.insert_one({
            'username': username,
            'password': password,
            'is_admin': False  # 普通用户默认不是管理员
        })
        return True
