from config.db_config import get_mongo_client
from werkzeug.security import generate_password_hash, check_password_hash


class User:
    def __init__(self, username, password, is_admin=False, avatar_url=None):
        self.username = username
        self.password = password
        self.is_admin = is_admin
        # 如果没有头像，使用默认头像
        self.avatar_url = avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}"

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
            'is_admin': False,
            'avatar_url': f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}"  # 使用 DiceBear API 生成头像
        })
        return True
