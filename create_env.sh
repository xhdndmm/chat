#!/bin/bash
set -e

init_python() {
    sudo apt-get install -y gcc libbz2-dev libc6-dev libffi-dev libfreetype6-dev libfribidi-dev libgdbm-dev libharfbuzz-dev libjpeg8-dev liblcms2-dev libldap2-dev libncurses5-dev libopenjp2-7-dev libpq-dev libreadline-dev libsasl2-dev libsqlite3-dev libssl-dev libtiff5-dev libwebp-dev libxcb1-dev libxml2-dev libxslt1-dev python3-dev python3-pip tk-dev zlib1g-dev
    curl https://pyenv.run | bash
    echo 'export PATH="$HOME/.pyenv/bin:$PATH"' >>~/.bashrc
    echo 'eval "$(pyenv init --path)"' >>~/.bashrc
    echo 'eval "$(pyenv virtualenv-init -)"' >>~/.bashrc
    source ~/.bashrc
    pyenv install 3.11.4
    pyenv global 3.11.4
}

setup_virtual_environment() {
    rm -rf venv

    pip3 install virtualenv
    virtualenv venv --python=python3.11
    source venv/bin/activate
}

install_python_packages() {
    pip3 install --upgrade --no-cache-dir pylint autopep8
}

install_requirements() {
    pip3 install -r ./requirements.txt
}

create_folder() {
    sudo mkdir -p volumes
    sudo chmod 777 volumes
}

create_folder
# init_python
install_python_packages
setup_virtual_environment
install_requirements
