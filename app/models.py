from config.db_config import get_mongo_client
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime


class User:
    def __init__(self, username, password, is_admin=False, avatar_url=None, settings=None):
        self.username = username
        self.password = password
        self.is_admin = is_admin
        self.avatar_url = avatar_url
        self.settings = settings or {}

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
        avatar_url = f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}"
        db.users.insert_one({
            'username': username,
            'password': password,
            'is_admin': False,
            'avatar_url': avatar_url,
            'settings': {
                'theme': 'light',
                'notification': True,
                'display_name': username,
                'bio': '',
                'email': ''
            }
        })
        return True

    def get_avatar_url(self):
        """获取用户头像URL"""
        from flask import current_app
        user_data = current_app.db.users.find_one({'username': self.username})
        if user_data and 'avatar_url' in user_data:
            return user_data['avatar_url']
        return f"https://api.dicebear.com/7.x/avataaars/svg?seed={self.username}"

    @staticmethod
    def get_user_by_username(db, username):
        """根据用户名获取用户信息"""
        user_data = db.users.find_one({'username': username})
        if not user_data:
            return None
        return User(
            username=user_data['username'],
            password=user_data['password'],
            is_admin=user_data.get('is_admin', False),
            avatar_url=user_data.get('avatar_url'),
            settings=user_data.get('settings', {})
        )

# 私聊相关的数据库操作
class PrivateMessage:
    @staticmethod
    def create_private_message(db, sender, receiver, message_content, message_type='text'):
        """创建一条私聊消息"""
        message_id = str(ObjectId())
        timestamp = datetime.now()
        
        message_data = {
            'id': message_id,
            'sender': sender,
            'receiver': receiver,
            'content': message_content,
            'type': message_type,
            'timestamp': timestamp,
            'read': False,
            'edited': False
        }
        
        db.private_messages.insert_one(message_data)
        return message_id
    
    @staticmethod
    def get_conversation(db, user1, user2, limit=50, skip=0):
        """获取两个用户之间的私聊记录"""
        query = {
            '$or': [
                {'sender': user1, 'receiver': user2},
                {'sender': user2, 'receiver': user1}
            ]
        }
        
        messages = list(db.private_messages.find(query)
                        .sort('timestamp', -1)
                        .skip(skip)
                        .limit(limit))
        
        # 将消息按时间正序排列
        messages.reverse()
        return messages
    
    @staticmethod
    def mark_as_read(db, message_ids, user):
        """将消息标记为已读"""
        db.private_messages.update_many(
            {'id': {'$in': message_ids}, 'receiver': user},
            {'$set': {'read': True}}
        )
    
    @staticmethod
    def get_unread_count(db, username):
        """获取用户未读私信数量"""
        return db.private_messages.count_documents({
            'receiver': username,
            'read': False
        })
    
    @staticmethod
    def get_recent_conversations(db, username):
        """获取用户最近的私聊会话列表"""
        # 查找用户参与的所有对话
        query = {
            '$or': [
                {'sender': username},
                {'receiver': username}
            ]
        }
        
        # 按照时间倒序获取最近的消息
        messages = list(db.private_messages.find(query).sort('timestamp', -1))
        
        # 提取不重复的对话伙伴
        conversations = {}
        for msg in messages:
            other_user = msg['receiver'] if msg['sender'] == username else msg['sender']
            
            if other_user not in conversations:
                # 获取该用户的未读消息数
                unread_count = db.private_messages.count_documents({
                    'sender': other_user,
                    'receiver': username,
                    'read': False
                })
                
                conversations[other_user] = {
                    'username': other_user,
                    'last_message': msg['content'],
                    'last_message_time': msg['timestamp'],
                    'unread_count': unread_count
                }
        
        # 转换为列表并按最后消息时间排序
        result = list(conversations.values())
        result.sort(key=lambda x: x['last_message_time'], reverse=True)
        
        return result
