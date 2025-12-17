// ==UserScript==
// @name         NodeSeek 自动签到
// @namespace    https://github.com/weiruankeji2025/weiruan-nodeseek-Sign.in
// @version      1.0.0
// @description  NodeSeek论坛自动签到脚本，支持随机/固定鸡腿模式
// @author       weiruankeji2025
// @match        https://www.nodeseek.com/*
// @icon         https://www.nodeseek.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        API_URL: 'https://www.nodeseek.com/api/attendance',
        STORAGE_KEY: 'ns_last_checkin',
        RANDOM_MODE: true  // true: 随机鸡腿, false: 固定5鸡腿
    };

    // 获取今日日期字符串
    const getToday = () => new Date().toISOString().slice(0, 10);

    // 检查今日是否已签到
    const hasCheckedIn = () => GM_getValue(CONFIG.STORAGE_KEY) === getToday();

    // 显示通知
    const notify = (title, text, success = true) => {
        GM_notification({
            title,
            text,
            timeout: 3000,
            image: success ? '' : ''
        });
        console.log(`[NodeSeek签到] ${title}: ${text}`);
    };

    // 执行签到
    const doCheckin = async () => {
        if (hasCheckedIn()) {
            console.log('[NodeSeek签到] 今日已签到，跳过');
            return;
        }

        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://www.nodeseek.com',
                    'Referer': 'https://www.nodeseek.com/board'
                },
                credentials: 'include',
                body: `random=${CONFIG.RANDOM_MODE}`
            });

            const result = await response.json();

            if (result.success) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                notify('签到成功', result.message || '获得鸡腿奖励！');
            } else if (result.message?.includes('已完成签到')) {
                GM_setValue(CONFIG.STORAGE_KEY, getToday());
                console.log('[NodeSeek签到] 今日已签到过');
            } else {
                notify('签到失败', result.message || '未知错误', false);
            }
        } catch (error) {
            notify('签到异常', error.message, false);
        }
    };

    // 页面加载完成后延迟执行签到
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(doCheckin, 2000));
    } else {
        setTimeout(doCheckin, 2000);
    }
})();
