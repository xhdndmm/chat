from config.db_config import get_mongo_client
from werkzeug.security import generate_password_hash, check_password_hash


class User:
    def __init__(self, username, password):
        self.username = username
        self.password = password

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
            return False  # 用户已存在
        db.users.insert_one({
            'username': username,
            'password': password  # 直接存储明文密码
        })
        return True
