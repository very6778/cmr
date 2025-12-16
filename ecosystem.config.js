module.exports = {
    apps: [
        {
            name: 'ucs-backend',
            cwd: './backend',
            script: 'python3',
            args: 'app.py',
            interpreter: 'none',
            env: {
                FLASK_ENV: 'production',
            },
            max_memory_restart: '500M',
            error_file: './backend/logs/backend-error.log',
            out_file: './backend/logs/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name: 'ucs-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'start',
            interpreter: 'none',
            instances: 1,
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            max_memory_restart: '1G',
            error_file: './frontend/logs/frontend-error.log',
            out_file: './frontend/logs/frontend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
}
