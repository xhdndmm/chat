import logging
from logging.handlers import TimedRotatingFileHandler

logger = logging.getLogger('my_app')
logger.setLevel(logging.DEBUG)

file_handler = TimedRotatingFileHandler('./logs/my_app.log', when='midnight', interval=1, encoding='utf-8')
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

logger.addHandler(file_handler)
