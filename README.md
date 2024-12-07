# 项目名称

## 简介

这是一个使用 Flask 框架构建的实时聊天应用程序。该应用程序使用 MongoDB 作为数据库，并通过 Docker 容器化。

## 环境设置

### 先决条件

在开始之前，请确保你的系统上安装了以下软件：

-   [Docker](https://www.docker.com/get-started) - 用于容器化应用程序
-   [Python 3.11](https://www.python.org/downloads/) - 用于运行 Flask 应用程序
-   [pip](https://pip.pypa.io/en/stable/installation/) - Python 包管理器

### 步骤

1. **克隆项目**

    首先，克隆项目到你的本地机器：

    ```bash
    git clone https://github.com/yourusername/yourproject.git
    cd yourproject
    ```

2. **创建虚拟环境**

    创建一个 Python 虚拟环境以隔离项目的依赖：

    ```bash
    python3 -m venv .venv
    ```

    激活虚拟环境：

    - 对于 Bash 或 Zsh 用户：

        ```bash
        source .venv/bin/activate
        ```

    - 对于 Fish shell 用户：
        ```fish
        source .venv/bin/activate.fish
        ```

3. **安装依赖**

    使用 `pip` 安装项目所需的依赖：

    ```bash
    pip install -r requirements.txt
    ```

    这一步会根据 `requirements.txt` 文件安装所有必要的 Python 包。

4. **配置环境变量**

    `.env` 文件来存储环境变量。你可以根据项目需求设置变量，例如数据库连接字符串。

5. **启动 MongoDB 服务， 调试应用程序**

    使用 Docker Compose 启动 MongoDB 服务：

    ```bash
    docker compose -f compose-db.yml up -d
    ```

6. 使用 VS Code 的 F5 键进行调试。

## 生产环境

7. **构建和运行 Docker 容器**

    使用 Docker Compose 启动开发完成的 Web 应用程序：

    ```bash
    docker compose up -d
    ```

    这将构建 Docker 镜像并在端口 8080 上运行容器。

8. **访问应用程序**

    打开浏览器并访问 `http://localhost:8080` 以查看应用程序。

## 生产环境

在生产环境中，建议使用 `gunicorn` 作为 WSGI 服务器。你可以在 `Dockerfile` 中取消注释相应的 `CMD` 行：
