const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

// 監視対象フォルダ（とりあえず上位のWorkフォルダ）
const WORK_DIR = path.join(__dirname, '../Work');
if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
}

// 保存対象の拡張子
const SAVE_EXTS = ['.psd', '.prproj', '.aep'];
// 動画拡張子
const VIDEO_EXTS = ['.mp4', '.mov', '.mxf', '.avi'];

// デバウンス用マップ
const saveTimers = new Map();
// Export判定中のファイルを記録して重複判定を防ぐ
const pendingExports = new Set();

// ダミーXP送信関数 (Firebaseの代わり)
function sendXPEvent(type, filePath, score = 0) {
    const xp = type === 'Save' ? 5 : 50;
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [XP EVENT] 🎮 ${type}! (+${xp}XP) - File: ${path.basename(filePath)} (Score: ${score})`);
    // TODO: ここにFirebaseへの書き込み処理を追加する
}

// ファイル監視の開始
const watcher = chokidar.watch(WORK_DIR, {
    ignored: /(^|[\/\\])\../, // 隠しファイルは無視
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: false // 細かいサイズ変化を追うために手動で管理
});

console.log(`🚀 Tracker started. Watching: ${WORK_DIR}`);

// ----------------------------------------------------
// 保存（Save）検知ロジック
// ----------------------------------------------------
watcher.on('change', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    
    // 保存対象の拡張子かチェック
    if (SAVE_EXTS.includes(ext)) {
        // デバウンス処理（3秒以内の連続保存はまとめる）
        if (saveTimers.has(filePath)) {
            clearTimeout(saveTimers.get(filePath));
        }
        
        const timer = setTimeout(() => {
            console.log(`💾 Detected Save: ${path.basename(filePath)}`);
            sendXPEvent('Save', filePath);
            saveTimers.delete(filePath);
        }, 3000);
        
        saveTimers.set(filePath, timer);
    }
});

// ----------------------------------------------------
// 書き出し（Export）検知ロジック
// ----------------------------------------------------
watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath);
    
    // 一時ファイルを除外
    if (basename.startsWith('~') || basename.startsWith('.') || ext === '.tmp' || ext === '.crdownload') {
        return;
    }

    // 同じファイルの重複判定を防止
    if (pendingExports.has(filePath)) {
        return;
    }
    pendingExports.add(filePath);
    
    console.log(`🔍 Detected new file, monitoring for export: ${basename}`);
    
    let score = 2; // 新規ファイルの生成 (+2)
    if (VIDEO_EXTS.includes(ext)) {
        score += 2; // 動画拡張子 (+2)
    }

    let initialSize = 0;
    try {
        const stats = fs.statSync(filePath);
        initialSize = stats.size;
    } catch (e) {
        // ファイルがまだ作成途中の可能性があるので、サイズ0として続行
    }

    let sizeIncreasing = false;
    let sizeChangedCount = 0; // サイズが実際に変化した回数をカウント
    let writeDuration = 0;
    const checkInterval = 1000; // 1秒ごとにチェック
    const maxDuration = 5000; // 5秒間監視

    const intervalId = setInterval(() => {
        try {
            const stats = fs.statSync(filePath);
            if (stats.size > initialSize) {
                sizeIncreasing = true;
                sizeChangedCount++;
            }
            initialSize = stats.size;
        } catch (e) {
            // ファイルが削除された場合は監視を終了
            clearInterval(intervalId);
            pendingExports.delete(filePath);
            console.log(`⚠️ File removed during monitoring: ${path.basename(filePath)}`);
            return;
        }

        writeDuration += checkInterval;

        if (writeDuration >= maxDuration) {
            clearInterval(intervalId);
            evaluateExport();
        }
    }, checkInterval);

    function evaluateExport() {
        if (sizeIncreasing) score += 3; // ファイルサイズが増加中 (+3)
        // 実際にサイズ変化が複数回発生した場合のみ「書き込み継続」と判断
        if (sizeChangedCount >= 2) score += 2; // 書き込み継続時間が5秒以上 (+2)
        
        try {
            const stats = fs.statSync(filePath);
            if (stats.size >= 1024 * 1024) score += 1; // 最終サイズが1MB以上 (+1)
        } catch (e) {
            console.log(`⚠️ Could not read final size: ${path.basename(filePath)}`);
        }

        console.log(`📊 Export evaluation for ${path.basename(filePath)}: Score = ${score}`);

        if (score >= 5) {
            console.log(`🎉 Export Confirmed: ${path.basename(filePath)}`);
            sendXPEvent('Export', filePath, score);
        } else {
            console.log(`❌ Not an export (Score too low): ${path.basename(filePath)}`);
        }

        // 判定完了後、重複防止のSetからクリーンアップ
        pendingExports.delete(filePath);
    }
});

// 異常終了時のクリーンアップ
process.on('SIGINT', () => {
    console.log('\n🛑 Tracker stopped.');
    watcher.close();
    process.exit(0);
});
