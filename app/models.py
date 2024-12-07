from config.db_config import get_mongo_client

def insert_test_document():
    # 测试
    client = get_mongo_client()
    db = client.my_database  # 创建一个名为 my_database 的数据库
    collection = db.my_collection  # 创建一个名为 my_collection 的集合

    # 增加一个 document
    document = {
        "name": "John Doe",
        "email": "john.doe@example.com",
        "age": 30
    }

    collection.insert_one(document)
