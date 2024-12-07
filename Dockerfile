FROM python:3.11-slim

RUN mkdir -p /usr/src/app/logs
WORKDIR /usr/src/app

COPY . .

RUN pip3 install --no-cache-dir -r requirements.txt

EXPOSE 8080

ENTRYPOINT ["python3"]

# 生产环境
# CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "wsgi:app"]
CMD ["wsgi.py"]
