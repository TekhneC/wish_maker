# 新年寄语签到页

## 功能简介
- 深蓝夜空手绘风格的签到页，支持输入寄语与动态上浮展示。
- SQLite 持久化保存寄语（文本与 ISO 时间戳）。
- 初始化接口返回最近寄语 + 随机寄语，避免重复。

## 环境准备（conda）
```bash
conda create -n wish-maker python=3.10
conda activate wish-maker
pip install Flask==3.0.3
```

## 开发模式
```bash
python app.py
```
默认监听 `127.0.0.1:5000`。

## 稳定运行模式（示例）
使用 gunicorn：
```bash
pip install gunicorn

gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## 接口说明
### `GET /api/messages`
参数：
- `recent`：最近寄语数量（默认 12）
- `random`：随机寄语数量（默认 10）
- `exclude`：排除的 id 列表（逗号分隔）

返回：
```json
{
  "recent": [{"id": 1, "message": "...", "created_at": "..."}],
  "random": [{"id": 9, "message": "...", "created_at": "..."}]
}
```

### `POST /api/messages`
请求体：
```json
{
  "message": "新年寄语"
}
```
返回：
```json
{
  "id": 12,
  "message": "新年寄语",
  "created_at": "2024-01-01T00:00:00+00:00"
}
```
