class DevConnections {
    
    private static connections = new Map<string, any>();
    private static lookUpMap = new WeakMap<WebSocket, string>();

    static addConnection(projectId: string, ws: any) {
        if (this.getConnection(projectId)==null) {
            this.connections.set(projectId, ws);
            this.lookUpMap.set(ws, projectId);
        }
    }

    static getAllConnections() {
        return this.connections;
    }

    static getConnection(projectId: string) {
        return this.connections.get(projectId);
    }

    static removeConnection(ws: any) {
        var projectId = this.lookUpMap.get(ws) ?? "";
        this.connections.delete(projectId);
        this.lookUpMap.delete(ws);
    }

    static hasConnection(projectId: string) {
        return this.connections.has(projectId);
    }
}

export default DevConnections;