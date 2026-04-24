// ha-fetcher.js — PistonCore Frontend Device Fetcher
// IMPORTANT: Frontend NEVER talks directly to HA for security + CORS reasons.
// All calls go through the PistonCore backend[](http://localhost:7777)

class HAFetcher {
    constructor() {
        this.baseUrl = "http://localhost:7777";  // PistonCore backend
        this.cache = null;
        this.cacheTime = 0;
    }

    async apiGet(endpoint) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Backend API Error ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }

    /**
     * Get clean, sorted device list for wizard picker
     * Backend already filters and enriches the data
     */
    async getDevices() {
        if (this.cache && Date.now() - this.cacheTime < 30000) {
            return this.cache;
        }

        const data = await this.apiGet('/api/devices');
        
        const devices = data.map(device => ({
            id: device.id,
            name: device.friendly_name || device.name,
            area: device.area || 'Uncategorized',
            domain: device.domain,
            device_class: device.device_class || null,
            searchKey: (device.friendly_name + ' ' + device.id).toLowerCase()
        })).sort((a, b) => a.name.localeCompare(b.name));

        this.cache = devices;
        this.cacheTime = Date.now();
        return devices;
    }

    /**
     * Live search for device picker
     */
    async searchDevices(query = '') {
        const devices = await this.getDevices();
        if (!query.trim()) return devices;

        const q = query.toLowerCase();
        return devices.filter(d => 
            d.name.toLowerCase().includes(q) || 
            d.area.toLowerCase().includes(q) ||
            d.id.toLowerCase().includes(q)
        );
    }

    /**
     * Get capabilities for a specific device
     */
    async getCapabilities(deviceId) {
        return this.apiGet(`/api/device/${deviceId}/capabilities`);
    }

    /**
     * Get services for action wizard
     */
    async getServices(deviceId) {
        return this.apiGet(`/api/device/${deviceId}/services`);
    }
}

// Global instance
window.HAFetcher = HAFetcher;