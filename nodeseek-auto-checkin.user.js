// ==UserScript==
// @name         NodeSeek 增强助手
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      2.6.1
// @description  NodeSeek论坛增强：自动签到 + 交易监控 + 抽奖追踪 + 关键字监控 + 自动翻页
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @grant        GM_addStyle
// @run-at       document-end
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
        VISITED_KEY: 'ns_visited_posts',
        WIN_CHECK_KEY: 'ns_win_check',
        KEYWORD_KEY: 'ns_keywords',
        SETTINGS_KEY: 'ns_settings',
        RANDOM_MODE: true,
        TRADE_COUNT: 5,
        LOTTERY_COUNT: 5,
        WIN_CHECK_INTERVAL: 10 * 60 * 1000,
        KEYWORDS_EXACT: ['VPS', 'CN2', 'GIA'],
        KEYWORDS_FUZZY: ['优惠', '特价', '免费', '白嫖', '羊毛'],
        KEYWORD_MONITOR_INTERVAL: 30 * 1000,
        KEYWORD_MONITOR_ENABLED: true,
        AUTO_PAGE_ENABLED: false,
        AUTO_PAGE_INTERVAL: 60
    };

    // ==================== 样式注入（优化布局） ====================
    GM_addStyle(`
        .post-list a.ns-visited-post,
        .post-item a.ns-visited-post,
        [class*="post"] a.ns-visited-post,
        a.post-title.ns-visited-post {
            color: #e74c3c !important;
        }
        .post-list a.ns-visited-post::after,
        .post-item a.ns-visited-post::after,
        [class*="post"] a.ns-visited-post::after,
        a.post-title.ns-visited-post::after {
            content: ' [已浏览]';
            font-size: 10px;
            color: #e74c3c;
        }
        .ns-sidebar {
            position: fixed;
            right: 8px;
            top: 60px;
            width: 200px;
            max-height: calc(100vh - 70px);
            overflow-y: auto;
            z-index: 9998;
            display: flex;
            flex-direction: column;
            gap: 4px;
            scrollbar-width: thin;
        }
        .ns-sidebar::-webkit-scrollbar { width: 3px; }
        .ns-sidebar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
        .ns-card {
            background: #fff;
            border-radius: 6px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            overflow: hidden;
            font-size: 11px;
        }
        .ns-card-header {
            padding: 5px 8px;
            font-weight: 600;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }
        .ns-card-toggle { opacity: 0.7; font-size: 9px; }
        .ns-card.collapsed .ns-card-body { display: none; }
        .ns-card.trade .ns-card-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
        .ns-card.lottery .ns-card-header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: #fff; }
        .ns-card.keyword .ns-card-header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: #fff; }
        .ns-card.autopage .ns-card-header { background: linear-gradient(135deg, #4776E6 0%, #8E54E9 100%); color: #fff; }
        .ns-card.settings .ns-card-header { background: linear-gradient(135deg, #636e72 0%, #2d3436 100%); color: #fff; }
        .ns-item {
            padding: 4px 8px;
            border-bottom: 1px solid #f0f0f0;
        }
        .ns-item:last-child { border-bottom: none; }
        .ns-item:hover { background: #f8f9fa; }
        .ns-item a {
            color: #333;
            text-decoration: none;
            display: flex;
            flex-direction: column;
            gap: 1px;
            line-height: 1.2;
            font-size: 10px;
        }
        .ns-item a:hover { color: #1890ff; }
        .ns-item.visited { background: #fff5f5; }
        .ns-item.visited a { color: #e74c3c; }
        .ns-visited-mark { font-size: 8px; color: #e74c3c; margin-left: 3px; }
        .ns-item-row { display: flex; align-items: center; gap: 4px; }
        .ns-tag {
            flex-shrink: 0;
            padding: 1px 3px;
            font-size: 8px;
            border-radius: 2px;
            color: #fff;
            font-weight: 500;
        }
        .ns-tag.sell { background: #ff7875; }
        .ns-tag.buy { background: #40a9ff; }
        .ns-tag.lottery { background: #73d13d; }
        .ns-tag.exact { background: #52c41a; }
        .ns-tag.fuzzy { background: #13c2c2; }
        .ns-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ns-lottery-time { font-size: 8px; color: #fa8c16; padding-left: 20px; }
        .ns-empty { text-align: center; padding: 8px; color: #555; font-size: 10px; font-weight: 500; }
        .ns-loading { color: #1890ff; }
        .ns-panel { padding: 6px 8px; }
        .ns-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
        .ns-timer { font-size: 12px; font-weight: 600; color: #1890ff; }
        .ns-btn {
            padding: 2px 6px;
            font-size: 9px;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            color: #fff;
        }
        .ns-btn:hover { opacity: 0.8; }
        .ns-btn.green { background: #52c41a; }
        .ns-btn.red { background: #ff4d4f; }
        .ns-btn.blue { background: #1890ff; }
        .ns-info { font-size: 9px; color: #999; }
        .ns-input {
            width: 100%;
            padding: 3px 5px;
            font-size: 9px;
            border: 1px solid #ddd;
            border-radius: 2px;
            box-sizing: border-box;
            margin-top: 2px;
        }
        .ns-input:focus { outline: none; border-color: #1890ff; }
        .ns-input.small { width: 50px; text-align: center; }
        .ns-label { font-size: 9px; color: #666; margin-bottom: 2px; display: flex; align-items: center; gap: 3px; }
        .ns-group { margin-bottom: 6px; }
        .ns-keyword-match { background: linear-gradient(120deg, #e8f5e9 0%, #e3f2fd 100%); border-left: 2px solid #52c41a; }
        @media (prefers-color-scheme: dark) {
            .ns-card { background: #242424; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
            .ns-item { border-color: #333; }
            .ns-item:hover { background: #2d2d2d; }
            .ns-item a { color: #e0e0e0; }
            .ns-item.visited { background: #2d1a1a; }
            .ns-item.visited a { color: #ff6b6b; }
            .ns-empty { color: #bbb; }
            .ns-input { background: #333; border-color: #444; color: #e0e0e0; }
            .ns-label { color: #aaa; }
            .ns-info { color: #666; }
            .post-list a.ns-visited-post, a.post-title.ns-visited-post { color: #ff6b6b !important; }
        }
        @media (max-width: 800px) { .ns-sidebar:not(.ns-force-show) { display: none; } }
        .ns-zoom-controls { display: flex; align-items: center; gap: 3px; }
        .ns-zoom-btn { width: 20px; height: 20px; font-size: 12px; padding: 0; line-height: 20px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; }
        .ns-zoom-btn:hover { background: #e0e0e0; }
        .ns-zoom-value { font-size: 9px; min-width: 32px; text-align: center; }
        .ns-toggle-btn { position: fixed; right: 8px; top: 60px; z-index: 9999; padding: 4px 8px; font-size: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border: none; border-radius: 4px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .ns-toggle-btn:hover { opacity: 0.9; }
        .ns-toggle-btn.active { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); }
    `);

    // ==================== 设置管理 ====================
    const getSettings = () => {
        try {
            return GM_getValue(CONFIG.SETTINGS_KEY) || {};
        } catch { return {}; }
    };

    const saveSetting = (key, value) => {
        const settings = getSettings();
        settings[key] = value;
        GM_setValue(CONFIG.SETTINGS_KEY, settings);
    };

    const getSetting = (key, defaultValue) => {
        const settings = getSettings();
        return settings[key] !== undefined ? settings[key] : defaultValue;
    };

    const getScale = () => getSetting('sidebarScale', 100);
    const setScale = (scale) => {
        scale = Math.max(50, Math.min(150, scale));
        saveSetting('sidebarScale', scale);
        applySidebarScale(scale);
        return scale;
    };
    const applySidebarScale = (scale) => {
        const sidebar = document.querySelector('.ns-sidebar');
        if (sidebar) {
            sidebar.style.transform = `scale(${scale / 100})`;
            sidebar.style.transformOrigin = 'top right';
        }
    };

    const getSidebarVisible = () => getSetting('sidebarVisible', true);
    const setSidebarVisible = (visible) => saveSetting('sidebarVisible', visible);

    const getKeywords = () => {
        try {
            const saved = GM_getValue(CONFIG.KEYWORD_KEY);
            if (saved) return saved;
        } catch {}
        return { exact: CONFIG.KEYWORDS_EXACT, fuzzy: CONFIG.KEYWORDS_FUZZY };
    };

    const saveKeywords = (exact, fuzzy) => {
        GM_setValue(CONFIG.KEYWORD_KEY, { exact, fuzzy });
    };

    // ==================== 工具函数 ====================
    const getToday = () => new Date().toISOString().slice(0, 10);
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();
    const notify = (title, text, onclick) => {
        GM_notification({ title, text, timeout: 5000, onclick });
    };
    const extractPostId = (url) => {
        if (!url || typeof url !== 'string') return null;
        // 匹配帖子链接：/post-数字 后可接 -页码、.html、#锚点 或 ?查询
        const match = url.match(/\/post-(\d+)(?=[-.#?]|$)/);
        return match ? match[1] : null;
    };
    const truncate = (str, len) => str && str.length > len ? str.trim().slice(0, len) + '…' : (str || '').trim();
    const escapeHtml = (str) => str ? str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : '';

    // ==================== 已浏览帖子管理（优化内存） ====================
    let visitedCache = null;
    const getVisitedPosts = () => {
        if (visitedCache) return visitedCache;
        try {
            const stored = GM_getValue(CONFIG.VISITED_KEY);
            // 验证数据格式，必须是对象且值为数字
            if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
                visitedCache = {};
                Object.keys(stored).forEach(id => {
                    // 只保留有效的数字ID和时间戳
                    if (/^\d+$/.test(id) && typeof stored[id] === 'number') {
                        visitedCache[id] = stored[id];
                    }
                });
            } else {
                visitedCache = {};
            }
        } catch {
            visitedCache = {};
        }
        return visitedCache;
    };

    const markAsVisited = (postId) => {
        // 严格验证 postId 必须是纯数字
        if (!postId || !/^\d+$/.test(String(postId))) return;
        postId = String(postId);
        const visited = getVisitedPosts();
        // 防止重复标记同一秒内的操作
        if (visited[postId] && Date.now() - visited[postId] < 1000) return;
        visited[postId] = Date.now();
        // 只保留最近14天的记录（优化内存）
        const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
        Object.keys(visited).forEach(id => {
            if (visited[id] < cutoff) delete visited[id];
        });
        visitedCache = visited;
        GM_setValue(CONFIG.VISITED_KEY, visited);
    };

    const isVisited = (postId) => {
        if (!postId || !/^\d+$/.test(String(postId))) return false;
        return !!getVisitedPosts()[String(postId)];
    };

    // 清除无效的已浏览记录（用户可调用）
    const clearVisitedCache = () => {
        visitedCache = null;
        GM_setValue(CONFIG.VISITED_KEY, {});
        console.log('[NS助手] 已清除浏览记录缓存');
    };

    // ==================== 全站已浏览帖子标红（优化性能） ====================
    let markTimeout = null;
    const markVisitedPostsOnPage = () => {
        if (markTimeout) return;
        markTimeout = setTimeout(() => {
            const visited = getVisitedPosts();
            document.querySelectorAll('a[href*="/post-"]:not(.ns-visited-post)').forEach(link => {
                const postId = extractPostId(link.getAttribute('href'));
                if (postId && visited[postId]) link.classList.add('ns-visited-post');
            });
            markTimeout = null;
        }, 100);
    };

    const trackCurrentPost = () => {
        const postId = extractPostId(location.href);
        if (postId) markAsVisited(postId);
    };

    // ==================== 签到功能 ====================
    const getCSRFToken = () => {
        // 方法1: 从 cookie 获取
        const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
        if (match) return match[1];
        // 方法2: 从 meta 标签获取
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        // 方法3: 从页面脚本中获取
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const text = script.textContent || '';
            const tokenMatch = text.match(/csrfToken['":\s]+['"]([^'"]+)['"]/);
            if (tokenMatch) return tokenMatch[1];
        }
        return null;
    };

    const doCheckin = async () => {
        if (hasCheckedIn()) return;
        try {
            // 获取 CSRF token
            const csrfToken = getCSRFToken();
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            };
            if (csrfToken) {
                headers['X-CSRF-Token'] = csrfToken;
            }

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });
            const data = await res.json();
            if (data.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', data.message || '获得鸡腿奖励！');
                console.log('[NS助手] 签到成功:', data);
            } else if (data.message?.includes('已完成') || data.message?.includes('已签到') || data.message?.includes('already')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                console.log('[NS助手] 今日已签到');
            } else {
                console.warn('[NS助手] 签到返回:', data);
            }
        } catch (e) {
            console.error('[NS助手] 签到异常:', e);
        }
    };

    // ==================== 数据获取（优化内存） ====================
    const fetchPageTitles = async (url) => {
        try {
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) return [];
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const posts = [], seen = new Set();
            doc.querySelectorAll('a[href*="/post-"]').forEach(link => {
                const href = link.getAttribute('href');
                const postId = extractPostId(href);
                const title = link.textContent?.trim();
                if (!postId || !title || title.length < 3 || seen.has(postId)) return;
                if (link.closest('.pagination')) return;
                seen.add(postId);
                posts.push({ id: postId, title, url: href.startsWith('http') ? href : `https://www.nodeseek.com${href}` });
            });
            return posts;
        } catch { return []; }
    };

    // ==================== 交易帖获取 ====================
    const fetchActiveTrades = async () => {
        const posts = await fetchPageTitles(CONFIG.TRADE_URL);
        const results = [];
        for (const post of posts) {
            if (results.length >= CONFIG.TRADE_COUNT) break;
            if (/版块规定|中介索引|防骗提示|骗子索引/i.test(post.title)) continue;
            if (/已出|已收|已售|sold|closed/i.test(post.title)) continue;
            const isBuy = /收|求|buy|购/i.test(post.title);
            results.push({ ...post, type: isBuy ? 'buy' : 'sell', tag: isBuy ? '求购' : '出售', visited: isVisited(post.id) });
        }
        return results;
    };

    // ==================== 抽奖帖获取 ====================
    const extractLotteryTime = (title) => {
        const now = new Date();
        const isValid = (m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31;
        let m, match = title.match(/(\d{1,2})月(\d{1,2})[日号]\s*(\d{1,2})[时点:：](\d{2})?/);
        if (match && isValid(+match[1], +match[2])) return `${match[1]}月${match[2]}日${match[3]}:${match[4]||'00'}开奖`;
        match = title.match(/(\d{1,2})月(\d{1,2})[日号]/);
        if (match && isValid(+match[1], +match[2])) return `${match[1]}月${match[2]}日开奖`;
        match = title.match(/今[天晚日].*?(\d{1,2})[时点:：]/);
        if (match) return `${now.getMonth()+1}月${now.getDate()}日${match[1]}:00开奖`;
        match = title.match(/(\d+)\s*[楼层]/);
        if (match && +match[1] >= 20) return `${match[1]}楼开奖`;
        return null;
    };

    const fetchActiveLotteries = async () => {
        const posts = await fetchPageTitles(CONFIG.HOME_URL);
        const results = [], seen = new Set();
        for (const post of posts) {
            if (results.length >= CONFIG.LOTTERY_COUNT || seen.has(post.id)) continue;
            if (!/抽奖|开奖|送.{0,5}名|随机抽/.test(post.title)) continue;
            if (/已开奖|已结束|开奖结果|中奖名单/i.test(post.title)) continue;
            seen.add(post.id);
            const cleanTitle = post.title.replace(/[\[【(（]?\s*(抽奖|开奖)\s*[\]】)）]?/gi, '').trim();
            results.push({ ...post, title: cleanTitle || post.title, tag: '抽奖', lotteryTime: extractLotteryTime(post.title), visited: isVisited(post.id) });
        }
        return results;
    };

    // ==================== 中奖检测（优化） ====================
    const checkWinStatus = async () => {
        const participated = GM_getValue(CONFIG.WIN_CHECK_KEY) || {};
        const postIds = Object.keys(participated).filter(id => !participated[id].won).slice(0, 2);
        for (const postId of postIds) {
            try {
                const res = await fetch(`https://www.nodeseek.com/post-${postId}.html`, { credentials: 'include' });
                if (!res.ok) continue;
                const html = await res.text();
                const userMatch = html.match(/data-username="([^"]+)"/);
                if (!userMatch) continue;
                if (/已开奖|开奖结果|中奖名单/i.test(html)) {
                    participated[postId].ended = true;
                    if (new RegExp(`@${userMatch[1]}|恭喜\\s*${userMatch[1]}`, 'i').test(html)) {
                        participated[postId].won = true;
                        notify('🎉 恭喜中奖！', `您在「${truncate(participated[postId].title, 20)}」中奖了！`);
                    }
                    GM_setValue(CONFIG.WIN_CHECK_KEY, participated);
                }
            } catch {}
        }
    };

    const monitorLotteryParticipation = () => {
        const postId = extractPostId(location.href);
        if (!postId || !/抽奖|开奖/i.test(document.title)) return;
        setTimeout(() => {
            const user = document.querySelector('[data-username]')?.getAttribute('data-username');
            if (user && document.querySelector(`[href*="${user}"]`)) {
                const participated = GM_getValue(CONFIG.WIN_CHECK_KEY) || {};
                if (!participated[postId]) {
                    participated[postId] = { title: document.title.replace(/ - NodeSeek$/, ''), addedAt: Date.now() };
                    GM_setValue(CONFIG.WIN_CHECK_KEY, participated);
                }
            }
        }, 2000);
    };

    // ==================== 关键字监控（优化） ====================
    let notifiedToday = null;
    const getNotifiedPosts = () => {
        if (notifiedToday?.date === getToday()) return notifiedToday.posts;
        try {
            const data = GM_getValue('ns_keyword_notified');
            if (data?.date === getToday()) { notifiedToday = data; return data.posts; }
        } catch {}
        notifiedToday = { date: getToday(), posts: {} };
        return notifiedToday.posts;
    };

    const markPostNotified = (postId) => {
        const posts = getNotifiedPosts();
        posts[postId] = 1;
        notifiedToday = { date: getToday(), posts };
        GM_setValue('ns_keyword_notified', notifiedToday);
    };

    const matchKeyword = (title, exactList, fuzzyList) => {
        const lower = title.toLowerCase();
        for (const kw of exactList) if (lower.includes(kw.toLowerCase())) return { type: 'exact', kw };
        for (const kw of fuzzyList) if (lower.includes(kw.toLowerCase())) return { type: 'fuzzy', kw };
        return null;
    };

    const fetchKeywordMatches = async () => {
        if (!CONFIG.KEYWORD_MONITOR_ENABLED) return [];
        const kw = getKeywords();
        if (!kw.exact.length && !kw.fuzzy.length) return [];
        const posts = await fetchPageTitles(CONFIG.HOME_URL);
        const results = [];
        for (const post of posts) {
            const match = matchKeyword(post.title, kw.exact, kw.fuzzy);
            if (match) {
                results.push({ ...post, matchType: match.type, keyword: match.kw, tag: `${match.type === 'exact' ? '精准' : '模糊'}:${match.kw}`, visited: isVisited(post.id), notified: !!getNotifiedPosts()[post.id] });
            }
        }
        return results;
    };

    let keywordTimer = null;
    const startKeywordMonitor = () => {
        if (!CONFIG.KEYWORD_MONITOR_ENABLED || keywordTimer) return;
        const check = async () => {
            const matches = await fetchKeywordMatches();
            const newMatches = matches.filter(m => !m.notified).slice(0, 3);
            for (const m of newMatches) {
                notify(`🔍 ${m.keyword}`, truncate(m.title, 30), () => window.open(m.url, '_blank'));
                markPostNotified(m.id);
            }
            if (newMatches.length && sidebarInstance) {
                const card = sidebarInstance.querySelector('.ns-card.keyword');
                if (card) renderKeywordCard(card, await fetchKeywordMatches());
            }
        };
        setTimeout(check, 3000);
        keywordTimer = setInterval(check, CONFIG.KEYWORD_MONITOR_INTERVAL);
    };

    // ==================== 自动翻页 ====================
    let autoPageTimer = null, autoPageCountdown = 0, autoPageRunning = false;

    const getAutoPageInterval = () => getSetting('autoPageInterval', CONFIG.AUTO_PAGE_INTERVAL);

    const goToNextPage = () => {
        const next = document.querySelector('a.next, a[rel="next"], .pagination a:last-child');
        if (next?.href) { location.href = next.href; return; }
        const url = location.href, match = url.match(/[?&]page=(\d+)/);
        location.href = match ? url.replace(/([?&]page=)\d+/, `$1${+match[1]+1}`) : (url.includes('?') ? url+'&page=2' : url+'?page=2');
    };

    const updateAutoPageUI = () => {
        const timer = document.querySelector('.ns-timer');
        const startBtn = document.querySelector('.ns-btn.start');
        const stopBtn = document.querySelector('.ns-btn.stop');
        if (timer) { timer.textContent = autoPageRunning ? `${autoPageCountdown}s` : '停止'; timer.style.color = autoPageRunning ? '#1890ff' : '#999'; }
        if (startBtn) startBtn.style.display = autoPageRunning ? 'none' : 'inline-block';
        if (stopBtn) stopBtn.style.display = autoPageRunning ? 'inline-block' : 'none';
    };

    const startAutoPage = (interval) => {
        if (autoPageRunning) return;
        autoPageRunning = true;
        autoPageCountdown = interval || getAutoPageInterval();
        autoPageTimer = setInterval(() => {
            autoPageCountdown--;
            updateAutoPageUI();
            if (autoPageCountdown <= 0) goToNextPage();
        }, 1000);
        updateAutoPageUI();
    };

    const stopAutoPage = () => {
        autoPageRunning = false;
        if (autoPageTimer) { clearInterval(autoPageTimer); autoPageTimer = null; }
        updateAutoPageUI();
    };

    // ==================== 侧边栏UI ====================
    let sidebarInstance = null;

    const createToggleButton = () => {
        document.querySelector('.ns-toggle-btn')?.remove();
        const btn = document.createElement('button');
        btn.className = 'ns-toggle-btn';
        btn.textContent = '📌 助手';
        btn.title = '显示/隐藏助手面板';
        btn.onclick = () => {
            const sidebar = document.querySelector('.ns-sidebar');
            if (sidebar) {
                const isVisible = sidebar.style.display !== 'none';
                sidebar.style.display = isVisible ? 'none' : 'flex';
                sidebar.classList.toggle('ns-force-show', !isVisible);
                btn.classList.toggle('active', !isVisible);
                setSidebarVisible(!isVisible);
            }
        };
        document.body.appendChild(btn);
        return btn;
    };

    const createSidebar = () => {
        document.querySelector('.ns-sidebar')?.remove();
        const sidebar = document.createElement('div');
        sidebar.className = 'ns-sidebar';
        const kw = getKeywords();
        const interval = getAutoPageInterval();
        const scale = getScale();

        sidebar.innerHTML = `
            <div class="ns-card autopage">
                <div class="ns-card-header"><span>📄 自动翻页</span><span class="ns-card-toggle">−</span></div>
                <div class="ns-card-body">
                    <div class="ns-panel">
                        <div class="ns-row">
                            <span class="ns-timer">停止</span>
                            <div>
                                <button class="ns-btn green start">启动</button>
                                <button class="ns-btn red stop" style="display:none">停止</button>
                                <button class="ns-btn blue next">下页</button>
                            </div>
                        </div>
                        <div class="ns-row">
                            <span class="ns-info">间隔(秒):</span>
                            <input type="number" class="ns-input small" id="ns-interval" value="${interval}" min="10" max="300">
                        </div>
                    </div>
                </div>
            </div>
            <div class="ns-card settings">
                <div class="ns-card-header"><span>⚙️ 面板设置</span><span class="ns-card-toggle">−</span></div>
                <div class="ns-card-body">
                    <div class="ns-panel">
                        <div class="ns-group">
                            <div class="ns-label">界面缩放</div>
                            <div class="ns-row" style="margin-bottom:0">
                                <div class="ns-zoom-controls">
                                    <button class="ns-zoom-btn" id="ns-zoom-down">−</button>
                                    <span class="ns-zoom-value" id="ns-zoom-value">${scale}%</span>
                                    <button class="ns-zoom-btn" id="ns-zoom-up">+</button>
                                </div>
                                <button class="ns-btn blue" id="ns-zoom-reset" style="font-size:8px;padding:2px 4px">重置</button>
                            </div>
                        </div>
                        <div class="ns-group">
                            <div class="ns-label"><span class="ns-tag exact">精准</span>关键字</div>
                            <input type="text" class="ns-input" id="ns-kw-exact" value="${escapeHtml(kw.exact.join(', '))}" placeholder="VPS, CN2">
                        </div>
                        <div class="ns-group">
                            <div class="ns-label"><span class="ns-tag fuzzy">模糊</span>关键字</div>
                            <input type="text" class="ns-input" id="ns-kw-fuzzy" value="${escapeHtml(kw.fuzzy.join(', '))}" placeholder="优惠, 免费">
                        </div>
                        <button class="ns-btn green" id="ns-save-kw" style="width:100%;margin-top:4px">保存关键字</button>
                    </div>
                </div>
            </div>
            <div class="ns-card keyword">
                <div class="ns-card-header"><span>🔍 关键字监控</span><span class="ns-card-toggle">−</span></div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">监控中...</div></div>
            </div>
            <div class="ns-card trade">
                <div class="ns-card-header"><span>💰 最新交易</span><span class="ns-card-toggle">−</span></div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
            <div class="ns-card lottery">
                <div class="ns-card-header"><span>🎁 最新抽奖</span><span class="ns-card-toggle">−</span></div>
                <div class="ns-card-body"><div class="ns-empty ns-loading">加载中...</div></div>
            </div>
        `;

        document.body.appendChild(sidebar);

        // 卡片折叠
        sidebar.querySelectorAll('.ns-card-header').forEach(h => {
            h.onclick = () => {
                const card = h.closest('.ns-card'), toggle = h.querySelector('.ns-card-toggle');
                card.classList.toggle('collapsed');
                toggle.textContent = card.classList.contains('collapsed') ? '+' : '−';
            };
        });

        // 自动翻页
        sidebar.querySelector('.ns-btn.start').onclick = e => { e.stopPropagation(); const v = +document.getElementById('ns-interval').value || 60; saveSetting('autoPageInterval', v); startAutoPage(v); };
        sidebar.querySelector('.ns-btn.stop').onclick = e => { e.stopPropagation(); stopAutoPage(); };
        sidebar.querySelector('.ns-btn.next').onclick = e => { e.stopPropagation(); goToNextPage(); };
        document.getElementById('ns-interval').onchange = e => saveSetting('autoPageInterval', +e.target.value || 60);

        // 缩放控制
        const updateZoomDisplay = (val) => { document.getElementById('ns-zoom-value').textContent = val + '%'; };
        document.getElementById('ns-zoom-down').onclick = e => { e.stopPropagation(); updateZoomDisplay(setScale(getScale() - 10)); };
        document.getElementById('ns-zoom-up').onclick = e => { e.stopPropagation(); updateZoomDisplay(setScale(getScale() + 10)); };
        document.getElementById('ns-zoom-reset').onclick = e => { e.stopPropagation(); updateZoomDisplay(setScale(100)); };
        applySidebarScale(scale);

        // 关键字保存
        document.getElementById('ns-save-kw').onclick = async e => {
            e.stopPropagation();
            const parse = s => s.split(/[,，]/).map(x => x.trim()).filter(x => x);
            saveKeywords(parse(document.getElementById('ns-kw-exact').value), parse(document.getElementById('ns-kw-fuzzy').value));
            e.target.textContent = '已保存 ✓';
            const card = sidebar.querySelector('.ns-card.keyword');
            if (card) renderKeywordCard(card, await fetchKeywordMatches());
            setTimeout(() => e.target.textContent = '保存关键字', 1500);
        };

        sidebarInstance = sidebar;
        return sidebar;
    };

    const renderKeywordCard = (card, items) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) {
            const kw = getKeywords(), all = [...kw.exact, ...kw.fuzzy].join(', ');
            body.innerHTML = `<div class="ns-empty">暂无匹配<br><span style="font-size:8px;color:#bbb">${truncate(all, 25)}</span></div>`;
            return;
        }
        body.innerHTML = items.slice(0, 6).map(i => `
            <div class="ns-item ns-keyword-match ${i.visited?'visited':''}" data-id="${i.id}">
                <a href="${escapeHtml(i.url)}" target="_blank" title="${escapeHtml(i.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag ${i.matchType}">${i.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(i.title, 12))}</span>
                        ${i.visited?'<span class="ns-visited-mark">[已浏览]</span>':''}
                    </div>
                </a>
            </div>
        `).join('');
        body.querySelectorAll('.ns-item').forEach(el => el.onclick = () => { markAsVisited(el.dataset.id); el.classList.add('visited'); });
    };

    const renderItemCard = (card, items, emptyText) => {
        const body = card.querySelector('.ns-card-body');
        if (!items?.length) { body.innerHTML = `<div class="ns-empty">${emptyText}</div>`; return; }
        body.innerHTML = items.map(i => `
            <div class="ns-item ${i.visited?'visited':''}" data-id="${i.id}">
                <a href="${escapeHtml(i.url)}" target="_blank" title="${escapeHtml(i.title)}">
                    <div class="ns-item-row">
                        <span class="ns-tag ${i.type||i.tag?.toLowerCase()}">${i.tag}</span>
                        <span class="ns-title">${escapeHtml(truncate(i.title, 14))}</span>
                        ${i.visited?'<span class="ns-visited-mark">[已浏览]</span>':''}
                    </div>
                    ${i.lotteryTime?`<div class="ns-lottery-time">⏰ ${escapeHtml(i.lotteryTime)}</div>`:''}
                </a>
            </div>
        `).join('');
        body.querySelectorAll('.ns-item').forEach(el => el.onclick = () => { markAsVisited(el.dataset.id); el.classList.add('visited'); });
    };

    const loadSidebarData = async (sidebar) => {
        const [trades, lotteries, keywords] = await Promise.all([fetchActiveTrades(), fetchActiveLotteries(), fetchKeywordMatches()]);
        renderKeywordCard(sidebar.querySelector('.ns-card.keyword'), keywords);
        renderItemCard(sidebar.querySelector('.ns-card.trade'), trades, '暂无交易');
        renderItemCard(sidebar.querySelector('.ns-card.lottery'), lotteries, '暂无抽奖');
    };

    // ==================== 初始化 ====================
    const init = async () => {
        console.log('[NS助手] v2.6.1');
        trackCurrentPost();
        markVisitedPostsOnPage();
        const observer = new MutationObserver(markVisitedPostsOnPage);
        observer.observe(document.body, { childList: true, subtree: true });
        await doCheckin();
        monitorLotteryParticipation();
        setTimeout(checkWinStatus, 5000);
        setInterval(checkWinStatus, CONFIG.WIN_CHECK_INTERVAL);
        startKeywordMonitor();
        setTimeout(async () => {
            const toggleBtn = createToggleButton();
            const sidebar = createSidebar();
            // 恢复显示状态
            const visible = getSidebarVisible();
            if (!visible) {
                sidebar.style.display = 'none';
                toggleBtn.classList.add('active');
            }
            await loadSidebarData(sidebar);
            if (CONFIG.AUTO_PAGE_ENABLED) startAutoPage();
        }, 500);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
