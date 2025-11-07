/**
 * Firebase 配置文件
 * 請將你的 Firebase 專案配置填入下方
 */

// 你的 Firebase 配置 - 請從 Firebase Console 複製
const firebaseConfig = {
  apiKey: "AIzaSyDVTP1itg3tlbH4BgaZfY-H23eyfIZ9FGk",
  authDomain: "lottery-110fe.firebaseapp.com",
  databaseURL: "https://lottery-110fe-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lottery-110fe",
  storageBucket: "lottery-110fe.firebasestorage.app",
  messagingSenderId: "915221431271",
  appId: "1:915221431271:web:ec23cf55e41afa828db342",
  measurementId: "G-66FQLVT0S4"
};

// 驗證配置是否完整
function validateFirebaseConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
        console.warn('⚠️ Firebase 配置不完整，缺少:', missingFields);
        console.warn('📋 請到 Firebase Console 複製完整配置');
        return false;
    }
    
    console.log('✅ Firebase 配置驗證通過');
    return true;
}

// 初始化抽獎系統
async function initLotterySystem() {
    try {
        // 驗證配置
        if (!validateFirebaseConfig()) {
            console.error('❌ Firebase 配置不完整，無法初始化');
            return null;
        }
        
        // 初始化 Firebase Core
        const firebaseCore = initFirebaseCore(firebaseConfig);
        
        // 等待一下讓 Firebase 初始化完成
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 初始化事件系統
        const { events, stateManager } = initLotteryEvents(firebaseCore);
        
        console.log('🎉 抽獎系統初始化成功');
        
        return {
            firebaseCore,
            events,
            stateManager
        };
        
    } catch (error) {
        console.error('❌ 抽獎系統初始化失敗:', error);
        return null;
    }
}

// 全局初始化函數
window.initLotterySystem = initLotterySystem;

// 測試連接函數
async function testFirebaseConnection() {
    try {
        if (!validateFirebaseConfig()) {
            return false;
        }
        
        // 初始化 Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        const db = firebase.database();
        
        // 測試寫入
        await db.ref('test/connection').set({
            timestamp: Date.now(),
            message: 'Connection test successful'
        });
        
        // 測試讀取
        const snapshot = await db.ref('test/connection').once('value');
        const data = snapshot.val();
        
        if (data && data.message === 'Connection test successful') {
            console.log('🟢 Firebase 連接測試成功');
            return true;
        } else {
            console.log('🔴 Firebase 連接測試失敗');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Firebase 連接測試錯誤:', error);
        return false;
    }
}

// 匯出測試函數
window.testFirebaseConnection = testFirebaseConnection;

// 頁面載入時自動提示配置
document.addEventListener('DOMContentLoaded', () => {
    if (!validateFirebaseConfig()) {
        console.log('='.repeat(50));
        console.log('🔧 請完成 Firebase 配置設定：');
        console.log('1. 開啟 Firebase Console');
        console.log('2. 選擇你的專案');
        console.log('3. 進入 Project Settings > General');
        console.log('4. 在 "Your apps" 區域找到 Web app');
        console.log('5. 複製 firebaseConfig 物件');
        console.log('6. 貼到 firebase-config.js 檔案中');
        console.log('='.repeat(50));
    }
});