from flask import Blueprint, render_template
from . import models
bp = Blueprint('main', __name__)


@bp.route('/')
def index():
    models.insert_test_document()
    return render_template('index.html')
