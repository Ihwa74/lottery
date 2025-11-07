/**
 * 抽獎系統事件管理
 * 處理三個頁面間的事件通訊
 */

class LotteryEvents {
    constructor(firebaseCore) {
        this.firebaseCore = firebaseCore;
        this.eventHandlers = new Map();
        this.isListening = false;
        this.lastEventId = null;
        
        // 定義所有事件類型
        this.EVENT_TYPES = {
            // 抽獎控制事件
            START_LOTTERY: 'START_LOTTERY',
            STOP_LOTTERY: 'STOP_LOTTERY',
            RESET_LOTTERY: 'RESET_LOTTERY',
            LOTTERY_RESULT: 'LOTTERY_RESULT',
            
            // 數據同步事件
            EMPLOYEES_UPDATED: 'EMPLOYEES_UPDATED',
            PRIZES_UPDATED: 'PRIZES_UPDATED',
            
            // 狀態同步事件
            STATE_CHANGED: 'STATE_CHANGED',
            
            // 系統事件
            SYSTEM_READY: 'SYSTEM_READY',
            CONNECTION_STATUS: 'CONNECTION_STATUS'
        };
        
        this.init();
    }

    /**
     * 初始化事件系統
     */
    init() {
        // 監聽 Firebase 連接狀態
        this.firebaseCore.onConnectionChange((isConnected, localMode) => {
            this.broadcastEvent(this.EVENT_TYPES.CONNECTION_STATUS, {
                isConnected,
                localMode,
                timestamp: Date.now()
            });
        });
        
        // 開始監聽事件
        this.startListening();
        
        console.log('📡 事件管理系統已初始化');
    }

    /**
     * 開始監聽事件
     */
    startListening() {
        if (this.isListening) return;
        
        this.eventListenerId = this.firebaseCore.onEvent((event) => {
            this.handleIncomingEvent(event);
        });
        
        this.isListening = true;
        console.log('👂 開始監聽事件');
    }

    /**
     * 停止監聽事件
     */
    stopListening() {
        if (!this.isListening) return;
        
        if (this.eventListenerId) {
            this.firebaseCore.offDataChange(this.eventListenerId);
        }
        
        this.isListening = false;
        console.log('🔇 停止監聽事件');
    }

    /**
     * 處理接收到的事件
     */
    handleIncomingEvent(event) {
        // 避免處理重複事件
        if (event.id === this.lastEventId) return;
        this.lastEventId = event.id;
        
        console.log(`📨 收到事件: ${event.type}`, event.data);
        
        // 觸發對應的事件處理器
        const handlers = this.eventHandlers.get(event.type);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event.data, event);
                } catch (error) {
                    console.error(`事件處理器錯誤 ${event.type}:`, error);
                }
            });
        }
    }

    /**
     * 廣播事件
     */
    async broadcastEvent(eventType, eventData = {}) {
        console.log(`📤 廣播事件: ${eventType}`, eventData);
        
        try {
            await this.firebaseCore.sendEvent(eventType, eventData);
            return true;
        } catch (error) {
            console.error(`廣播事件失敗 ${eventType}:`, error);
            return false;
        }
    }

    /**
     * 註冊事件處理器
     */
    on(eventType, handler) {
        if (!this.eventHandlers.has(eventType)) {
            this.eventHandlers.set(eventType, []);
        }
        
        this.eventHandlers.get(eventType).push(handler);
        console.log(`📋 註冊事件處理器: ${eventType}`);
    }

    /**
     * 移除事件處理器
     */
    off(eventType, handler) {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
                console.log(`🗑️ 移除事件處理器: ${eventType}`);
            }
        }
    }

    /**
     * 抽獎控制方法
     */
    startLottery(prizeInfo) {
        return this.broadcastEvent(this.EVENT_TYPES.START_LOTTERY, {
            prize: prizeInfo,
            timestamp: Date.now()
        });
    }

    stopLottery() {
        return this.broadcastEvent(this.EVENT_TYPES.STOP_LOTTERY, {
            timestamp: Date.now()
        });
    }

    resetLottery() {
        return this.broadcastEvent(this.EVENT_TYPES.RESET_LOTTERY, {
            timestamp: Date.now()
        });
    }

    announceResult(winner, prize) {
        return this.broadcastEvent(this.EVENT_TYPES.LOTTERY_RESULT, {
            winner,
            prize,
            timestamp: Date.now()
        });
    }

    /**
     * 數據同步方法
     */
    notifyEmployeesUpdated(employees) {
        return this.broadcastEvent(this.EVENT_TYPES.EMPLOYEES_UPDATED, {
            employees,
            count: employees.length,
            timestamp: Date.now()
        });
    }

    notifyPrizesUpdated(prizes) {
        return this.broadcastEvent(this.EVENT_TYPES.PRIZES_UPDATED, {
            prizes,
            count: prizes.length,
            timestamp: Date.now()
        });
    }

    /**
     * 狀態同步方法
     */
    updateState(newState) {
        return this.broadcastEvent(this.EVENT_TYPES.STATE_CHANGED, {
            state: newState,
            timestamp: Date.now()
        });
    }

    /**
     * 系統狀態方法
     */
    notifySystemReady(pageType) {
        return this.broadcastEvent(this.EVENT_TYPES.SYSTEM_READY, {
            pageType,
            timestamp: Date.now()
        });
    }

    /**
     * 清理資源
     */
    cleanup() {
        this.stopListening();
        this.eventHandlers.clear();
        console.log('🧹 事件管理系統已清理');
    }
}

/**
 * 抽獎狀態管理器
 */
class LotteryStateManager {
    constructor(firebaseCore, lotteryEvents) {
        this.firebaseCore = firebaseCore;
        this.lotteryEvents = lotteryEvents;
        
        this.state = {
            status: 'waiting', // waiting, rolling, showing, finished
            currentPrize: null,
            currentWinner: null,
            winners: [],
            availableEmployees: [],
            completedPrizes: []
        };
        
        this.stateCallbacks = [];
        this.init();
    }

    /**
     * 初始化狀態管理器
     */
    async init() {
        // 從雲端/本地載入狀態
        const savedState = await this.firebaseCore.getData('lotteryState');
        if (savedState) {
            this.state = { ...this.state, ...savedState };
        }
        
        // 監聽狀態變化事件
        this.lotteryEvents.on(this.lotteryEvents.EVENT_TYPES.STATE_CHANGED, (data) => {
            this.updateState(data.state, false); // false 表示不要再次廣播
        });
        
        console.log('🎯 狀態管理器已初始化', this.state);
    }

    /**
     * 更新狀態
     */
    async updateState(newState, broadcast = true) {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...newState };
        
        // 保存到雲端/本地
        await this.firebaseCore.setData('lotteryState', this.state);
        
        // 廣播狀態變化
        if (broadcast) {
            this.lotteryEvents.updateState(this.state);
        }
        
        // 觸發狀態回調
        this.triggerStateCallbacks(this.state, oldState);
        
        console.log('🔄 狀態已更新:', this.state);
    }

    /**
     * 註冊狀態變化回調
     */
    onStateChange(callback) {
        this.stateCallbacks.push(callback);
    }

    /**
     * 觸發狀態回調
     */
    triggerStateCallbacks(newState, oldState) {
        this.stateCallbacks.forEach(callback => {
            try {
                callback(newState, oldState);
            } catch (error) {
                console.error('狀態回調錯誤:', error);
            }
        });
    }

    /**
     * 獲取當前狀態
     */
    getState() {
        return { ...this.state };
    }

    /**
     * 狀態操作方法
     */
    async startLottery(prize) {
        await this.updateState({
            status: 'rolling',
            currentPrize: prize,
            currentWinner: null
        });
    }

    async showWinner(winner) {
        const newWinners = [...this.state.winners, { ...winner, prize: this.state.currentPrize }];
        await this.updateState({
            status: 'showing',
            currentWinner: winner,
            winners: newWinners
        });
    }

    async completePrize() {
        const completedPrizes = [...this.state.completedPrizes, this.state.currentPrize];
        await this.updateState({
            status: 'finished',
            completedPrizes
        });
    }

    async resetLottery() {
        await this.updateState({
            status: 'waiting',
            currentPrize: null,
            currentWinner: null
        });
    }

    async clearAllData() {
        await this.updateState({
            status: 'waiting',
            currentPrize: null,
            currentWinner: null,
            winners: [],
            completedPrizes: []
        });
    }
}

// 全局實例
window.lotteryEvents = null;
window.lotteryStateManager = null;

// 初始化函數
window.initLotteryEvents = function(firebaseCore) {
    window.lotteryEvents = new LotteryEvents(firebaseCore);
    window.lotteryStateManager = new LotteryStateManager(firebaseCore, window.lotteryEvents);
    
    return {
        events: window.lotteryEvents,
        stateManager: window.lotteryStateManager
    };
};