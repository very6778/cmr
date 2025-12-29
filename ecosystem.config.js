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
            max_memory_restart: '3G',
            error_file: './backend/logs/backend-error.log',
            out_file: './backend/logs/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name: 'ucs-frontend',
            cwd: './frontend',
            script: 'node_modules/.bin/next',
            args: 'start',
            interpreter: '/home/cmr/.nvm/versions/node/v22.21.1/bin/node',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
                PATH: '/home/cmr/.nvm/versions/node/v22.21.1/bin:/usr/local/bin:/usr/bin:/bin',
            },
            max_memory_restart: '3G',
            error_file: './frontend/logs/frontend-error.log',
            out_file: './frontend/logs/frontend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
    ],
}

