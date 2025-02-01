# Chat Room

[Telegram Development Group](https://t.me/githubxhdndmmchat)
[Bug Report](https://t.me/xhdndmmchat)

## Introduction

This is a real-time chat application built using the Flask framework. The application uses MongoDB as the database and is containerized through Docker. Note that Docker cannot be accessed in mainland China.

## Environment Setup

### Prerequisites

Before starting, please ensure that the following software is installed on your system:

-   [Docker](https://www.docker.com/get-started) - for containerizing the application

### Steps

1. **Clone the Project**

    First, clone the project to your local machine:

    ```bash
    git clone https://github.com/yourusername/yourproject.git
    cd yourproject
    ```

2. **Create a Virtual Environment**

    Create a Python virtual environment to isolate the project's dependencies:

    ```bash
    python3 -m venv .venv
    ```

    Activate the virtual environment:

    - For Bash or Zsh users:

        ```bash
        source .venv/bin/activate
        ```

    - For Fish shell users:
        ```fish
        source .venv/bin/activate.fish
        ```

3. **Install Dependencies**

    Use `pip` to install the required dependencies for the project:

    ```bash
    pip install -r requirements.txt
    ```

4. **Configure Environment Variables**

    Create a `.env` file to store environment variables. You can set variables according to the project's requirements, such as the database connection string.

5. **Start MongoDB Service**

    Use Docker Compose to start the MongoDB service:

    ```bash
    docker compose -f compose-db.yml up -d
    ```

6. **Create Admin Account**

    Before starting the application, you need to create an admin account:

    ```bash
    python init_admin.py
    ```

    This will create a default admin account:
    - Username: admin
    - Password: admin123

    Please change the password immediately after the first login!

7. **Debug the Application**

    Use the F5 key in VS Code to debug.

## Production Environment

8. **Build and Run Docker Containers**

    Use Docker Compose to start the developed web application:

    ```bash
    docker compose up -d
    ```
    For first-time use or version updates:
    Admin run:
    ```bash
    docker compose up -d --build
    ```

    This will build the Docker image and run the container on port 8080.

8. **Access the Application**

    Open a browser and visit `http://localhost:8080` to view the application.

## Production Environment

In a production environment, it is recommended to use `gunicorn` as the WSGI server. You can uncomment the corresponding `CMD` line in the `Dockerfile`.

## Admin Features

The admin account can access the following features:
- Access the admin panel (/admin)
- Create new users
- Reset user passwords
- Delete users (except the admin)

Regular users need to contact the admin to:
- Register a new account
- Reset passwords

## Notes

- The `init_admin.py` must be executed on the first run to create an admin account
- Please change the default admin password promptly
- Protect sensitive information in the `.env` file