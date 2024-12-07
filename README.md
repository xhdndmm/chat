# 聊天室源码仓库

# 开发环境构筑

1. 通过 VS Code 创建虚拟环境，选择 Python 3.11。或者 参考 create_env.sh 文件（Linux 中安装 Python 环境并创建虚拟环境），

2. 控制台中切换到虚拟环境，并安装各种依赖包。

```
source .venv/bin/activate
pip3 install -r ./requirements.txt
```

3. 安装 docker，以及 docker compose 环境，参考 [docker 官方文档](https://docs.docker.com/engine/install/)。

4. 这个命令启动 MongoDB 的 docker 环境。

```bash
docker compose -f compose-db.yml
```

5. 在 .env 文件中，修改 MongoDB DB 的 hostname/ip， passowrd 和 user。

6. VS Code 中通过 F5 进行 Deubg，可以启动调试
