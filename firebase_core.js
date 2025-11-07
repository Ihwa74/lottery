/**
 * Firebase 核心同步模組
 * 處理所有 Firebase Realtime Database 操作
 * 支援本地備援機制
 */

class FirebaseCore {
    constructor(config) {
        this.config = config;
        this.db = null;
        this.isConnected = false;
        this.localMode = false;
        this.listeners = new Map();
        this.connectionCallbacks = [];
        
        this.init();
    }

    /**
     * 初始化 Firebase 連接
     */
    async init() {
        try {
            // 初始化 Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.config);
            }
            
            this.db = firebase.database();
            
            // 監聽連接狀態
            this.setupConnectionMonitoring();
            
            console.log('🔥 Firebase Core 初始化成功');
        } catch (error) {
            console.error('❌ Firebase 初始化失敗:', error);
            this.localMode = true;
            this.triggerConnectionCallbacks(false);
        }
    }

    /**
     * 設置連接狀態監聽
     */
    setupConnectionMonitoring() {
        const connectedRef = this.db.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            this.isConnected = snapshot.val() === true;
            console.log(this.isConnected ? '🟢 Firebase 已連接' : '🔴 Firebase 已斷線');
            
            if (!this.isConnected) {
                this.localMode = true;
            } else {
                this.localMode = false;
                // 重新連接時同步本地數據
                this.syncLocalToCloud();
            }
            
            this.triggerConnectionCallbacks(this.isConnected);
        });
    }

    /**
     * 註冊連接狀態回調
     */
    onConnectionChange(callback) {
        this.connectionCallbacks.push(callback);
    }

    /**
     * 觸發連接狀態回調
     */
    triggerConnectionCallbacks(isConnected) {
        this.connectionCallbacks.forEach(callback => {
            try {
                callback(isConnected, this.localMode);
            } catch (error) {
                console.error('連接狀態回調錯誤:', error);
            }
        });
    }

    /**
     * 寫入數據（自動處理本地/雲端）
     */
    async setData(path, data) {
        try {
            // 總是先存到本地
            this.saveToLocal(path, data);
            
            // 如果有網路連接，也存到雲端
            if (this.isConnected && !this.localMode) {
                await this.db.ref(path).set(data);
                console.log(`✅ 數據已同步到雲端: ${path}`);
            } else {
                console.log(`💾 數據已存到本地: ${path}`);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ 寫入數據失敗 ${path}:`, error);
            // 確保至少本地有數據
            this.saveToLocal(path, data);
            return false;
        }
    }

    /**
     * 讀取數據（優先雲端，備援本地）
     */
    async getData(path) {
        try {
            if (this.isConnected && !this.localMode) {
                const snapshot = await this.db.ref(path).once('value');
                const data = snapshot.val();
                
                if (data !== null) {
                    // 同時更新本地備份
                    this.saveToLocal(path, data);
                    return data;
                }
            }
            
            // 從本地讀取
            return this.loadFromLocal(path);
        } catch (error) {
            console.error(`❌ 讀取數據失敗 ${path}:`, error);
            return this.loadFromLocal(path);
        }
    }

    /**
     * 監聽數據變化
     */
    onDataChange(path, callback) {
        const listenerId = `${path}_${Date.now()}`;
        
        if (this.isConnected && !this.localMode) {
            // 雲端監聽
            const ref = this.db.ref(path);
            const listener = ref.on('value', (snapshot) => {
                const data = snapshot.val();
                callback(data, 'cloud');
                // 同步到本地
                if (data !== null) {
                    this.saveToLocal(path, data);
                }
            });
            
            this.listeners.set(listenerId, { ref, listener, type: 'cloud' });
        } else {
            // 本地模式：定期檢查本地存儲變化
            const checkLocal = () => {
                const data = this.loadFromLocal(path);
                callback(data, 'local');
            };
            
            const interval = setInterval(checkLocal, 1000);
            this.listeners.set(listenerId, { interval, type: 'local' });
        }
        
        return listenerId;
    }

    /**
     * 移除數據監聽
     */
    offDataChange(listenerId) {
        const listener = this.listeners.get(listenerId);
        if (listener) {
            if (listener.type === 'cloud') {
                listener.ref.off('value', listener.listener);
            } else if (listener.type === 'local') {
                clearInterval(listener.interval);
            }
            this.listeners.delete(listenerId);
        }
    }

    /**
     * 發送事件
     */
    async sendEvent(eventType, eventData) {
        const event = {
            type: eventType,
            data: eventData,
            timestamp: Date.now(),
            id: this.generateEventId()
        };
        
        return await this.setData(`events/${event.id}`, event);
    }

    /**
     * 監聽事件
     */
    onEvent(callback) {
        return this.onDataChange('events', (events) => {
            if (events) {
                // 獲取最新事件
                const eventList = Object.values(events);
                const latestEvent = eventList.sort((a, b) => b.timestamp - a.timestamp)[0];
                
                if (latestEvent && Date.now() - latestEvent.timestamp < 5000) {
                    callback(latestEvent);
                }
            }
        });
    }

    /**
     * 同步本地數據到雲端
     */
    async syncLocalToCloud() {
        if (!this.isConnected || this.localMode) return;
        
        try {
            // 同步員工數據
            const employees = this.loadFromLocal('employees');
            if (employees) {
                await this.db.ref('employees').set(employees);
            }
            
            // 同步獎項數據
            const prizes = this.loadFromLocal('prizes');
            if (prizes) {
                await this.db.ref('prizes').set(prizes);
            }
            
            // 同步抽獎狀態
            const lotteryState = this.loadFromLocal('lotteryState');
            if (lotteryState) {
                await this.db.ref('lotteryState').set(lotteryState);
            }
            
            console.log('🔄 本地數據已同步到雲端');
        } catch (error) {
            console.error('❌ 同步數據到雲端失敗:', error);
        }
    }

    /**
     * 本地存儲操作
     */
    saveToLocal(path, data) {
        try {
            const key = `lottery_${path.replace(/\//g, '_')}`;
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('本地存儲失敗:', error);
        }
    }

    loadFromLocal(path) {
        try {
            const key = `lottery_${path.replace(/\//g, '_')}`;
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('本地讀取失敗:', error);
            return null;
        }
    }

    /**
     * 清理所有監聽器
     */
    cleanup() {
        this.listeners.forEach((listener, listenerId) => {
            this.offDataChange(listenerId);
        });
        this.listeners.clear();
        this.connectionCallbacks = [];
    }

    /**
     * 生成事件ID
     */
    generateEventId() {
        return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 獲取連接狀態
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            localMode: this.localMode
        };
    }
}

// 全局實例（需要在 firebase-config.js 中初始化）
window.firebaseCore = null;

// 初始化函數
window.initFirebaseCore = function(config) {
    window.firebaseCore = new FirebaseCore(config);
    return window.firebaseCore;
};