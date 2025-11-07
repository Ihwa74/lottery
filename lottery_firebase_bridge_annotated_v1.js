/**
 * 抽獎系統 Firebase 橋接器
 * 功能：在不修改原有程式的情況下，實現 Firebase 遠端控制
 * 策略：監聽 Firebase 命令，模擬本地操作，同步狀態
 */

class LotteryFirebaseBridge {
    constructor() {
        this.initialized = false;
        this.firebaseCore = null;
        this.lotteryEvents = null;
        this.stateManager = null;
        this.pageType = this.detectPageType();
        this.isRemoteCommand = false; // 標記是否為遠端命令，避免循環
        
        console.log('🌉 Firebase 橋接器初始化中...', this.pageType);
        this.init();
    }
    
    /**
     * 檢測當前頁面類型
     */
    detectPageType() {
        const path = window.location.pathname;
        if (path.includes('admin')) return 'admin';
        if (path.includes('display')) return 'display';
        if (path.includes('mobile')) return 'mobile';
        return 'unknown';
    }
    
    /**
     * 初始化橋接器
     */
    async init() {
        try {
            // 1. 初始化 Firebase 系統
            const lotterySystem = await initLotterySystem();
            if (!lotterySystem) {
                console.error('❌ Firebase 系統初始化失敗');
                this.fallbackToLocal();
                return;
            }
            
            this.firebaseCore = lotterySystem.firebaseCore;
            this.lotteryEvents = lotterySystem.events;
            this.stateManager = lotterySystem.stateManager;
            
            // 2. 設定頁面特定功能
            this.setupPageSpecificFeatures();
            
            // 3. 設定狀態同步
            this.setupStateSync();
            
            // 4. 監聽連線狀態
            this.setupConnectionMonitoring();
            
            this.initialized = true;
            console.log('✅ Firebase 橋接器初始化成功');
            
            // 5. 通知系統就緒
            this.lotteryEvents.notifySystemReady(this.pageType);
            
        } catch (error) {
            console.error('❌ 橋接器初始化錯誤:', error);
            this.fallbackToLocal();
        }
    }
    
    /**
     * 設定頁面特定功能
     */
    setupPageSpecificFeatures() {
        switch (this.pageType) {
            case 'admin':
                this.setupAdminBridge();
                break;
            case 'display':
                this.setupDisplayBridge();
                break;
            case 'mobile':
                this.setupMobileBridge();
                break;
        }
    }
    
    /**
     * 後台橋接設定
     */
    setupAdminBridge() {
        console.log('📋 設定後台橋接功能...');
        
        // 1. 監聽來自 Firebase 的命令
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.START_LOTTERY, (data) => {
            if (this.isRemoteCommand) return;
            console.log('📨 收到遠端開始命令:', data);
            this.executeRemoteStart(data);
        });
        
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.STOP_LOTTERY, (data) => {
            if (this.isRemoteCommand) return;
            console.log('📨 收到遠端停止命令:', data);
            this.executeRemoteStop();
        });
        
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.RESET_LOTTERY, (data) => {
            if (this.isRemoteCommand) return;
            console.log('📨 收到遠端重置命令:', data);
            this.executeRemoteReset();
        });
        
        // 2. 監聽本地 localStorage 變化，同步到 Firebase
        this.monitorLocalStateChanges();
    }
    
    /**
     * 顯示螢幕橋接設定
     */
    setupDisplayBridge() {
        console.log('🖥️ 設定顯示螢幕橋接功能...');
        
        // 只監聽狀態變化，不處理命令
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.STATE_CHANGED, (data) => {
            console.log('📨 收到狀態更新:', data.state);
            this.updateDisplayState(data.state);
        });
        
        // 監聽中獎結果
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.LOTTERY_RESULT, (data) => {
            console.log('🎉 收到中獎結果:', data);
            this.updateDisplayResult(data);
        });
    }
    
    /**
     * 手機控制橋接設定
     */
    setupMobileBridge() {
        console.log('📱 設定手機控制橋接功能...');
        // 【修改】增加診斷 log，確認當前頁面與元件是否存在
        try {
            console.log('【修改-診斷】startBtn存在:', !!document.getElementById('startBtn') || !!document.querySelector('.btn-start'));
            console.log('【修改-診斷】stopBtn存在:', !!document.getElementById('stopBtn') || !!document.querySelector('.btn-stop'));
            console.log('【修改-診斷】prizeSelect存在:', !!document.getElementById('prizeSelect'));
        } catch (e) { console.warn('【修改-診斷】檢查元素時發生例外', e); }
        
        // 攔截原有按鈕事件，改為發送到 Firebase
        this.interceptMobileControls();
        
        // 監聽狀態變化以更新 UI
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.STATE_CHANGED, (data) => {
            console.log('📨 收到狀態更新:', data.state);
            this.updateMobileUI(data.state);
        });
    }
    
    /**
     * 執行遠端開始命令（後台）
     */
    executeRemoteStart(data) {
        this.isRemoteCommand = true;
        
        // 找到對應的獎項選擇器並設定
        const prizeSelect = document.getElementById('currentPrizeSelect') || 
                           document.querySelector('select[id*="prize"]');
        if (prizeSelect && data.prize) {
            prizeSelect.value = data.prize.id;
        }
        
        // 觸發開始按鈕
        const startBtn = document.getElementById('startLotteryBtn') || 
                        document.querySelector('button[onclick*="startLottery"]') ||
                        document.querySelector('.btn-start-lottery');
        
        if (startBtn) {
            console.log('🎯 觸發本地開始按鈕');
            startBtn.click();
        }
        
        setTimeout(() => { this.isRemoteCommand = false; }, 100);
    }
    
    /**
     * 執行遠端停止命令（後台）
     */
    executeRemoteStop() {
        this.isRemoteCommand = true;
        
        const stopBtn = document.getElementById('stopLotteryBtn') || 
                       document.querySelector('button[onclick*="stopLottery"]') ||
                       document.querySelector('.btn-stop-lottery');
        
        if (stopBtn) {
            console.log('🛑 觸發本地停止按鈕');
            stopBtn.click();
        }
        
        setTimeout(() => { this.isRemoteCommand = false; }, 100);
    }
    
    /**
     * 執行遠端重置命令（後台）
     */
    executeRemoteReset() {
        this.isRemoteCommand = true;
        
        const resetBtn = document.getElementById('resetBtn') || 
                        document.querySelector('button[onclick*="reset"]') ||
                        document.querySelector('.btn-reset');
        
        if (resetBtn) {
            console.log('🔄 觸發本地重置按鈕');
            resetBtn.click();
        }
        
        setTimeout(() => { this.isRemoteCommand = false; }, 100);
    }
    
    /**
     * 監控本地狀態變化（後台）
     */
    monitorLocalStateChanges() {
        // 監聽 localStorage 變化
        let lastState = null;
        
        setInterval(() => {
            const currentState = localStorage.getItem('lotteryState');
            if (currentState !== lastState && !this.isRemoteCommand) {
                lastState = currentState;
                
                try {
                    const state = JSON.parse(currentState);
                    console.log('🔄 同步本地狀態到 Firebase:', state);
                    
                    // 更新 Firebase 狀態
                    this.stateManager.updateState(state);
                    
                    // 如果有中獎者，廣播結果
                    if (state.currentWinner && state.status === 'showing') {
                        this.lotteryEvents.announceResult(
                            state.currentWinner,
                            state.currentPrize
                        );
                    }
                } catch (error) {
                    console.error('狀態同步錯誤:', error);
                }
            }
        }, 500);
    }
    
    /**
     * 攔截手機控制（手機端）
     */
    interceptMobileControls() {
        // 等待 DOM 載入完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.interceptMobileControls());
            return;
        }
        
        // 攔截開始按鈕
        // 【修改】為避免 inline onclick 造成衝突，先移除並以事件監聽接管
        const startBtn = document.getElementById('startBtn') || 
                        document.querySelector('.btn-start');
        if (startBtn) { try { startBtn.removeAttribute('onclick'); } catch(e){} }
        if (startBtn) {
            const originalClick = startBtn.onclick;
            startBtn.onclick = (e) => {
                e.preventDefault();
                this.sendRemoteStart();
                return false;
            };
        }
        
        // 攔截停止按鈕
        // 【修改】移除 inline onclick，避免與橋接器衝突
        const stopBtn = document.getElementById('stopBtn') || 
                       document.querySelector('.btn-stop');
        if (stopBtn) { try { stopBtn.removeAttribute('onclick'); } catch(e){} }
        if (stopBtn) {
            const originalClick = stopBtn.onclick;
            stopBtn.onclick = (e) => {
                e.preventDefault();
                this.sendRemoteStop();
                return false;
            };
        }
        
        // 攔截強制停止按鈕
        const forceStopBtn = document.getElementById('forceStopBtn') || 
                            document.querySelector('.btn-force-stop');
        if (forceStopBtn) {
            const originalClick = forceStopBtn.onclick;
            forceStopBtn.onclick = (e) => {
                e.preventDefault();
                this.sendRemoteForceStop();
                return false;
            };
        }
        
        console.log('✅ 手機控制按鈕已攔截並重新導向到 Firebase');
    }
    
    /**
     * 發送遠端開始命令（手機端）
     */
    sendRemoteStart() {
        const prizeSelect = document.getElementById('prizeSelect');
        if (!prizeSelect || !prizeSelect.value) {
            alert('請選擇獎項');
            return;
        }
        
        const selectedOption = prizeSelect.options[prizeSelect.selectedIndex];
        const prizeInfo = {
            id: prizeSelect.value,
            name: selectedOption.text.split(' - ')[0]
        };
        
        // 【修改】加入更完整的送出與錯誤處理 log
        console.log('📤 發送遠端開始命令:', prizeInfo);
        try {
            await this.lotteryEvents.startLottery(prizeInfo);
            console.log('✅ START_LOTTERY 已廣播');
        } catch (e) {
            console.error('❌ START_LOTTERY 廣播失敗', e);
            alert('無法送出開始指令，請確認網路或稍後再試');
            return;
        }
        
        // 更新本地 UI
        this.updateButtonStates('rolling');
    }
    
    /**
     * 發送遠端停止命令（手機端）
     */
    sendRemoteStop() {
        console.log('📤 發送遠端停止命令');
        this.lotteryEvents.stopLottery();
        
        // 更新本地 UI
        this.updateButtonStates('showing');
    }
    
    /**
     * 發送遠端強制停止命令（手機端）
     */
    sendRemoteForceStop() {
        console.log('📤 發送遠端強制停止命令');
        this.lotteryEvents.stopLottery(); // 使用相同的停止命令
        
        // 更新本地 UI
        this.updateButtonStates('waiting');
    }
    
    /**
     * 更新顯示螢幕狀態（顯示端）
     */
    updateDisplayState(state) {
        // 更新 localStorage 讓原程式響應
        const currentLocal = JSON.parse(localStorage.getItem('lotteryState') || '{}');
        const newState = { ...currentLocal, ...state };
        localStorage.setItem('lotteryState', JSON.stringify(newState));
        
        // 觸發 storage 事件讓原程式更新
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'lotteryState',
            newValue: JSON.stringify(newState),
            oldValue: JSON.stringify(currentLocal)
        }));
    }
    
    /**
     * 更新顯示螢幕中獎結果（顯示端）
     */
    updateDisplayResult(data) {
        // 更新 localStorage
        const state = {
            status: 'showing',
            currentWinner: data.winner,
            currentPrize: data.prize
        };
        
        localStorage.setItem('lotteryState', JSON.stringify(state));
        
        // 觸發 storage 事件
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'lotteryState',
            newValue: JSON.stringify(state)
        }));
    }
    
    /**
     * 更新手機 UI（手機端）
     */
    updateMobileUI(state) {
        // 更新按鈕狀態
        this.updateButtonStates(state.status);
        
        // 更新狀態顯示
        const statusText = document.getElementById('currentStatus');
        if (statusText) {
            const statusMap = {
                'waiting': '等待開始',
                'rolling': '抽獎進行中...',
                'showing': '顯示中獎者',
                'finished': '本輪結束'
            };
            statusText.textContent = statusMap[state.status] || state.status;
        }
        
        // 更新當前獎項顯示
        const currentPrizeText = document.getElementById('currentPrizeDisplay');
        if (currentPrizeText && state.currentPrize) {
            currentPrizeText.textContent = `正在抽取: ${state.currentPrize.name}`;
        }
    }
    
    /**
     * 更新按鈕狀態（手機端）
     */
    updateButtonStates(status) {
        const startBtn = document.getElementById('startBtn') || document.querySelector('.btn-start');
        const stopBtn = document.getElementById('stopBtn') || document.querySelector('.btn-stop');
        const forceStopBtn = document.getElementById('forceStopBtn') || document.querySelector('.btn-force-stop');
        const prizeSelect = document.getElementById('prizeSelect');
        
        switch (status) {
            case 'waiting':
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;
                if (forceStopBtn) forceStopBtn.disabled = true;
                if (prizeSelect) prizeSelect.disabled = false;
                break;
                
            case 'rolling':
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (forceStopBtn) forceStopBtn.disabled = false;
                if (prizeSelect) prizeSelect.disabled = true;
                break;
                
            case 'showing':
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = true;
                if (forceStopBtn) forceStopBtn.disabled = false;
                if (prizeSelect) prizeSelect.disabled = true;
                break;
        }
    }
    
    /**
     * 設定狀態同步
     */
    setupStateSync() {
        // 定期檢查連線並同步
        setInterval(() => {
            if (this.firebaseCore && this.firebaseCore.isConnected) {
                // 連線正常，可以進行同步操作
            }
        }, 5000);
    }
    
    /**
     * 設定連線監控
     */
    setupConnectionMonitoring() {
        this.firebaseCore.onConnectionChange((isConnected, localMode) => {
            this.updateConnectionStatus(isConnected, localMode);
        });
    }
    
    /**
     * 更新連線狀態顯示
     */
    updateConnectionStatus(isConnected, localMode) {
        // 更新連線狀態指示器（如果頁面有的話）
        const statusDot = document.getElementById('connectionDot') || 
                         document.querySelector('.status-dot');
        const statusText = document.getElementById('connectionText') || 
                          document.querySelector('.connection-status');
        
        if (statusDot) {
            statusDot.className = isConnected ? 
                'status-dot status-connected' : 
                'status-dot status-disconnected';
        }
        
        if (statusText) {
            if (isConnected) {
                statusText.textContent = '已連接到系統';
            } else if (localMode) {
                statusText.textContent = '本地模式';
            } else {
                statusText.textContent = '連接中斷';
            }
        }
        
        // 在 console 顯示狀態
        console.log(`🔌 連線狀態: ${isConnected ? '已連接' : '已斷線'} ${localMode ? '(本地模式)' : ''}`);
    }
    
    /**
     * 降級到本地模式
     */
    fallbackToLocal() {
        console.warn('⚠️ Firebase 無法連接，降級到本地模式');
        this.updateConnectionStatus(false, true);
        
        // 本地模式下，手機控制將無法使用
        if (this.pageType === 'mobile') {
            alert('無法連接到遠端系統，請確認網路連線或在同一台電腦上操作');
        }
    }
    
    /**
     * 清理資源
     */
    cleanup() {
        if (this.lotteryEvents) {
            this.lotteryEvents.cleanup();
        }
        if (this.firebaseCore) {
            this.firebaseCore.cleanup();
        }
    }
}


// 【修改】提供手動重設雲端狀態的輔助函式（清測試後可呼叫）
function __forceSyncWaitingState() {
    try {
        if (!window.lotteryBridge || !window.lotteryBridge.stateManager) {
            console.warn('無法同步：bridge 尚未就緒');
            return;
        }
        const defaultState = { status: 'waiting', currentPrize: null, currentWinner: null, winners: [], completedPrizes: [] };
        console.log('☁️ 手動推送 waiting 狀態到 Firebase');
        window.lotteryBridge.stateManager.updateState(defaultState);
    } catch (e) {
        console.error('手動同步失敗', e);
    }
}
window.__forceSyncWaitingState = __forceSyncWaitingState;
// 自動初始化橋接器
let lotteryBridge = null;

// 等待所有依賴載入完成
function initBridge() {
    // 檢查依賴是否載入
    if (typeof initLotterySystem === 'undefined' || 
        typeof firebase === 'undefined') {
        console.log('⏳ 等待依賴載入...');
        setTimeout(initBridge, 100);
        return;
    }
    
    // 初始化橋接器
    if (!lotteryBridge) {
        lotteryBridge = new LotteryFirebaseBridge();
        window.lotteryBridge = lotteryBridge;
    }
}

// 在 DOM 載入完成後初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
} else {
    // DOM 已載入，延遲一下確保其他腳本載入
    setTimeout(initBridge, 500);
}

// 頁面卸載時清理
window.addEventListener('beforeunload', () => {
    if (lotteryBridge) {
        lotteryBridge.cleanup();
    }
});

console.log('🌉 Firebase 橋接器腳本已載入');
