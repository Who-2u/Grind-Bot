const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../database.sqlite');
const db = new Database(dbPath, { verbose: console.log });

function initDatabase() {
    const schema = `
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        timezone TEXT DEFAULT 'UTC',
        settings TEXT -- JSON string for settings
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'custom', -- 'system' or 'custom'
        frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly', 'yearly', 'interval'
        reminder_time TEXT, -- HH:MM (for fixed time tasks)
        interval_minutes INTEGER, -- Minutes (for interval tasks)
        last_reminder_at DATETIME, -- timestamp of last reminder
        start_window TEXT DEFAULT '00:00', -- HH:MM
        end_window TEXT DEFAULT '23:59', -- HH:MM
        target_count INTEGER DEFAULT 1, -- Daily target
        reminder_count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        status TEXT, -- 'completed', 'missed', 'snoozed'
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
    );
    `;
    db.exec(schema);
    console.log('Database initialized.');
}

module.exports = {
    db,
    initDatabase
};
