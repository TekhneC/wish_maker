# Wish Maker - 新年寄语夜空

## 本地运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

浏览器访问：`http://127.0.0.1:5000`

## 服务器运行（Gunicorn）

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export FLASK_APP=app.py
export FLASK_ENV=production

# 启动
.venv/bin/gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

数据库文件默认生成在项目根目录 `wishes.db`。
