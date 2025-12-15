```javascript
module.exports = {
    apps: [
        // Backend - Python Flask
        {
            name: 'ucs-backend',
            cwd: './backend',
            script: 'app.py',
            interpreter: 'python3',
            env: {
                FLASK_ENV: 'production',
                PYTHONUNBUFFERED: '1'
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '3G',  // 3GB - İşlem sırasında rahatça kullanılabilir
            error_file: './logs/backend-error.log',
            out_file: './logs/backend-out.log',
            time: true
        },

        // Frontend - Next.js
        {
            name: 'ucs-frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'start',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '3G',  // 3GB - Yüksek trafikte güvenli
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            time: true
        }
    ]
};
```
