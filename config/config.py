import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev_secret_key"
    # 邮件、缓存等配置可在此补充
