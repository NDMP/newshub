// backend/utils/rateLimiter.js
class RateLimiter {
    constructor(maxRequestsPerMinute = 50) {
        this.maxRequests = maxRequestsPerMinute;
        this.requests = [];
    }

    async waitIfNeeded() {
        const now = Date.now();
        // Remove requests older than 1 minute
        this.requests = this.requests.filter(time => now - time < 60000);
        
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = this.requests[0];
            const waitTime = 60000 - (now - oldestRequest);
            console.log(`[RATE LIMITER] Waiting ${Math.ceil(waitTime/1000)}s to avoid rate limit...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.requests.push(now);
    }
}

module.exports = { RateLimiter };