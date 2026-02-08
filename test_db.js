const { initDatabase, db } = require('./src/database/index');

console.log('--- Testing Windows & Targets ---');
initDatabase();

const userId = 'test_user_Window';
const taskName = 'Window Task';

// 1. Create User
db.prepare('INSERT OR IGNORE INTO users (user_id) VALUES (?)').run(userId);

// 2. Create Window Task
console.log('Creating scoped task...');
const result = db.prepare('INSERT INTO tasks (user_id, name, frequency, interval_minutes, start_window, end_window, target_count) VALUES (?, ?, ?, ?, ?, ?, ?)').run(userId, taskName, 'interval', 30, '09:00', '17:00', 5);
const taskId = result.lastInsertRowid;

// 3. Verify Task
const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
if (task.start_window === '09:00' && task.target_count === 5) {
    console.log('✅ Window & Target task created.');
} else {
    console.error('❌ Window & Target task failed.');
}

console.log('Cleaning up...');
db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
console.log('Done.');
