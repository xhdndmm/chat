from app import create_app
from app.models import User

def init_admin():
    app = create_app()
    with app.app_context():
        # 检查是否已存在管理员账号
        if not app.db.users.find_one({'is_admin': True}):
            # 创建管理员账号，添加 is_admin 字段
            app.db.users.insert_one({
                'username': 'admin',
                'password': 'admin123',
                'is_admin': True  # 添加管理员标识
            })
            print("=== 管理员账号创建成功! ===")
            print("用户名: admin")
            print("密码: admin123")
            print("请登录后立即修改密码!")
        else:
            print("提示：管理员账号已存在!")

if __name__ == "__main__":
    init_admin() 