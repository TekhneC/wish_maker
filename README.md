# 新年活动签到页面

## 环境要求

- Ubuntu 18.04
- Conda 环境
- Python 3.10+ (兼容 Flask 3.0.3)

## 安装依赖

```bash
conda create -n wish-maker python=3.10
conda activate wish-maker
pip install -r requirements.txt
```

## 数据库

首次启动会在项目目录生成 `data.db`，并自动建表。

## 开发模式运行

```bash
conda activate wish-maker
python app.py
```

默认监听 `127.0.0.1:5000`，可通过端口映射供外网访问。

## 稳定运行模式（生产）

建议使用 `gunicorn` 运行：

```bash
conda activate wish-maker
pip install gunicorn

gunicorn -w 2 -b 127.0.0.1:5000 "app:app"
```

## 接口说明

- `GET /api/init`
  - 参数：`recent_limit`、`random_limit`、`exclude_ids`（逗号分隔）
  - 返回：`recent` 最近寄语数组，`random` 随机寄语数组
- `POST /api/submit`
  - 请求体：`{ "text": "内容" }`
  - 返回：新寄语记录（包含 `id`、`text`、`created_at`）

## 目录结构

```
app.py
templates/
  index.html
static/
  css/style.css
  js/main.js
```
