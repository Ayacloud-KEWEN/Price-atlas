export default defineEventHandler(() => ({ user: process.env.ADMIN_USERNAME || 'admin' }))
