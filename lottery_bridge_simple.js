/**
 * 抽獎系統 Firebase 橋接器 - 簡化版
 * 專注於核心功能，避免複雜的錯誤
 */

console.log('🌉 載入簡化版橋接器...');

// 等待 Firebase 載入
function waitForFirebase(callback) {
    if (typeof initLotterySystem !== 'undefined' && typeof firebase !== 'undefined') {
        callback();
    } else {
        setTimeout(function() { waitForFirebase(callback); }, 500);
    }
}

// 主要初始化函數
waitForFirebase(function() {
    console.log('🌉 開始初始化簡化版橋接器...');
    
    // 初始化 Firebase
    initLotterySystem().then(function(system) {
        if (!system) {
            console.error('❌ Firebase 初始化失敗');
            return;
        }
        
        console.log('✅ Firebase 系統已初始化');
        
        // 儲存到全域
        window.firebaseCore = system.firebaseCore;
        window.lotteryEvents = system.events;
        window.stateManager = system.stateManager;
        
        // 偵測頁面類型
        var pageType = detectPageType();
        console.log('📄 頁面類型:', pageType);
        
        // 根據頁面類型設定功能
        if (pageType === 'admin') {
            setupAdmin();
        } else if (pageType === 'mobile') {
            setupMobile();
        } else if (pageType === 'display') {
            setupDisplay();
        }
        
        // 建立全域同步函數
        window.manualSync = function() {
            console.log('🔄 手動同步資料...');
            if (pageType === 'admin') {
                syncAdminToFirebase();
            } else if (pageType === 'mobile') {
                syncMobileFromFirebase();
            }
        };
        
        console.log('✅ 簡化版橋接器初始化完成');
        console.log('💡 可用指令: manualSync()');
    });
});

// 偵測頁面類型
function detectPageType() {
    var path = window.location.pathname;
    if (path.includes('admin')) return 'admin';
    if (path.includes('mobile')) return 'mobile';
    if (path.includes('display')) return 'display';
    return 'unknown';
}

// ============ 後台功能 ============
function setupAdmin() {
    console.log('💼 設定後台功能...');
    
    // 定期同步到 Firebase（每3秒）
    setInterval(function() {
        syncAdminToFirebase();
    }, 3000);
    
    // 監聽遠端命令
    if (window.lotteryEvents) {
    // 【修改】改成寫入 localStorage.lotteryCommand，讓原本的 admin 引擎接手
    window.lotteryEvents.on('START_LOTTERY', function(data) {
        console.log('💼 收到開始命令:', data);
        try {
            var prizeId = data && data.prize && data.prize.id ? data.prize.id : null;
            var command = {
                type: 'START_LOTTERY',
                prizeId: prizeId,
                source: 'firebase-remote',
                timestamp: Date.now()
            };
            localStorage.setItem('lotteryCommand', JSON.stringify(command));
            console.log('💼 已寫入 lotteryCommand (START_LOTTERY)', command);
        } catch (e) {
            console.error('寫入 lotteryCommand 失敗 (START_LOTTERY):', e);
        }
    });
    
    window.lotteryEvents.on('STOP_LOTTERY', function(data) {
        console.log('💼 收到停止命令:', data);
        try {
            var command = {
                type: 'STOP_LOTTERY',
                source: 'firebase-remote',
                timestamp: Date.now()
            };
            localStorage.setItem('lotteryCommand', JSON.stringify(command));
            console.log('💼 已寫入 lotteryCommand (STOP_LOTTERY)', command);
        } catch (e) {
            console.error('寫入 lotteryCommand 失敗 (STOP_LOTTERY):', e);
        }
    });
}
    
    // 初始同步
    setTimeout(function() {
        syncAdminToFirebase();
    }, 2000);
}

// 同步後台資料到 Firebase
function syncAdminToFirebase() {
    if (!window.firebaseCore || !window.firebaseCore.isConnected) {
        console.log('⚠️ Firebase 未連線');
        return;
    }
    
    var dataKeys = ['prizes', 'employees', 'winners', 'bonusSettings', 'lotteryState'];
    
    dataKeys.forEach(function(key) {
        var data = localStorage.getItem(key);
        if (data) {
            try {
                var parsed = JSON.parse(data);
                window.firebaseCore.setData(key, parsed);
                console.log('✅ 已同步', key);
            } catch (e) {
                console.error('同步失敗:', key, e);
            }
        }
    });
}

// 處理遠端開始命令
function handleRemoteStart(data) {
    // 【修改】先用原本方式啟動後台的抽獎引擎
    var startBtn = document.querySelector('.btn-start-lottery') || 
                   document.querySelector('button[onclick*="start"]') ||
                   document.getElementById('startLotteryBtn');
    
    if (startBtn && !startBtn.disabled) {
        console.log('💼 觸發開始按鈕');
        startBtn.click();
    } else if (window.startLottery) {
        window.startLottery();
    }

    // 【修改】同時寫入 localStorage 的 lotteryEvent，讓大螢幕啟動動畫
    try {
        var prizeId = null;
        if (data && data.prize) {
            // Firebase 事件裡通常是 { prize: { id, name }, ... }
            prizeId = data.prize.id;
        }

        var event = {
            type: 'START_LOTTERY',
            prizeId: prizeId,
            timestamp: Date.now()
        };

        localStorage.setItem('lotteryEvent', JSON.stringify(event));
        console.log('✅ 【修改】已寫入 lotteryEvent (START_LOTTERY):', event);
    } catch (e) {
        console.error('❌ 【修改】寫入 lotteryEvent 失敗:', e);
    }
}

// 處理遠端停止命令
function handleRemoteStop() {
    // 【修改】先用原本方式叫後台停下來、產生得獎者
    var stopBtn = document.querySelector('.btn-stop-lottery') || 
                  document.querySelector('button[onclick*="stop"]') ||
                  document.getElementById('stopLotteryBtn');
    
    if (stopBtn && !stopBtn.disabled) {
        console.log('💼 觸發停止按鈕');
        stopBtn.click();
    } else if (window.stopLottery) {
        window.stopLottery();
    }

    // 【修改】再寫一個 STOP_LOTTERY 的事件給大螢幕（它會「等待結果」）
    try {
        var event = {
            type: 'STOP_LOTTERY',
            timestamp: Date.now()
        };
        localStorage.setItem('lotteryEvent', JSON.stringify(event));
        console.log('✅ 【修改】已寫入 lotteryEvent (STOP_LOTTERY):', event);
    } catch (e) {
        console.error('❌ 【修改】寫入 lotteryEvent 失敗:', e);
    }
}

// ============ 手機功能 ============
function setupMobile() {
    console.log('📱 設定手機功能...');
    
    // 載入獎項資料
    setTimeout(function() {
        syncMobileFromFirebase();
    }, 1500);
    
    // 定期同步（每5秒）
    setInterval(function() {
        syncMobileFromFirebase();
    }, 5000);
    
    // 監聽資料變化
    if (window.firebaseCore) {
        window.firebaseCore.onDataChange('prizes', function(data) {
            console.log('📱 獎項更新');
            syncMobileFromFirebase();
        });
        
        window.firebaseCore.onDataChange('winners', function(data) {
            console.log('📱 中獎記錄更新');
            syncMobileFromFirebase();
        });
    }
    
    // 重新綁定按鈕
    setTimeout(function() {
        bindMobileButtons();
    }, 2000);
}

// 從 Firebase 同步資料到手機
function syncMobileFromFirebase() {
    if (!window.firebaseCore || !window.firebaseCore.isConnected) {
        console.log('⚠️ Firebase 未連線');
        return;
    }
    
    console.log('📱 從 Firebase 載入資料...');
    
    // 載入獎項
    window.firebaseCore.getData('prizes').then(function(prizes) {
        if (prizes) {
            localStorage.setItem('prizes', JSON.stringify(prizes));
            console.log('✅ 已載入獎項:', prizes);
        }
    });
    
    // 載入中獎記錄
    window.firebaseCore.getData('winners').then(function(winners) {
        if (winners) {
            localStorage.setItem('winners', JSON.stringify(winners));
            console.log('✅ 已載入中獎記錄');
        }
    });
    
    // 載入加碼設定
    window.firebaseCore.getData('bonusSettings').then(function(settings) {
        if (settings) {
            localStorage.setItem('bonusSettings', JSON.stringify(settings));
        }
    });
    
    // 載入參與者
    window.firebaseCore.getData('employees').then(function(employees) {
        if (employees) {
            localStorage.setItem('employees', JSON.stringify(employees));
        }
    });
    
    // 更新獎項列表
    setTimeout(function() {
        if (window.loadAvailablePrizes) {
            window.loadAvailablePrizes();
        }
    }, 500);
}

// 綁定手機按鈕
function bindMobileButtons() {
    console.log('📱 綁定按鈕功能...');
    
    var startBtn = document.getElementById('startBtn');
    var stopBtn = document.getElementById('stopBtn');
    var forceStopBtn = document.getElementById('forceStopBtn');
    
    if (startBtn) {
        startBtn.onclick = function() {
            sendMobileCommand('start');
            return false;
        };
        console.log('✅ 開始按鈕已綁定');
    }
    
    if (stopBtn) {
        stopBtn.onclick = function() {
            sendMobileCommand('stop');
            return false;
        };
        console.log('✅ 停止按鈕已綁定');
    }
    
    if (forceStopBtn) {
        forceStopBtn.onclick = function() {
            sendMobileCommand('reset');
            return false;
        };
        console.log('✅ 強制停止按鈕已綁定');
    }
}

// 發送手機命令
function sendMobileCommand(command) {
    if (!window.lotteryEvents) {
        console.error('❌ 事件系統未初始化');
        return;
    }
    
    if (command === 'start') {
        var prizeSelect = document.getElementById('prizeSelect');
        if (!prizeSelect || !prizeSelect.value) {
            alert('請選擇獎項');
            return;
        }
        
        var selectedText = prizeSelect.options[prizeSelect.selectedIndex].text;
        var prizeName = selectedText.split(' - ')[0];
        
        console.log('📤 發送開始命令');
        window.lotteryEvents.broadcastEvent('START_LOTTERY', {
            prize: { id: prizeSelect.value, name: prizeName },
            timestamp: Date.now()
        });
        
        // 更新按鈕狀態
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        document.getElementById('forceStopBtn').disabled = false;
        prizeSelect.disabled = true;
        
    } else if (command === 'stop') {
        console.log('📤 發送停止命令');
        window.lotteryEvents.broadcastEvent('STOP_LOTTERY', {
            timestamp: Date.now()
        });
        
        document.getElementById('stopBtn').disabled = true;
        
    } else if (command === 'reset') {
        console.log('📤 發送重置命令');
        window.lotteryEvents.broadcastEvent('RESET_LOTTERY', {
            timestamp: Date.now()
        });
        
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        document.getElementById('forceStopBtn').disabled = true;
        document.getElementById('prizeSelect').disabled = false;
    }
}

// ============ 顯示功能 ============
function setupDisplay() {
    console.log('🖥️ 設定顯示功能...');
    
    // 監聽狀態變化
    if (window.firebaseCore) {
        window.firebaseCore.onDataChange('lotteryState', function(state) {
            if (state) {
                console.log('🖥️ 狀態更新:', state);
                localStorage.setItem('lotteryState', JSON.stringify(state));
                
                // 觸發更新事件
                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'lotteryState',
                    newValue: JSON.stringify(state)
                }));
            }
        });
    }
}

console.log('🌉 簡化版橋接器載入完成');
