# NodeSeek 自动签到油猴脚本

简洁高效的 NodeSeek 论坛自动签到脚本。

## 功能特点

- 自动检测签到状态，避免重复签到
- 支持随机/固定鸡腿模式
- 桌面通知提醒签到结果
- 本地存储签到记录

## 安装方法

1. 安装油猴插件 [Tampermonkey](https://www.tampermonkey.net/)
2. 点击安装脚本：[nodeseek-auto-checkin.user.js](./nodeseek-auto-checkin.user.js)
3. 访问 NodeSeek 论坛即可自动签到

## 配置选项

编辑脚本中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    RANDOM_MODE: true  // true: 随机鸡腿, false: 固定5鸡腿
};
```

## 许可证

MIT License
