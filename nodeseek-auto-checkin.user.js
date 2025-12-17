// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.1.0
// @description  NodeSeek论坛增强脚本：自动签到 + 帖子列表显示最新留言预览
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        API_URL: 'https://www.nodeseek.com/api/attendance',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true,           // true: 随机鸡腿, false: 固定5鸡腿
        PREVIEW_MAX_LEN: 50,         // 最新留言预览最大字数
        CACHE_TTL: 5 * 60 * 1000     // 缓存5分钟
    };

    // 留言缓存
    const commentCache = new Map();

    // ==================== 样式注入 ====================
    GM_addStyle(`
        .ns-latest-comment {
            display: inline-block;
            max-width: 300px;
            margin-left: 8px;
            padding: 2px 8px;
            font-size: 12px;
            color: #666;
            background: #f5f5f5;
            border-radius: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
            cursor: pointer;
            transition: all 0.2s;
        }
        .ns-latest-comment:hover {
            background: #e8e8e8;
            color: #333;
        }
        .ns-latest-comment .ns-author {
            color: #1890ff;
            margin-right: 4px;
        }
        .ns-loading {
            color: #999;
            font-style: italic;
        }
        @media (prefers-color-scheme: dark) {
            .ns-latest-comment {
                background: #333;
                color: #aaa;
            }
            .ns-latest-comment:hover {
                background: #444;
                color: #ddd;
            }
        }
    `);

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();

    const notify = (title, text) => {
        GM_notification({ title, text, timeout: 3000 });
        console.log(`[NS助手] ${title}: ${text}`);
    };

    // 从URL提取帖子ID
    const extractPostId = (url) => {
        const match = url.match(/\/post-(\d+)/);
        return match ? match[1] : null;
    };

    // 截断文本
    const truncate = (text, len) => {
        text = text.trim().replace(/\s+/g, ' ');
        return text.length > len ? text.slice(0, len) + '...' : text;
    };

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) {
            console.log('[NS助手] 今日已签到');
            return;
        }

        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.nodeseek.com',
                    'Referer': 'https://www.nodeseek.com/board'
                },
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });

            const data = await res.json();

            if (data.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', data.message || '获得鸡腿奖励！');
            } else if (data.message?.includes('已完成签到')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
            } else {
                notify('签到失败', data.message || '未知错误');
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 最新留言功能 ====================

    // 获取帖子最新评论
    const fetchLatestComment = async (postId) => {
        // 检查缓存
        const cached = commentCache.get(postId);
        if (cached && Date.now() - cached.time < CONFIG.CACHE_TTL) {
            return cached.data;
        }

        try {
            // 获取帖子页面
            const res = await fetch(`https://www.nodeseek.com/post-${postId}-1`, {
                credentials: 'include'
            });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // 查找评论数和最后一页链接
            const pagination = doc.querySelector('.pagination');
            let lastPageUrl = `/post-${postId}-1`;

            if (pagination) {
                const pageLinks = pagination.querySelectorAll('a[href*="/post-"]');
                if (pageLinks.length > 0) {
                    const lastLink = pageLinks[pageLinks.length - 1];
                    if (lastLink) lastPageUrl = lastLink.getAttribute('href');
                }
            }

            // 如果有多页，获取最后一页
            let commentsDoc = doc;
            if (lastPageUrl !== `/post-${postId}-1`) {
                const lastRes = await fetch(`https://www.nodeseek.com${lastPageUrl}`, {
                    credentials: 'include'
                });
                const lastHtml = await lastRes.text();
                commentsDoc = new DOMParser().parseFromString(lastHtml, 'text/html');
            }

            // 提取最新评论 - 尝试多种选择器
            const comments = commentsDoc.querySelectorAll('.post-content, .comment-content, .content, [class*="comment"], [class*="reply"]');
            let latestComment = null;

            if (comments.length > 0) {
                const lastComment = comments[comments.length - 1];
                const authorEl = lastComment.closest('[class*="post"], [class*="comment"], [class*="reply"]')
                    ?.querySelector('[class*="author"], [class*="user"], .username, a[href*="/space/"]');

                latestComment = {
                    author: authorEl?.textContent?.trim() || '匿名',
                    content: lastComment.textContent?.trim() || ''
                };
            }

            // 如果上述选择器无效，尝试更通用的方法
            if (!latestComment || !latestComment.content) {
                const allPosts = commentsDoc.querySelectorAll('[id^="post-"]');
                if (allPosts.length > 0) {
                    const lastPost = allPosts[allPosts.length - 1];
                    const contentEl = lastPost.querySelector('[class*="content"], p, .text');
                    const authorEl = lastPost.querySelector('a[href*="/space/"], [class*="author"]');

                    if (contentEl) {
                        latestComment = {
                            author: authorEl?.textContent?.trim() || '匿名',
                            content: contentEl.textContent?.trim() || ''
                        };
                    }
                }
            }

            // 缓存结果
            commentCache.set(postId, { data: latestComment, time: Date.now() });
            return latestComment;

        } catch (e) {
            console.error('[NS助手] 获取评论失败:', e);
            return null;
        }
    };

    // 为帖子标题添加最新留言预览
    const addCommentPreview = async (titleEl, postId) => {
        // 避免重复添加
        if (titleEl.dataset.nsProcessed) return;
        titleEl.dataset.nsProcessed = 'true';

        // 创建预览元素
        const preview = document.createElement('span');
        preview.className = 'ns-latest-comment ns-loading';
        preview.textContent = '加载中...';
        titleEl.parentNode.insertBefore(preview, titleEl.nextSibling);

        // 获取最新评论
        const comment = await fetchLatestComment(postId);

        if (comment && comment.content) {
            preview.className = 'ns-latest-comment';
            preview.innerHTML = `<span class="ns-author">${comment.author}:</span>${truncate(comment.content, CONFIG.PREVIEW_MAX_LEN)}`;
            preview.title = `${comment.author}: ${comment.content}`;
        } else {
            preview.remove();
        }
    };

    // 处理帖子列表
    const processPostList = () => {
        // 查找所有帖子链接
        const postLinks = document.querySelectorAll('a[href*="/post-"]');

        postLinks.forEach(link => {
            const href = link.getAttribute('href');
            const postId = extractPostId(href);

            // 只处理标题链接（通常在标题容器内）
            if (!postId) return;

            const parent = link.closest('[class*="title"], [class*="post-item"], [class*="topic"], li, tr');
            if (!parent) return;

            // 检查是否是主标题链接（非回复数等小链接）
            const isMainTitle = link.textContent.length > 5 &&
                !link.closest('[class*="meta"], [class*="info"], [class*="stat"]');

            if (isMainTitle) {
                addCommentPreview(link, postId);
            }
        });
    };

    // ==================== 初始化 ====================
    const init = () => {
        // 延迟执行签到
        setTimeout(doCheckin, 2000);

        // 处理帖子列表
        if (location.pathname.includes('/board') ||
            location.pathname === '/' ||
            location.pathname.includes('/category')) {
            setTimeout(processPostList, 1000);

            // 监听动态加载
            const observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        setTimeout(processPostList, 500);
                        break;
                    }
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    };

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
