// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.3.0
// @description  NodeSeek论坛增强：自动签到 + 最新留言预览 + 交易记录 + 抽奖帖侧边栏
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      www.nodeseek.com
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置 ====================
    const CONFIG = {
        API_URL: 'https://www.nodeseek.com/api/attendance',
        TRADE_URL: 'https://www.nodeseek.com/categories/trade',
        HOME_URL: 'https://www.nodeseek.com/',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true,
        PREVIEW_MAX_LEN: 40,
        SIDEBAR_COUNT: 5,
        CACHE_TTL: 5 * 60 * 1000
    };

    const cache = new Map();

    // ==================== 样式注入 ====================
    GM_addStyle(`
        /* 最新留言样式 */
        .ns-comment-preview {
            display: inline-flex;
            align-items: center;
            max-width: 280px;
            margin-left: 10px;
            padding: 2px 10px;
            font-size: 12px;
            color: #888;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            border-radius: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: middle;
            cursor: default;
            border: 1px solid #e0e0e0;
        }
        .ns-comment-preview:hover { background: linear-gradient(135deg, #e8ecf1 0%, #d5dbe3 100%); color: #555; }
        .ns-comment-preview .ns-user { color: #5c6bc0; font-weight: 500; margin-right: 6px; }
        .ns-comment-preview .ns-text { color: #666; }
        .ns-comment-loading { color: #aaa; font-style: italic; background: #f9f9f9; }

        /* 侧边栏容器 */
        .ns-sidebar {
            position: fixed;
            right: 15px;
            top: 80px;
            width: 260px;
            max-height: calc(100vh - 100px);
            overflow-y: auto;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* 侧边栏卡片通用样式 */
        .ns-card {
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.08);
            overflow: hidden;
            font-size: 13px;
        }
        .ns-card-header {
            padding: 10px 14px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .ns-card-header:hover { opacity: 0.9; }
        .ns-card-toggle { font-size: 14px; opacity: 0.7; }
        .ns-card-body { max-height: 300px; overflow-y: auto; }
        .ns-card.collapsed .ns-card-body { display: none; }
        .ns-card.collapsed .ns-card-header { border-radius: 10px; }

        /* 交易卡片 */
        .ns-card.trade .ns-card-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }

        /* 抽奖卡片 */
        .ns-card.lottery .ns-card-header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }

        /* 列表项 */
        .ns-item {
            padding: 10px 14px;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s;
        }
        .ns-item:last-child { border-bottom: none; }
        .ns-item:hover { background: #fafafa; }
        .ns-item a { color: #333; text-decoration: none; display: block; line-height: 1.5; }
        .ns-item a:hover { color: #1890ff; }
        .ns-item-title { display: flex; align-items: center; gap: 6px; }
        .ns-tag {
            flex-shrink: 0;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 3px;
            color: #fff;
        }
        .ns-tag.sold { background: #52c41a; }
        .ns-tag.bought { background: #1890ff; }
        .ns-tag.lottery { background: #f5576c; }
        .ns-tag.active { background: #faad14; }
        .ns-item-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 12px;
        }
        .ns-empty { text-align: center; padding: 25px; color: #999; font-size: 12px; }

        /* 深色模式 */
        @media (prefers-color-scheme: dark) {
            .ns-comment-preview { background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); border-color: #444; color: #999; }
            .ns-comment-preview:hover { background: linear-gradient(135deg, #3d3d3d 0%, #2f2f2f 100%); color: #ccc; }
            .ns-comment-preview .ns-user { color: #7986cb; }
            .ns-comment-preview .ns-text { color: #aaa; }
            .ns-card { background: #1f1f1f; box-shadow: 0 2px 12px rgba(0,0,0,0.3); }
            .ns-item { border-color: #333; }
            .ns-item:hover { background: #2a2a2a; }
            .ns-item a { color: #ddd; }
        }

        /* 响应式 */
        @media (max-width: 1400px) { .ns-sidebar { display: none; } }
    `);

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();
    const notify = (title, text) => {
        GM_notification({ title, text, timeout: 3000 });
        console.log(`[NS助手] ${title}: ${text}`);
    };
    const extractPostId = (url) => url?.match(/\/post-(\d+)/)?.[1];
    const truncate = (text, len) => {
        if (!text) return '';
        text = text.trim().replace(/\s+/g, ' ');
        return text.length > len ? text.slice(0, len) + '…' : text;
    };
    const escapeHtml = (str) => str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    // ==================== 签到功能 ====================
    const doCheckin = async () => {
        if (hasCheckedIn()) return;
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });
            const data = await res.json();
            if (data.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', data.message || '获得鸡腿奖励！');
            } else if (data.message?.includes('已完成')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 最新留言预览 ====================
    const fetchLatestComment = async (postId) => {
        const cacheKey = `comment_${postId}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.time < CONFIG.CACHE_TTL) return cached.data;

        try {
            // 先获取帖子第一页，找到总页数
            const res1 = await fetch(`https://www.nodeseek.com/post-${postId}-1`, { credentials: 'include' });
            const html1 = await res1.text();
            const doc1 = new DOMParser().parseFromString(html1, 'text/html');

            // 找最后一页
            let lastPage = 1;
            const pageLinks = doc1.querySelectorAll('a[href*="/post-' + postId + '-"]');
            pageLinks.forEach(a => {
                const m = a.href.match(/post-\d+-(\d+)/);
                if (m) lastPage = Math.max(lastPage, parseInt(m[1]));
            });

            // 获取最后一页
            let finalDoc = doc1;
            if (lastPage > 1) {
                const res2 = await fetch(`https://www.nodeseek.com/post-${postId}-${lastPage}`, { credentials: 'include' });
                finalDoc = new DOMParser().parseFromString(await res2.text(), 'text/html');
            }

            // 提取评论 - 多种选择器策略
            let result = null;

            // 策略1: 查找所有包含用户链接的评论区块
            const postBlocks = finalDoc.querySelectorAll('[class*="post"]:not([class*="post-list"]), [class*="comment"], [class*="reply"], .floor, [id*="post-"]');
            const validBlocks = Array.from(postBlocks).filter(block => {
                const hasAuthor = block.querySelector('a[href*="/space/"]');
                const hasContent = block.textContent.length > 10;
                return hasAuthor && hasContent;
            });

            if (validBlocks.length > 0) {
                const lastBlock = validBlocks[validBlocks.length - 1];
                const authorEl = lastBlock.querySelector('a[href*="/space/"]');
                // 找内容区域 - 排除用户信息区
                const contentEl = lastBlock.querySelector('[class*="content"]:not([class*="user"]), .text, .body, p:not(:empty)');

                if (authorEl) {
                    result = {
                        author: authorEl.textContent.trim().slice(0, 15),
                        content: contentEl ? contentEl.textContent.trim() : lastBlock.textContent.trim()
                    };
                }
            }

            // 策略2: 使用script中的JSON数据(如果有)
            if (!result?.content) {
                const scripts = finalDoc.querySelectorAll('script:not([src])');
                for (const script of scripts) {
                    const text = script.textContent;
                    if (text.includes('comments') || text.includes('replies') || text.includes('posts')) {
                        try {
                            const jsonMatch = text.match(/\{[\s\S]*"content"[\s\S]*\}/);
                            if (jsonMatch) {
                                const data = JSON.parse(jsonMatch[0]);
                                if (data.content) {
                                    result = { author: data.author || data.username || '用户', content: data.content };
                                    break;
                                }
                            }
                        } catch {}
                    }
                }
            }

            // 清理内容
            if (result?.content) {
                result.content = result.content
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            cache.set(cacheKey, { data: result, time: Date.now() });
            return result;
        } catch (e) {
            console.error('[NS助手] 获取评论失败:', postId, e);
            return null;
        }
    };

    const addCommentPreview = async (titleEl, postId) => {
        if (titleEl.dataset.nsProcessed) return;
        titleEl.dataset.nsProcessed = 'true';

        // 检查回复数，如果为0则跳过
        const row = titleEl.closest('tr, [class*="post-item"], [class*="row"], li');
        if (row) {
            const replyCount = row.querySelector('[class*="reply"], [class*="comment"], .count, .num');
            if (replyCount && (replyCount.textContent.trim() === '0' || replyCount.textContent.trim() === '')) {
                return; // 无回复，跳过
            }
        }

        const preview = document.createElement('span');
        preview.className = 'ns-comment-preview ns-comment-loading';
        preview.textContent = '加载中...';

        // 插入到标题后面
        if (titleEl.nextSibling) {
            titleEl.parentNode.insertBefore(preview, titleEl.nextSibling);
        } else {
            titleEl.parentNode.appendChild(preview);
        }

        const comment = await fetchLatestComment(postId);

        if (comment?.content && comment.content.length > 2) {
            preview.className = 'ns-comment-preview';
            const author = escapeHtml(truncate(comment.author, 10));
            const content = escapeHtml(truncate(comment.content, CONFIG.PREVIEW_MAX_LEN));
            preview.innerHTML = `<span class="ns-user">${author}:</span><span class="ns-text">${content}</span>`;
            preview.title = `${comment.author}: ${comment.content}`;
        } else {
            preview.remove();
        }
    };

    const processPostList = () => {
        // 查找帖子标题链接
        const links = document.querySelectorAll('a[href*="/post-"]');
        const processed = new Set();

        links.forEach(link => {
            const href = link.getAttribute('href');
            const postId = extractPostId(href);
            if (!postId || processed.has(postId)) return;

            // 验证是否为主标题链接
            const text = link.textContent.trim();
            if (text.length < 5) return; // 标题太短，可能是页码等

            // 排除元信息区域的链接
            if (link.closest('[class*="meta"], [class*="info"], [class*="stat"], [class*="page"], .pagination')) return;

            // 确保是帖子标题
            const parent = link.closest('h2, h3, h4, [class*="title"], [class*="subject"], td, .topic');
            if (!parent) return;

            processed.add(postId);
            addCommentPreview(link, postId);
        });
    };

    // ==================== 侧边栏功能 ====================
    const fetchPosts = async (url, filter) => {
        try {
            const res = await fetch(url, { credentials: 'include' });
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const posts = [];
            const links = doc.querySelectorAll('a[href*="/post-"]');
            const seen = new Set();

            links.forEach(link => {
                const title = link.textContent.trim();
                const href = link.getAttribute('href');
                const postId = extractPostId(href);

                if (!postId || seen.has(postId) || title.length < 5) return;
                if (posts.length >= CONFIG.SIDEBAR_COUNT) return;

                const filterResult = filter(title);
                if (filterResult) {
                    seen.add(postId);
                    posts.push({
                        title: filterResult.cleanTitle || title,
                        url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}`,
                        type: filterResult.type,
                        tag: filterResult.tag
                    });
                }
            });

            return posts;
        } catch (e) {
            console.error('[NS助手] 获取帖子失败:', e);
            return [];
        }
    };

    // 交易记录过滤器
    const tradeFilter = (title) => {
        const soldMatch = title.match(/[\[【(（]?\s*已出\s*[\]】)）]?/);
        const boughtMatch = title.match(/[\[【(（]?\s*已收\s*[\]】)）]?/);
        if (!soldMatch && !boughtMatch) return null;

        let cleanTitle = title
            .replace(/[\[【(（]?\s*已出\s*[\]】)）]?/g, '')
            .replace(/[\[【(（]?\s*已收\s*[\]】)）]?/g, '')
            .trim();

        return {
            cleanTitle,
            type: soldMatch ? 'sold' : 'bought',
            tag: soldMatch ? '已出' : '已收'
        };
    };

    // 抽奖帖过滤器
    const lotteryFilter = (title) => {
        const isEnded = /已开奖|已结束|已完成/.test(title);
        const isLottery = /抽奖|开奖|福利|免费送|白嫖/.test(title);
        if (!isLottery) return null;

        let cleanTitle = title
            .replace(/[\[【(（]?\s*(已开奖|抽奖|开奖|福利)\s*[\]】)）]?/g, '')
            .trim();

        return {
            cleanTitle: cleanTitle || title,
            type: isEnded ? 'ended' : 'active',
            tag: isEnded ? '已开奖' : '抽奖中'
        };
    };

    const createSidebar = async () => {
        if (document.querySelector('.ns-sidebar')) return;

        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        document.body.appendChild(sidebar);

        // 创建交易卡片
        const tradeCard = createCard('trade', '📦 最近成交', CONFIG.TRADE_URL, tradeFilter);
        sidebar.appendChild(tradeCard);

        // 创建抽奖卡片
        const lotteryCard = createCard('lottery', '🎁 最新抽奖', CONFIG.HOME_URL, lotteryFilter);
        sidebar.appendChild(lotteryCard);
    };

    const createCard = (type, title, url, filter) => {
        const card = document.createElement('div');
        card.className = `ns-card ${type}`;
        card.innerHTML = `
            <div class="ns-card-header">
                <span>${title}</span>
                <span class="ns-card-toggle">−</span>
            </div>
            <div class="ns-card-body">
                <div class="ns-empty">加载中...</div>
            </div>
        `;

        // 折叠功能
        const header = card.querySelector('.ns-card-header');
        const toggle = card.querySelector('.ns-card-toggle');
        header.addEventListener('click', () => {
            card.classList.toggle('collapsed');
            toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
        });

        // 加载数据
        loadCardData(card, url, filter, type);

        return card;
    };

    const loadCardData = async (card, url, filter, type) => {
        const body = card.querySelector('.ns-card-body');
        const posts = await fetchPosts(url, filter);

        if (posts.length === 0) {
            body.innerHTML = '<div class="ns-empty">暂无数据</div>';
            return;
        }

        body.innerHTML = posts.map(p => `
            <div class="ns-item">
                <a href="${p.url}" target="_blank" title="${escapeHtml(p.title)}">
                    <div class="ns-item-title">
                        <span class="ns-tag ${p.type}">${p.tag}</span>
                        <span class="ns-item-text">${escapeHtml(truncate(p.title, 25))}</span>
                    </div>
                </a>
            </div>
        `).join('');
    };

    // ==================== 初始化 ====================
    const init = () => {
        console.log('[NS助手] 初始化...');

        // 签到
        setTimeout(doCheckin, 2000);

        // 帖子列表处理
        const isListPage = location.pathname === '/' ||
            location.pathname.includes('/board') ||
            location.pathname.includes('/categor');

        if (isListPage) {
            // 延迟处理，等待页面加载完成
            setTimeout(processPostList, 1500);

            // 监听动态加载
            const observer = new MutationObserver(() => {
                setTimeout(processPostList, 300);
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // 侧边栏
            setTimeout(createSidebar, 2000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
