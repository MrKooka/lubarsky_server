#/celery_app
from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

# Предположим, в .env у вас:
# BROKER_URL="amqp://guest:pass@38.54.95.149:5672//"
# CELERY_BACKEND="rpc://"
broker_url = os.environ.get("BROKER_URL")
backend_url = os.environ.get("CELERY_BACKEND")

celery = Celery(
    "convertor_server",
    broker=broker_url,       # amqp://...
    backend=backend_url      # rpc://
)

celery.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='America/Los_Angeles',
    enable_utc=True,
)

# ВАЖНО: при rpc-бэкенде нужно хранить результаты,
# иначе Celery не сможет ни state, ни result выдавать
# celery.conf.task_ignore_result = False
# celery.conf.result_persistent = True  # не обязательно, но пусть будет

# Настройки роутинга: все в очередь "celery"
celery.conf.task_default_queue = 'celery'
celery.conf.task_default_exchange = 'celery'
celery.conf.task_default_exchange_type = 'direct'
celery.conf.task_default_routing_key = 'celery'
