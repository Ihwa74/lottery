// lottery_bridge_rtdb.js
// ----------------------
// 目標：在「不改原本抽獎流程」的前提下，
//      讓手機可以透過 Firebase 遙控後台，就像本機手機一樣。

(function () {
    // 小工具：把 event 寫進 localStorage，並且手動觸發 storage 事件
    function dispatchStorageLike(key, valueObj) {
        var value = JSON.stringify(valueObj || null);

        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.error('寫入 localStorage 失敗', e);
        }

        try {
            var evt = new StorageEvent('storage', {
                key: key,
                newValue: value
            });
            window.dispatchEvent(evt);
        } catch (e) {
            console.warn('建立 StorageEvent 失敗，改用備用方案', e);
        }
    }

    // ----------------------
    // 手機端（mobile）
    // ----------------------
    async function initMobile() {
        if (!window.firebaseCore) {
            console.error('❌ initMobile: 找不到 firebaseCore，請確認 firebase_core.js 已載入且已初始化');
            return;
        }

        console.log('📱 lotteryBridge: 初始化手機端');

        if (!window.firebaseCore) return;

        const core = window.firebaseCore;
        const dataPaths = ['prizes', 'winners', 'bonusSettings', 'lotteryState'];

        // 監聽後台同步上來的每一項資料
        dataPaths.forEach(path => {
            core.onDataChange(path, (data) => {
                if (data) {
                    console.log(`📱 遠端 ${path} 資料更新`, data);
                    localStorage.setItem(path, JSON.stringify(data));
                
                    // 如果是獎項更新，通知手機頁面重新渲染下拉選單
                    if (path === 'prizes' || path === 'bonusSettings' || path === 'winners') {
                        if (typeof window.loadAvailablePrizes === 'function') {
                        window.loadAvailablePrizes();
                        }
                    }
                    // 如果是狀態更新，通知 UI
                    if (path === 'lotteryState' && typeof window.updateUI === 'function') {
                    window.updateUI();
                    }
                }
            });
        });

        // 1) 攔截原本的 sendLotteryEvent
        var originalSendLotteryEvent = window.sendLotteryEvent;

        if (typeof originalSendLotteryEvent !== 'function') {
            console.warn('⚠️ 找不到原本的 sendLotteryEvent(event)，請確認 mobile 頁面腳本順序');
        }

        window.sendLotteryEvent = async function (event) {
            console.log('📱 sendLotteryEvent(手機) 被呼叫，event =', event);

            // 先送到 Firebase，讓後台可以收到
            var command = {
                id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                source: 'mobile',
                event: event,
                timestamp: Date.now()
            };

            try {
                await window.firebaseCore.setData('remoteLotteryEvent', command);
                console.log('📤 已送出遠端抽獎命令到 Firebase:', command);
            } catch (err) {
                console.error('❌ 送出遠端抽獎命令失敗:', err);
            }

            // 再執行原本本地邏輯（方便你在同一台電腦測試）
            if (typeof originalSendLotteryEvent === 'function') {
                try {
                    originalSendLotteryEvent(event);
                } catch (e) {
                    console.error('原本 sendLotteryEvent 執行錯誤:', e);
                }
            }
        };

           console.log('✅ 手機端初始化完成，已準備好攔截指令並同步');
        } // 這裡結束 initMobile 函數

    // ----------------------
    // 後台（admin）
    // ----------------------
    function initAdmin() {
        if (!window.firebaseCore) {
            console.error('❌ initAdmin: 找不到 firebaseCore，請確認 firebase_core.js 已載入且已初始化');
            return;
        }

        console.log('🖥️ lotteryBridge: 初始化後台端');

        var lastCommandId = null;

        // 監聽 Firebase 的遠端命令
        window.firebaseCore.onDataChange('remoteLotteryEvent', function (command, source) {
            if (!command) return;

            // 避免重複處理
            if (command.id && command.id === lastCommandId) {
                return;
            }
            lastCommandId = command.id || null;

            // 目前只有手機會送，所以這行只是預留
            if (command.source === 'admin') {
                return;
            }

            var event = command.event || command;
            console.log('📥 從 Firebase 收到遠端抽獎命令:', event);

            // 關鍵：把 remote 事件轉成「本機手機」寫入 localStorage 的效果
            // 這樣就會觸發原本 admin 的 storage 監聽器與 handleLotteryEvent
            try {
                dispatchStorageLike('lotteryEvent', event);
                console.log('✅ 已在後台模擬本機 lotteryEvent，觸發原本抽獎流程');
            } catch (e) {
                console.error('❌ 後台模擬 lotteryEvent 失敗:', e);
                // 備用：如果你有暴露 handleLotteryEvent，可以直接呼叫
                if (typeof window.handleLotteryEvent === 'function') {
                    console.warn('改用備用方案：直接呼叫 handleLotteryEvent');
                    window.handleLotteryEvent(event);
                }
            }
        });

        console.log('✅ 後台已啟用遠端命令監聽');
    }

    // ----------------------
    // 大螢幕（display）
    // ----------------------
    function initDisplay() {
        // 目前 display 只依賴 admin 寫入的 localStorage（lotteryStateUpdate / lotteryResult）
        // 不需要額外 Firebase 邏輯；這裡先保留 hook 以後擴充。
        console.log('🧾 lotteryBridge: 顯示頁面目前不需要額外橋接邏輯');
    }

    // ----------------------
    // 對外 export
    // ----------------------
    window.lotteryBridge = {
        init: function (mode) {
            console.log('🌉 lotteryBridge.init(', mode, ')');

            if (mode === 'mobile') {
                initMobile();
            } else if (mode === 'admin') {
                initAdmin();
            } else if (mode === 'display') {
                initDisplay();
            } else {
                console.warn('⚠️ 未知的頁面模式:', mode);
            }
        }
    };
})();