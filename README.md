# NodeSeek 增强助手

简洁高效的 NodeSeek 论坛增强油猴脚本。

## 功能特点

- **自动签到** - 每日自动签到，支持随机/固定鸡腿模式
- **最新留言预览** - 帖子列表页显示每个帖子的最新评论
- **智能缓存** - 评论数据缓存5分钟，减少请求
- **深色模式适配** - 自动适配系统深色/浅色主题

## 安装方法

1. 安装油猴插件 [Tampermonkey](https://www.tampermonkey.net/)
2. 点击安装脚本：[nodeseek-auto-checkin.user.js](./nodeseek-auto-checkin.user.js)
3. 访问 NodeSeek 论坛即可自动生效

## 配置选项

编辑脚本中的 `CONFIG` 对象：

```javascript
const CONFIG = {
    RANDOM_MODE: true,        // true: 随机鸡腿, false: 固定5鸡腿
    PREVIEW_MAX_LEN: 50,      // 最新留言预览最大字数
    CACHE_TTL: 5 * 60 * 1000  // 缓存时间(毫秒)
};
```

## 效果预览

在帖子标题右侧会显示最新留言：

```
[帖子标题] [用户名: 最新留言内容预览...]
```

## 许可证

MIT License
